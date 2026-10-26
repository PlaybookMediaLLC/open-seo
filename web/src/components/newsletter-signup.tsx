import { type FormEvent, useState } from "react";
import { useTurnstile } from "@/lib/free-tools/turnstile";

const SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ||
  (import.meta.env.DEV ? "1x00000000000000000000AA" : "");

/** Newsletter subscribe form. Shared by the marketing footer and home page. */
export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [token, setToken] = useState("");
  const [verificationFailed, setVerificationFailed] = useState(!SITE_KEY);
  const widget = useTurnstile(
    SITE_KEY,
    (value = "") => {
      setToken(value);
      setVerificationFailed(false);
    },
    () => {
      setToken("");
      setVerificationFailed(true);
    },
    "newsletter",
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === "loading" || !token) return;
    if (widget.isExpired()) {
      setToken("");
      widget.reset();
      return;
    }
    setStatus("loading");
    setErrorMessage("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, turnstileToken: token }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error || "Something went wrong",
        );
      }
      setStatus("success");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setToken("");
      widget.reset();
    }
  };

  if (status === "success") {
    return <p className="text-sm text-neutral-900">You&apos;re on the list.</p>;
  }

  return (
    <form onSubmit={handleSubmit} autoComplete="on">
      <div className="flex gap-2">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={status === "loading"}
          className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-500 transition focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
        />
        <button
          type="submit"
          disabled={status === "loading" || !token}
          className="h-10 shrink-0 rounded-lg bg-neutral-950 px-5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
        >
          {status === "loading" ? "..." : "Subscribe"}
        </button>
      </div>
      {SITE_KEY ? <div ref={widget.container} /> : null}
      {verificationFailed ? (
        <p role="alert" className="mt-2 text-xs text-red-600">
          Browser verification failed.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              setVerificationFailed(false);
              widget.reset();
            }}
          >
            Retry verification
          </button>
        </p>
      ) : null}
      {status === "error" && (
        <p className="mt-2 text-xs text-red-600">{errorMessage}</p>
      )}
    </form>
  );
}

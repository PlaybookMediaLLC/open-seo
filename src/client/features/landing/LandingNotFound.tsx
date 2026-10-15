import { BrandMark } from "@/client/components/BrandMark";

/**
 * Playbook fork: the 404 page for unknown URLs and docs pages, in the landing
 * page's monochrome look. The root route mounts it at a `// playbook-seam`
 * line; 404s inside the app keep the app's own card.
 */
export function LandingNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-black px-6 text-center text-white">
      <BrandMark className="size-10 ring-1 ring-white/15" />
      <p className="mt-8 font-mono text-xs uppercase tracking-[0.08em] text-white/55">
        404
      </p>
      <h1 className="mt-3 text-[32px] font-semibold tracking-[-1px]">
        Page not found
      </h1>
      <p className="mt-3 max-w-sm text-[15px] leading-6 text-white/65">
        The page you are looking for does not exist or has moved.
      </p>
      <div className="mt-8 flex gap-3">
        <a
          href="/"
          className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/85"
        >
          Home
        </a>
        <a
          href="/docs"
          className="rounded-full px-4 py-2 text-sm font-medium text-white/75 ring-1 ring-white/15 transition-colors hover:text-white"
        >
          Docs
        </a>
      </div>
    </main>
  );
}

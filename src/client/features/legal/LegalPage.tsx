import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

// Public, unauthenticated legal pages. The app shell sets `overflow: hidden`
// on html/body, so this page is its own scroll container.
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="h-[100dvh] overflow-y-auto bg-background">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          Playbook Media SEO
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated {updated}
        </p>
        <div className="mt-8 space-y-4 text-sm leading-relaxed [&_a]:underline [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
          {children}
        </div>
        <nav className="mt-12 flex gap-4 border-t pt-6 text-sm text-muted-foreground">
          <Link to="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:underline">
            Terms of Service
          </Link>
        </nav>
      </div>
    </div>
  );
}

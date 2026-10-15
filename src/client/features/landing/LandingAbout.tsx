import { Reveal } from "./LandingPrimitives";

/**
 * What Relay is and why it asks for Google data, in plain words. Google's OAuth
 * review reads the home page for the app's name, its purpose and its data use,
 * so this stays visible text, server-rendered with the page.
 */
export function LandingAbout() {
  return (
    <section id="about" className="w-full px-6 pb-8 pt-4">
      <Reveal className="mx-auto max-w-[680px] text-center">
        <h2 className="text-[22px] font-semibold tracking-[-0.6px] text-(--l-text) sm:text-[26px]">
          What Relay does
        </h2>
        <p className="mt-4 text-[15px] leading-[24px] text-(--l-text-2)">
          Relay is an SEO tool from Playbook Media LLC. It reads your Google
          Search Console data, ranks the pages and keywords where a fix can win
          more clicks, and helps you or your AI agent ship those fixes. It also
          does keyword research, rank tracking, site audits and AI visibility
          tracking.
        </p>
        <p className="mt-4 text-[15px] leading-[24px] text-(--l-text-2)">
          When you connect Google Search Console or Google Analytics, Relay asks
          for read-only access. It uses that data only to show you your own
          search performance and opportunities. Relay never sells your data or
          uses it for advertising. Read the{" "}
          <a
            href="/privacy"
            className="text-(--l-text) underline decoration-white/30 underline-offset-4 hover:decoration-white/70"
          >
            Privacy Policy
          </a>{" "}
          for details.
        </p>
      </Reveal>
    </section>
  );
}

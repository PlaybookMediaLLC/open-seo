import { IconCheck } from "@tabler/icons-react";
import { useSession } from "@/lib/auth-client";
import { LandingFooter } from "@/client/features/landing/LandingFooter";
import { LandingNav } from "@/client/features/landing/LandingHero";

/** A paragraph, a bullet list, or a sub-heading inside a section. */
type Block = string | { list: string[] } | { heading: string };

export type LegalSection = { id: string; title: string; blocks: Block[] };

export type LegalDocument = {
  title: string;
  updated: string;
  summary: string[];
  sections: LegalSection[];
};

// Public, unauthenticated legal pages in the landing page's look. The app
// shell sets `overflow: hidden` on html/body, so the page owns its scroll.
export function LegalPage({ document }: { document: LegalDocument }) {
  const { data: session } = useSession();
  const { title, updated, summary, sections } = document;
  return (
    <div className="landing landing-scroll">
      <LandingNav signedIn={Boolean(session?.user?.id)} pinned />
      <main className="mx-auto grid w-full max-w-[1075px] gap-12 px-6 pb-16 pt-36 lg:grid-cols-[200px_1fr] lg:gap-16">
        <aside className="hidden lg:block">
          <nav aria-label="On this page" className="sticky top-32">
            <p className="text-[14px] font-semibold leading-[14px] text-[#b8babf]">
              On this page
            </p>
            <ol className="mt-5 space-y-2">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-[13px] leading-5 text-[#70757c] transition-colors duration-300 hover:text-white hover:duration-0"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>
        <article className="min-w-0 max-w-[680px]">
          <p className="text-[14px] font-medium tracking-[0.14px] text-[#888b91]">
            Legal
          </p>
          <h1 className="mt-3 text-[36px] font-semibold leading-[1.07] tracking-[-1.8px] text-[#fafafa] sm:text-[48px]">
            {title}
          </h1>
          <p className="mt-4 text-[14px] text-[#70757c]">
            Last updated {updated}
          </p>
          <div className="mt-10 rounded-[20px] border border-[#1c1d1f] bg-[#0f0f10] p-6 sm:p-8">
            <p className="text-[16px] font-medium text-[#fafafa]">
              The short version
            </p>
            <ul className="mt-4 space-y-3">
              {summary.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-[15px] leading-[22.5px] text-[#c4c5c9]"
                >
                  <IconCheck
                    className="mt-[3px] size-4 shrink-0 text-[#0088ff]"
                    stroke={2}
                  />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[13px] leading-5 text-[#70757c]">
              This summary is here to help you read the full text. The full text
              below is what applies.
            </p>
          </div>
          <div className="landing-legal mt-2">
            {sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-28"
              >
                <h2>
                  {index + 1}. {section.title}
                </h2>
                {section.blocks.map((block) => (
                  <LegalBlock key={blockKey(block)} block={block} />
                ))}
              </section>
            ))}
          </div>
        </article>
      </main>
      <LandingFooter />
    </div>
  );
}

function blockKey(block: Block) {
  if (typeof block === "string") return block;
  return "list" in block ? block.list.join("|") : block.heading;
}

function LegalBlock({ block }: { block: Block }) {
  if (typeof block === "string") {
    return (
      <p>
        <Rich text={block} />
      </p>
    );
  }
  if ("heading" in block) return <h3>{block.heading}</h3>;
  return (
    <ul>
      {block.list.map((item) => (
        <li key={item}>
          <Rich text={item} />
        </li>
      ))}
    </ul>
  );
}

/** Renders **bold** and [label](href) inside legal text. */
function Rich({ text }: { text: string }) {
  return text
    .split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
    .map((part, index) => {
      const key = `${index}-${part}`;
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
      if (link) {
        const [, label, href] = link;
        const external = href?.startsWith("http");
        return (
          <a
            key={key}
            href={href}
            rel={external ? "noreferrer" : undefined}
            target={external ? "_blank" : undefined}
          >
            {label}
          </a>
        );
      }
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={key}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
}

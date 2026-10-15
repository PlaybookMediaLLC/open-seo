import { useState, type FormEvent } from "react";
import { IconArrowRight, IconChevronDown, IconMail } from "@tabler/icons-react";
import { cn } from "cn";
import { BrandMark } from "@/client/components/BrandMark";
import { Reveal } from "./LandingPrimitives";

const FAQS = [
  [
    "Can I try OpenSEO for free?",
    "Yes. Every workspace starts on the Free plan with 1,000 data credits a month. Search Console insights, opportunities and experiments use no credits at all.",
  ],
  [
    "What is a data credit?",
    "Live keyword, SERP and backlink data costs us money per lookup. 1,000 credits cover $1 of that data, and each lookup shows its cost before you run it.",
  ],
  [
    "Do I need to connect Google?",
    "You sign in with Google. Connecting Search Console or Analytics is optional and read-only, and you can disconnect at any time.",
  ],
  [
    "Can my AI agent use it?",
    "Yes. OpenSEO exposes an MCP server, so Claude Code, Codex, Cursor and other MCP clients can run research and audits for you.",
  ],
  [
    "Is my data safe?",
    "Your Google data is read-only, used only to power your workspace, and never sold or used for advertising.",
  ],
] as const;

export function LandingFaq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="faq" className="w-full px-4 pb-20 pt-40">
      <Reveal className="mx-auto grid max-w-[1075px] gap-16 px-2 md:grid-cols-[1.2fr_1fr] md:px-14">
        <div>
          <p className="text-[14px] leading-5 text-white/40">Support</p>
          <h2 className="mt-3 text-[30px] font-semibold leading-8 tracking-[-1.5px] text-[#c4c5c9]">
            Frequently asked questions
          </h2>
          <div className="mt-8 max-w-2xl">
            {FAQS.map(([question, answer], index) => {
              const isOpen = open === index;
              return (
                <div key={question} className="border-b border-white/[0.07]">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-4 rounded-lg py-4 text-left text-[18px] leading-7 text-[#c4c5c9] outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/70"
                  >
                    {question}
                    <IconChevronDown
                      className={cn(
                        "size-5 shrink-0 transition-transform duration-300",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows] duration-300",
                      isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}
                  >
                    <p className="overflow-hidden pr-8 text-[16px] leading-6 text-[#888b91]">
                      <span className="block pb-5">{answer}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col justify-end pb-2">
          <p className="max-w-[280px] text-[16px] leading-6 text-[#888b91]">
            Can’t find the answer you’re looking for? Write to us and a real
            person will get back to you.
          </p>
          <a
            href="mailto:team@playbookmedia.io"
            className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#1c1d1f] px-4 py-2 text-[16px] text-[#c4c5c9] transition-colors hover:text-white"
          >
            Email us <IconArrowRight className="size-4" />
          </a>
        </div>
      </Reveal>
    </section>
  );
}

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: "Product",
    links: [
      ["Features", "#features"],
      ["Agents", "#agents"],
      ["Pricing", "#pricing"],
      ["Sign in", "/sign-in"],
    ],
  },
  {
    title: "Tools",
    links: [
      ["Keyword research", "/sign-in"],
      ["Rank tracking", "/sign-in"],
      ["Site audit", "/sign-in"],
      ["AI visibility", "/sign-in"],
    ],
  },
  {
    title: "Support",
    links: [
      ["Email support", "mailto:team@playbookmedia.io"],
      ["FAQ", "#faq"],
    ],
  },
  {
    title: "Policies",
    links: [
      ["Terms of Service", "/terms"],
      ["Privacy Policy", "/privacy"],
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="mt-24 w-full bg-black">
      <div className="mx-auto w-full max-w-[1075px] px-6 py-10">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2.5">
            <BrandMark className="size-5" />
            <span className="text-[17px] font-medium tracking-[-0.3px] text-[#fafafa]">
              openseo
            </span>
            <span className="text-sm text-[#70757c]">
              © {new Date().getFullYear()}
            </span>
          </p>
          <a
            href="mailto:team@playbookmedia.io"
            aria-label="Email us"
            className="grid size-10 place-items-center text-[#70757c] transition-colors duration-300 hover:text-white hover:duration-0"
          >
            <IconMail className="size-5" />
          </a>
        </div>
        <nav className="mt-12 grid grid-cols-2 gap-10 md:grid-cols-4">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <p className="text-[14px] font-semibold leading-[14px] text-[#b8babf]">
                {column.title}
              </p>
              <ul className="mt-5 space-y-2">
                {column.links.map(([label, href]) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-[14px] leading-5 text-[#70757c] transition-colors duration-300 hover:text-white hover:duration-0"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-12 border-t border-white/[0.07] pt-8">
          <p className="text-[14px] font-semibold leading-[14px] text-[#b8babf]">
            Let’s stay in touch!
          </p>
          <p className="mt-5 max-w-[290px] text-sm leading-6 text-[#70757c]">
            Product updates and SEO playbooks, a couple of times a month.
          </p>
          <StayInTouch />
          <p className="mt-10 text-xs text-[#70757c]">
            OpenSEO is a product of Playbook Media LLC.
          </p>
        </div>
      </div>
    </footer>
  );
}

/** Opens a pre-filled email: there is no mailing-list backend. */
function StayInTouch() {
  const [email, setEmail] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = encodeURIComponent(`Please add ${email} to OpenSEO updates.`);
    window.location.href = `mailto:team@playbookmedia.io?subject=OpenSEO%20updates&body=${body}`;
  }
  return (
    <form onSubmit={submit} className="relative mt-4 w-full max-w-[200px]">
      <input
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        aria-label="Email"
        className="h-10 w-full rounded-full bg-[#1c1d1f] pl-3 pr-10 text-sm text-white ring-1 ring-white/10 placeholder:text-[#70757c] focus:outline-none focus:ring-white/30"
      />
      <button
        type="submit"
        aria-label="Subscribe"
        className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-[#70757c] transition-colors hover:bg-white/10 hover:text-white"
      >
        <IconArrowRight className="size-4" />
      </button>
    </form>
  );
}

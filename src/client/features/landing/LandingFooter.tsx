import { IconArrowRight, IconMail } from "@tabler/icons-react";
import { BrandMark } from "@/client/components/BrandMark";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/client/components/ui/accordion";
import { Reveal } from "./LandingPrimitives";

const FAQS = [
  [
    "Can I try OpenSEO for free?",
    "Yes. Every workspace starts on the Free plan with 1,000 data credits a month. Search Console insights, opportunities and experiments do not use credits at all.",
  ],
  [
    "What is a data credit?",
    "Live keyword, SERP and backlink data comes from DataForSEO. 1,000 credits cover $1 of that data, and each lookup shows its cost before you run it.",
  ],
  [
    "Do I need to connect Google?",
    "Sign-in uses Google. Connecting Search Console or Analytics is optional and read-only, and you can disconnect at any time.",
  ],
  [
    "Can my AI agent use it?",
    "Yes. OpenSEO exposes an MCP server, so Claude Code, Codex, Cursor and other MCP clients can run research and audits for you.",
  ],
  [
    "Is my data safe?",
    "Your Google data is read-only, used only to power your workspace, and never sold or used for advertising. You can disconnect it at any time.",
  ],
] as const;

export function LandingFaq() {
  return (
    <section id="faq" className="px-4 py-24">
      <Reveal className="mx-auto grid max-w-[880px] gap-12 md:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="text-sm text-white/40">Support</p>
          <h2 className="mt-2 text-[27px] font-semibold tracking-[-1px] text-white">
            Frequently asked questions
          </h2>
          <Accordion className="mt-6">
            {FAQS.map(([question, answer]) => (
              <AccordionItem
                key={question}
                value={question}
                className="border-white/10"
              >
                <AccordionTrigger className="py-4 text-[15px] font-normal text-white hover:no-underline">
                  {question}
                </AccordionTrigger>
                <AccordionContent className="pb-4 text-sm leading-relaxed text-white/55">
                  {answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        <div className="md:pt-24">
          <p className="max-w-[260px] text-sm leading-relaxed text-white/60">
            Can’t find the answer you’re looking for? Write to us and a real
            person will get back to you.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="mailto:team@playbookmedia.io"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/[0.14]"
            >
              <IconMail className="size-3.5" /> Email us{" "}
              <IconArrowRight className="size-3.5" />
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function LandingFooter() {
  const columns: { title: string; links: [string, string][] }[] = [
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
  return (
    <footer className="mt-24 bg-black px-4 pb-16">
      <div className="mx-auto max-w-[880px]">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2.5 text-[17px] font-medium text-white">
            <BrandMark className="size-6" /> OpenSEO
            <span className="text-sm font-normal text-white/40">
              © {new Date().getFullYear()} Playbook Media LLC
            </span>
          </p>
          <a
            href="mailto:team@playbookmedia.io"
            aria-label="Email us"
            className="grid size-10 place-items-center text-white/50 transition-colors hover:text-white"
          >
            <IconMail className="size-5" />
          </a>
        </div>
        <nav className="mt-12 grid grid-cols-2 gap-10 md:grid-cols-3">
          {columns.map((column) => (
            <div key={column.title}>
              <p className="text-sm font-medium text-white">{column.title}</p>
              <ul className="mt-4 space-y-3">
                {column.links.map(([label, href]) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-sm text-white/45 transition-colors hover:text-white"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </footer>
  );
}

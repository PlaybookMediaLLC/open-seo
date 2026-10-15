import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import defaultMdxComponents from "fumadocs-ui/mdx";
import {
  agentUpdatePrompt,
  getAgentSetupPrompt,
} from "@/client/features/ai-mcp/agentSetupPrompt";

const RELAY_ORIGIN = "https://relay.playbookmedia.io";

/** How to run a skill, styled as a tiny terminal. */
function RunSkillCallout({ command }: { command: string }) {
  return (
    <div className="my-6 overflow-hidden rounded-lg border border-fd-border bg-fd-card">
      <div className="flex items-center gap-1.5 border-b border-fd-border px-4 py-2">
        <span className="size-2 rounded-full bg-fd-muted-foreground/30" />
        <span className="size-2 rounded-full bg-fd-muted-foreground/30" />
        <span className="size-2 rounded-full bg-fd-muted-foreground/30" />
        <span className="ml-2 text-xs font-medium text-fd-muted-foreground">
          Run this skill in your agent
        </span>
      </div>
      <div className="flex items-center gap-3 p-4">
        <span className="font-mono text-sm text-fd-muted-foreground">&gt;</span>
        <code className="font-mono text-base font-semibold text-fd-foreground">
          {command.startsWith("/") ? command : `/${command}`}
        </code>
      </div>
    </div>
  );
}

/** The same setup and update prompts the app shows on its Agent setup page. */
function AgentPrompt({ kind }: { kind: "setup" | "update" }) {
  return (
    <CodeBlock
      title={kind === "setup" ? "Setup prompt" : "Update prompt"}
      viewportProps={{ className: "max-h-64" }}
    >
      <Pre className="whitespace-pre-wrap px-4">
        <code>
          {kind === "setup"
            ? getAgentSetupPrompt(RELAY_ORIGIN)
            : agentUpdatePrompt}
        </code>
      </Pre>
    </CodeBlock>
  );
}

export const docsMdxComponents = {
  ...defaultMdxComponents,
  RunSkillCallout,
  AgentPrompt,
};

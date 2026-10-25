import { ClaudeIcon, OpenAIIcon } from "./AgentIcons";

// playbook-seam: marketplace listings connect to upstream, so Relay uses its setup guides.
export const AGENT_SETUP_LINKS = [
  {
    agent: "chatgpt",
    name: "ChatGPT",
    href: "/docs/chatgpt",
    Icon: OpenAIIcon,
  },
  {
    agent: "claude",
    name: "Claude",
    href: "/docs/claude-code-plugin",
    Icon: ClaudeIcon,
  },
];

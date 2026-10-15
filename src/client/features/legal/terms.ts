import type { LegalDocument } from "./LegalPage";

/**
 * Terms of Service for the hosted Relay service. Plain data so the text can
 * be reviewed and edited without touching layout code. Supports **bold** and
 * [label](href) inside strings.
 */
export const TERMS: LegalDocument = {
  title: "Terms of Service",
  updated: "October 15, 2026",
  summary: [
    "You keep ownership of your content and the data you connect. We use it only to run Relay for you.",
    "Relay prepares changes. You approve them. Relay never merges or deploys anything to your site.",
    "SEO data, AI answers and measured results are estimates, not promises of rankings, traffic or revenue.",
    "Paid plans renew every month until you cancel. Fees are non-refundable unless the law says otherwise.",
    "Do not misuse Relay: no unlawful use, no attacks on websites, and no reselling of our data.",
  ],
  sections: [
    {
      id: "agreement",
      title: "Agreement to these terms",
      blocks: [
        "These Terms of Service (the “Terms”) govern your use of Relay, the hosted SEO service at [relay.playbookmedia.io](https://relay.playbookmedia.io), its MCP server and API, and related websites (together, the “Service”). Playbook Media LLC, a Delaware limited liability company (“Playbook Media”, “we”, “us”), operates the Service. Relay was previously called Playbook Media SEO.",
        "By creating an account or using the Service, you agree to these Terms and to our [Privacy Policy](/privacy). If you do not agree, do not use the Service.",
        "If you use the Service for a company or other organization, you confirm that you can bind it to these Terms, and “you” includes that organization.",
      ],
    },
    {
      id: "eligibility",
      title: "Eligibility and accounts",
      blocks: [
        "You must be at least 16 years old and able to form a binding contract. You sign in with a Google account. We may limit sign-up to invited people or to an approved list of email addresses.",
        "You must give accurate information and keep it current. You are responsible for all activity under your account, for keeping your Google account secure, and for keeping your API keys secret. Tell us at once at [team@playbookmedia.io](mailto:team@playbookmedia.io) if you think someone used your account without permission.",
      ],
    },
    {
      id: "workspaces",
      title: "Workspaces and team members",
      blocks: [
        "You can invite other people to a workspace. Members can see and change the projects and data in that workspace. The person who created the workspace, or who pays for it, controls it, and is responsible for who they invite and for the actions of its members.",
        "If you leave a workspace or lose access to it, the projects and data in it stay with the workspace.",
      ],
    },
    {
      id: "service",
      title: "The Service",
      blocks: [
        "Relay helps you find and fix search opportunities. It includes Search Console and Analytics insights, keyword and domain research, rank tracking, site audits, backlink data, AI visibility tracking, reports, an AI assistant, and tools for AI agents.",
        "We change and improve the Service over time. We may add, change or remove features. Features labelled “beta”, “preview” or “new” may be incomplete and may change or stop at any time. If we remove a paid feature that is material to your plan, we will tell you in advance where we reasonably can.",
      ],
    },
    {
      id: "your-content",
      title: "Your content and connected data",
      blocks: [
        "You keep all rights to the content you add and to the data you connect, including data from Google Search Console, Google Analytics and GitHub (“Your Content”).",
        "You give us a limited, non-exclusive, worldwide license to host, copy, process and display Your Content only to provide, secure and support the Service for you, and as described in our [Privacy Policy](/privacy). This license ends when Your Content is deleted from the Service, except for copies we must keep by law.",
        "You confirm that you have the rights and permissions needed for Your Content, and that you are allowed to connect each website property, analytics property and repository that you add.",
      ],
    },
    {
      id: "approved-changes",
      title: "Changes you approve",
      blocks: [
        "The Service can suggest changes to your website, such as new titles, descriptions or content. If you connect a repository, the Service can open a pull request, but only after you approve it. The Service never merges, publishes or deploys changes.",
        "You are responsible for reviewing, merging and deploying every change, and for the results on your website. Measured results are observations of what happened after a change. They do not prove that the change caused the result.",
      ],
    },
    {
      id: "ai",
      title: "AI features and agent access",
      blocks: [
        "Some features use AI models to write text, summarize data or answer questions. AI output can be wrong, incomplete or similar to output given to other users. Check AI output before you rely on it or publish it. You are responsible for how you use it.",
        "You can connect the Service to AI clients, such as Claude, ChatGPT, Cursor or Codex, through our MCP server or an API key. Actions that a connected client takes with your authorization are treated as your actions. The provider of that client handles the data it receives under its own terms and privacy policy.",
        "Keep API keys secret. Delete any key that you think is exposed. You can create and delete keys in your settings.",
      ],
    },
    {
      id: "data",
      title: "Search data and third-party data",
      blocks: [
        "Keyword volumes, difficulty scores, rankings, backlink counts, AI answers and similar data come from third-party sources and from estimates. This data can be incomplete, delayed or wrong. Search engines and AI assistants change their results often and do not tell us how.",
        "You may use this data for your own business and for your clients. You may not resell, republish or redistribute raw data from the Service as a standalone data product or database.",
      ],
    },
    {
      id: "acceptable-use",
      title: "Acceptable use",
      blocks: [
        "You agree not to, and not to let anyone else:",
        {
          list: [
            "use the Service for anything unlawful, deceptive or harmful, or to infringe the rights of others;",
            "access accounts, data, properties or repositories that you are not authorized to use;",
            "use crawling, audit or research features to overload, attack or gain unauthorized access to any website or system;",
            "probe, scan or test the security of the Service, or bypass its security, rate limits or credit limits;",
            "create accounts by automated means, share accounts to avoid paying, or abuse free plans or referral offers;",
            "copy, scrape or resell the Service or its data, except as these Terms allow;",
            "upload malware, or use the Service to send spam or to manipulate search results through spam, cloaking or link schemes that break search engine rules;",
            "use the Service to build a competing data product.",
          ],
        },
        "We may investigate suspected misuse and may remove content or limit access to protect the Service, our users or others.",
      ],
    },
    {
      id: "billing",
      title: "Plans, credits and billing",
      blocks: [
        "The Free plan includes a monthly allowance of usage credits. Paid plans include a larger monthly allowance and more features. Current prices, allowances and features are shown on our [pricing section](/#pricing) and in the Service before you buy.",
        {
          list: [
            "**Credits.** Some features use credits, because the data behind them costs us money. The Service shows the cost before you run a lookup where it can. Monthly credits reset at the start of each billing period and do not roll over.",
            "**Top-ups.** You can buy extra credits. Purchased top-up credits do not expire while your account is open. They have no cash value, cannot be transferred, and end when your account closes.",
            "**Subscriptions.** Paid plans are billed monthly in advance and renew automatically until you cancel. You can cancel at any time in your billing settings. Cancellation takes effect at the end of the current billing period, and you keep paid features until then.",
            "**Payments.** Stripe processes payments through our billing provider, Autumn. You authorize us to charge your payment method for your plan and for any top-ups you buy. You are responsible for any taxes on your purchases, other than taxes on our income.",
            "**Failed payments.** If a payment fails, we may retry it, move your workspace to the Free plan, or pause paid features until the payment succeeds.",
            "**Price changes.** We will give you at least 30 days’ notice before a price change applies to your subscription. If you do not agree, you can cancel before the change takes effect.",
            "**Refunds.** Fees are non-refundable, and we do not give refunds or credits for partial periods or unused credits, except where the law requires it.",
          ],
        },
      ],
    },
    {
      id: "sharing",
      title: "Shared reports and links",
      blocks: [
        "You can create reports and share them by link. Anyone who has the link can view the shared content, and can forward it to others. Share only what you are comfortable making visible to anyone with the link. You can stop sharing or delete a report in the Service.",
      ],
    },
    {
      id: "feedback",
      title: "Feedback",
      blocks: [
        "If you send us ideas, suggestions or other feedback, we may use them without any obligation to you.",
      ],
    },
    {
      id: "ip",
      title: "Our intellectual property",
      blocks: [
        "The Service, including its design, software, text, graphics and the Relay name and logo, belongs to Playbook Media or its licensors. These Terms give you a limited, non-exclusive, non-transferable right to use the Service while your account is active. We keep all rights that these Terms do not expressly give you.",
      ],
    },
    {
      id: "third-parties",
      title: "Third-party services",
      blocks: [
        "The Service works with services from other companies, such as Google, GitHub, Cloudflare, Stripe, DataForSEO, OpenRouter and the AI clients you connect. Their own terms apply to your use of them. We are not responsible for their services, content, availability or changes, and we may stop supporting a third-party service if it changes or ends.",
      ],
    },
    {
      id: "security",
      title: "Security and availability",
      blocks: [
        "We use reasonable technical and organizational measures to protect the Service and Your Content. No system is completely secure, and we cannot promise that unauthorized access will never happen.",
        "We try to keep the Service available, but we do not promise that it will be uninterrupted or free of errors. We may pause the Service for maintenance, security or reasons outside our control.",
      ],
    },
    {
      id: "termination",
      title: "Suspension and termination",
      blocks: [
        "You can stop using the Service at any time, and you can ask us to delete your account.",
        "We may suspend or end your access if you break these Terms, do not pay, create risk or legal exposure for us or others, or if we must do so by law. Where reasonable, we will tell you first and give you a chance to fix the problem.",
        "When your account ends, your right to use the Service ends. We delete Your Content as described in our [Privacy Policy](/privacy). Sections that by their nature should continue, such as payment obligations, disclaimers, limits of liability and indemnity, continue after termination.",
      ],
    },
    {
      id: "disclaimers",
      title: "Disclaimers",
      blocks: [
        "The Service is provided “as is” and “as available”. To the maximum extent the law allows, we disclaim all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, title, non-infringement, and accuracy of data.",
        "We do not promise any particular ranking, traffic, citation by an AI assistant, revenue or other result. Search engines and AI assistants decide their own results.",
      ],
    },
    {
      id: "liability",
      title: "Limitation of liability",
      blocks: [
        "To the maximum extent the law allows, Playbook Media and its members, employees and suppliers are not liable for any indirect, incidental, special, consequential or punitive damages, or for lost profits, revenue, traffic, rankings, goodwill or data, even if we were told they were possible.",
        "To the maximum extent the law allows, our total liability for all claims about the Service or these Terms is limited to the amount you paid us for the Service in the 12 months before the event that caused the claim.",
        "Some places do not allow some of these limits. In those places, the limits apply only as far as the law allows.",
      ],
    },
    {
      id: "indemnity",
      title: "Indemnity",
      blocks: [
        "To the extent the law allows, you will defend and indemnify Playbook Media against claims, losses and costs, including reasonable legal fees, that come from Your Content, from changes you publish to your website, or from your breach of these Terms or of the law.",
      ],
    },
    {
      id: "law",
      title: "Governing law and disputes",
      blocks: [
        "These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict-of-law rules. The state and federal courts located in Delaware have exclusive jurisdiction over any dispute about the Service or these Terms, and you and we agree to their jurisdiction.",
        "Before you start a legal claim, please contact us at [team@playbookmedia.io](mailto:team@playbookmedia.io) so we can try to solve the problem informally. Nothing in these Terms limits rights that you have as a consumer under the law where you live.",
      ],
    },
    {
      id: "changes",
      title: "Changes to these terms",
      blocks: [
        "We may update these Terms. We will post the new version here and change the date at the top. If a change is material, we will tell you by email or in the Service at least 14 days before it takes effect, unless the change is needed for legal or security reasons. If you keep using the Service after a change takes effect, you accept the new Terms.",
      ],
    },
    {
      id: "general",
      title: "General terms",
      blocks: [
        {
          list: [
            "**Entire agreement.** These Terms and the Privacy Policy are the whole agreement between you and us about the Service.",
            "**Severability.** If a court finds part of these Terms unenforceable, the rest stays in effect.",
            "**No waiver.** If we do not enforce a right, we do not give up that right.",
            "**Assignment.** You may not transfer these Terms without our written consent. We may transfer them as part of a merger, acquisition or sale of assets, with notice to you.",
            "**Force majeure.** Neither of us is liable for delays caused by events outside reasonable control, such as outages of internet or cloud providers, natural disasters or government action.",
            "**Notices.** We send notices to the email address on your account. You send notices to [team@playbookmedia.io](mailto:team@playbookmedia.io).",
          ],
        },
      ],
    },
    {
      id: "contact",
      title: "Contact",
      blocks: [
        "Playbook Media LLC · [team@playbookmedia.io](mailto:team@playbookmedia.io)",
      ],
    },
  ],
};

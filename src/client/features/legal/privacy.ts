import type { LegalDocument } from "./LegalPage";

/**
 * Privacy Policy for the hosted Relay service. Keep it true to the code:
 * update it when providers, scopes, cookies or retention change. Supports
 * **bold** and [label](href) inside strings.
 */
export const PRIVACY: LegalDocument = {
  title: "Privacy Policy",
  updated: "October 30, 2026",
  summary: [
    "We collect what we need to run Relay: your Google sign-in details, the data you connect, and what you create.",
    "Search Console and Analytics access is read-only. You can disconnect it at any time.",
    "We do not sell your data, we do not use it for ads, and we do not use Google user data to train AI models.",
    "We share data only with the providers that run the Service, and with the AI clients and people you choose.",
    "You can ask us to see, export, correct or delete your data at team@playbookmedia.io.",
  ],
  sections: [
    {
      id: "who-we-are",
      title: "Who we are",
      blocks: [
        "Playbook Media LLC, a Delaware limited liability company (“Playbook Media”, “we”, “us”), operates Relay, the hosted SEO service at [relay.playbookmedia.io](https://relay.playbookmedia.io), with its MCP server, API and related websites (the “Service”). Relay was previously called Playbook Media SEO, and you may still see that name on Google’s sign-in and permission screens.",
        "This policy explains what personal information we collect, how we use and share it, and the choices and rights you have. For the purposes of data protection law, Playbook Media is the controller of your personal information. Our [Terms of Service](/terms) also apply.",
      ],
    },
    {
      id: "collect",
      title: "Information we collect",
      blocks: [
        { heading: "Information you give us or connect" },
        {
          list: [
            "**Account information.** When you sign in with Google, we receive your name, email address and profile picture. We do not collect or store passwords.",
            "**Google Search Console and Google Analytics data.** If you choose to connect them, we ask for read-only access (the webmasters.readonly and analytics.readonly scopes). We read search performance (queries, pages, clicks, impressions and positions), URL inspection results, and analytics reports for the properties you select.",
            "**GitHub access.** If you connect a repository so the Service can prepare pull requests, we store the fine-grained access token you give us, encrypted at rest, with the repository, branch, proposal and pull request details we need to show you what changed.",
            "**Content you create.** Projects, project context (such as your site, goals, audience and competitors), saved keywords, rank trackers, audits, opportunities, review decisions, proposals, experiments, reports, and your conversations with the AI assistant.",
            "**Research you run.** The keywords, domains, URLs and prompts you look up, and the results we return.",
            "**Team information.** The email addresses of people you invite to a workspace, and their roles.",
            "**Billing information.** Your plan, credit balance, purchases and invoices. Stripe processes payments through our billing provider, Autumn. We do not receive or store full card numbers.",
            "**API keys and agent connections.** The API keys you create, stored in hashed form, and records of the AI clients you authorize through our MCP server.",
            "**Messages to us.** What you send when you email us for support or feedback.",
          ],
        },
        { heading: "Information collected automatically" },
        {
          list: [
            "**Technical data.** IP address, browser and device information, and request and error logs that we need to operate, secure and debug the Service.",
            "**Abuse prevention.** Cloudflare Turnstile may process browser signals to tell people from bots on sign-in and other forms.",
            "**Usage records.** Which features use credits, and when, so we can meter credits and show you your usage.",
          ],
        },
      ],
    },
    {
      id: "use",
      title: "How we use information",
      blocks: [
        {
          list: [
            "To provide the Service: sign you in, show your data, find SEO opportunities, run the research and audits you ask for, prepare changes you approve, and measure their results.",
            "To run the AI assistant and the agent tools you use.",
            "To meter credits, bill for paid plans and prevent payment fraud.",
            "To secure the Service, prevent abuse, and find and fix problems.",
            "To answer your questions and give support.",
            "To tell you about your account, security, and important changes to the Service or to our policies.",
            "To meet legal obligations and to enforce our [Terms of Service](/terms).",
          ],
        },
        "We do not sell personal information. We do not use it for advertising, and we do not build advertising profiles.",
      ],
    },
    {
      id: "legal-bases",
      title: "Legal bases for processing",
      blocks: [
        "If you are in the European Economic Area, the United Kingdom or Switzerland, we rely on these legal bases:",
        {
          list: [
            "**Contract:** to provide the Service that you signed up for.",
            "**Consent:** to access the Google and GitHub data that you choose to connect. You can withdraw consent at any time by disconnecting.",
            "**Legitimate interests:** to secure the Service, prevent abuse, improve features and communicate with you about the Service. These interests do not override your rights.",
            "**Legal obligation:** to keep records that tax and other laws require.",
          ],
        },
      ],
    },
    {
      id: "google",
      title: "Google user data",
      blocks: [
        "Relay’s use and transfer of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements. Specifically:",
        {
          list: [
            "We use Google Search Console and Google Analytics data only to provide and improve the user-facing features you use in the Service.",
            "We do not transfer this data to others, except as needed to provide those features (including to an AI client that you connect and ask to read it), to comply with law, or as part of a merger, acquisition or sale of assets with notice to you. Our hosting provider, Cloudflare, and our monitoring provider, Axiom, process records of the requests that we make to Google APIs. These records can include a property address or ID, but not report data.",
            "We do not use this data for advertising, and we do not sell it.",
            "We do not allow humans to read this data unless you give us explicit permission, it is necessary for security purposes or to comply with law, or the data is aggregated and anonymized for internal operations.",
            "We do not use Google user data to develop, improve or train generalized AI or machine-learning models.",
          ],
        },
        "You can disconnect Search Console or Analytics in the Service at any time, and revoke access at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).",
      ],
    },
    {
      id: "ai",
      title: "AI features and connected agents",
      blocks: [
        "**AI assistant.** When you use an AI feature, we send your request, and the project data needed to answer it, to an AI model provider through OpenRouter. The provider processes it to return an answer, under its own terms. We send only what the request needs, and we do not use your content or Google user data to train AI models.",
        "**AI clients you connect.** If you connect an AI client such as Claude, ChatGPT, Cursor or Codex through our MCP server or an API key, the tool results you ask for are sent to that client. These results can include your Search Console and Analytics data. The provider of that client handles the data under its own privacy policy. You can delete an API key at any time in your settings, or ask us to remove a client’s access.",
      ],
    },
    {
      id: "share",
      title: "How we share information",
      blocks: [
        "We share information only in these cases:",
        {
          list: [
            "**Service providers** that help us run the Service, under contracts that limit their use of it: Cloudflare (hosting, database, security and bot protection), Google (sign-in and the APIs you connect), GitHub (only when you connect a repository), Autumn and Stripe (billing), DataForSEO (keyword, SERP, backlink and AI-answer research, which receives keywords, domains and URLs but not your Google data), OpenRouter with the AI model providers it routes to (only when you use AI features), Trigger.dev (timing of the scheduled jobs you turn on, which receives project and job identifiers but not your Google data or site content), and Axiom (error and performance monitoring, which receives technical records of a small sample of requests for up to 30 days: page and API addresses, timings, and status and error codes; these can include the address of a Search Console property or the ID of an Analytics property, but not your reports, request bodies, passwords or sign-in tokens).",
            "**People you choose.** Members of your workspace can see its projects and data. Anyone with a report link that you share can see that report.",
            "**AI clients you connect**, as described above.",
            "**Legal reasons.** When we must do so by law, or to protect the rights, safety and security of our users, the public or Playbook Media.",
            "**Business transfers.** As part of a merger, acquisition or sale of assets. We will tell you before your information becomes subject to a different privacy policy.",
          ],
        },
      ],
    },
    {
      id: "cookies",
      title: "Cookies and similar technologies",
      blocks: [
        "We use cookies that the Service needs to work: a session cookie that keeps you signed in, and security cookies for sign-in and abuse prevention, including Cloudflare Turnstile. We also store a few preferences in your browser, such as layout and filter settings.",
        "We do not use advertising cookies or cross-site tracking. We do not currently use third-party product analytics. If we start to use product analytics, we will update this policy first. Our error and performance monitoring provider, Axiom, receives records from our servers only and sets no cookies.",
      ],
    },
    {
      id: "transfers",
      title: "International transfers",
      blocks: [
        "We are based in the United States, and our providers process information in the United States and in other countries where they operate. When we transfer personal information from the European Economic Area, the United Kingdom or Switzerland, we rely on safeguards that the law allows, such as the European Commission’s Standard Contractual Clauses.",
      ],
    },
    {
      id: "retention",
      title: "Retention and deletion",
      blocks: [
        "We keep your information while your account is active. You can delete projects, reports and API keys at any time.",
        "To delete your account and its data, email [team@playbookmedia.io](mailto:team@playbookmedia.io) from the address on your account. We complete deletion within 30 days. Copies in backups and logs are deleted on their normal schedule. We keep billing records for as long as tax and accounting laws require.",
        "When you disconnect Search Console, Analytics or GitHub, we stop collecting new data from that service and delete the stored tokens.",
      ],
    },
    {
      id: "security",
      title: "Security",
      blocks: [
        "We encrypt data in transit. We encrypt OAuth and GitHub tokens at rest, and we store API keys in hashed form. We limit access to production systems to people who need it. No system is completely secure. If we learn of a breach that affects your personal information, we will tell you as the law requires.",
      ],
    },
    {
      id: "rights",
      title: "Your rights and choices",
      blocks: [
        "Depending on where you live, you may have the right to:",
        {
          list: [
            "access the personal information we hold about you and get a copy of it;",
            "correct information that is wrong;",
            "delete your information;",
            "export your information in a portable format;",
            "object to or restrict some processing;",
            "withdraw consent, for example by disconnecting a Google or GitHub connection.",
          ],
        },
        "To use these rights, email [team@playbookmedia.io](mailto:team@playbookmedia.io). We may need to confirm your identity first. We answer within 30 days. We will not treat you differently because you used your rights.",
        "If you are in the European Economic Area, the United Kingdom or Switzerland, you can also complain to your local data protection authority.",
      ],
    },
    {
      id: "california",
      title: "California residents",
      blocks: [
        "In the past 12 months we collected the categories of information described in this policy: identifiers (such as name and email address), commercial information (such as plan and purchases), internet activity (such as logs and usage records), and the content you create or connect. We use and share them only for the business purposes described above.",
        "We do not sell personal information, and we do not share it for cross-context behavioral advertising. We do not use or disclose sensitive personal information for purposes that require a right to limit. You, or an agent you authorize, can ask to know, correct or delete your information as described in the section above.",
      ],
    },
    {
      id: "children",
      title: "Children",
      blocks: [
        "The Service is not directed to children under 16, and we do not knowingly collect their personal information. If you think a child has given us information, contact us and we will delete it.",
      ],
    },
    {
      id: "changes",
      title: "Changes to this policy",
      blocks: [
        "We will post changes here and update the date at the top. If a change is material, we will tell you by email or in the Service before it takes effect.",
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

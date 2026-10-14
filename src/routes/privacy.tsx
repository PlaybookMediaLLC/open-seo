import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/client/features/legal/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy · Playbook Media SEO" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 14, 2026">
      <p>
        Playbook Media LLC (“Playbook Media”, “we”, “us”) operates Playbook
        Media SEO at https://seo.playbookmedia.io (the “Service”). This policy
        explains what personal information we collect, how we use it, and the
        choices you have.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information.</strong> When you sign in with Google we
          receive your name, email address and profile picture. We do not
          collect or store passwords.
        </li>
        <li>
          <strong>Google Search Console and Google Analytics data.</strong> If
          you choose to connect them, we request read-only access
          (webmasters.readonly and analytics.readonly). We read search
          performance (queries, pages, clicks, impressions, positions), URL
          inspection results, and analytics reports for the properties you
          select.
        </li>
        <li>
          <strong>GitHub access.</strong> If you connect a repository to prepare
          metadata pull requests, we store the fine-grained access token you
          provide, encrypted at rest, and the repository, branch, proposal and
          pull request details needed to show you what was changed.
        </li>
        <li>
          <strong>Content you create.</strong> Projects, keywords,
          opportunities, review decisions, proposals, experiment notes and
          reports.
        </li>
        <li>
          <strong>Billing information.</strong> Payments are processed by Stripe
          through our billing provider Autumn. We do not receive or store full
          card numbers.
        </li>
        <li>
          <strong>Technical data.</strong> IP address, browser and device
          information, and request logs needed to operate, secure and debug the
          Service. Cloudflare Turnstile may process browser signals to prevent
          automated abuse.
        </li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>
          To provide the Service: sign you in, show your data, detect SEO
          opportunities, prepare changes you approve and measure their results.
        </li>
        <li>To secure the Service, prevent abuse and fix problems.</li>
        <li>To bill for paid features.</li>
        <li>
          To contact you about your account or material changes to the Service.
        </li>
      </ul>
      <p>
        We do not sell personal information and we do not use it for
        advertising.
      </p>

      <h2>Google user data</h2>
      <p>
        Playbook Media SEO's use and transfer of information received from
        Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements. Specifically:
      </p>
      <ul>
        <li>
          We use Google Search Console and Google Analytics data only to provide
          and improve the user-facing features you use in the Service.
        </li>
        <li>
          We do not transfer this data to others except as needed to provide
          those features, to comply with law, or as part of a merger or
          acquisition with notice to you.
        </li>
        <li>We do not use this data for advertising, and we do not sell it.</li>
        <li>
          We do not allow humans to read this data unless you give us explicit
          permission, it is necessary for security purposes or to comply with
          law, or the data is aggregated and anonymized for internal operations.
        </li>
        <li>
          We do not use Google user data to develop, improve or train
          generalized AI or machine-learning models.
        </li>
      </ul>
      <p>
        You can disconnect Search Console or Analytics in the Service at any
        time, and revoke access at{" "}
        <a href="https://myaccount.google.com/permissions">
          myaccount.google.com/permissions
        </a>
        .
      </p>

      <h2>Service providers</h2>
      <p>
        We share information only with providers that help us run the Service,
        under contracts that limit their use of it: Cloudflare (hosting,
        database, security), Google (sign-in and the APIs you connect), GitHub
        (only when you connect a repository), Autumn and Stripe (billing),
        DataForSEO (keyword and SERP research queries, which contain keywords
        and domains but not your Google data), and, when you use AI features, an
        AI model provider that receives the prompt you submit.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        We keep your information while your account is active. You can delete
        projects at any time. To delete your account and associated data, email
        us at the address below; we will complete deletion within 30 days,
        except where we must keep records to comply with law.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit. OAuth and GitHub tokens are encrypted at
        rest. Access to production systems is restricted.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct,
        export or delete your personal information, or to object to certain
        processing. Contact us to exercise them.
      </p>

      <h2>Children</h2>
      <p>The Service is not directed to children under 16.</p>

      <h2>Changes</h2>
      <p>
        We will post changes here and update the date above. Material changes
        will be notified by email or in the Service.
      </p>

      <h2>Contact</h2>
      <p>
        Playbook Media LLC ·{" "}
        <a href="mailto:team@playbookmedia.io">team@playbookmedia.io</a>
      </p>
    </LegalPage>
  );
}

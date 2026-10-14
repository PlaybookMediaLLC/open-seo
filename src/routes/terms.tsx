import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/client/features/legal/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms of Service · Playbook Media SEO" }] }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="October 14, 2026">
      <p>
        These terms govern your use of Playbook Media SEO at
        https://seo.playbookmedia.io (the “Service”), operated by Playbook Media
        LLC (“Playbook Media”, “we”, “us”). By using the Service you agree to
        these terms. If you use the Service for an organization, you accept them
        on its behalf.
      </p>

      <h2>1. Accounts</h2>
      <p>
        You sign in with a Google account. You are responsible for activity
        under your account and for keeping your Google account secure. You must
        be at least 16 and provide accurate information.
      </p>

      <h2>2. Your data and connected services</h2>
      <p>
        You keep all rights to your content and to the data you connect,
        including Google Search Console, Google Analytics and GitHub. You give
        us permission to process it only to provide the Service to you. Our{" "}
        <a href="/privacy">Privacy Policy</a> explains how we handle it. You
        must have the right to connect any property or repository you add.
      </p>

      <h2>3. Changes you approve</h2>
      <p>
        The Service can prepare website changes and, only after your explicit
        approval, open pull requests in a repository you connect. It never
        merges or deploys changes. You are responsible for reviewing, merging
        and deploying any change, and for the results on your website. Measured
        results are observations, not guarantees of ranking, traffic or revenue.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          use the Service for unlawful activity or to infringe others' rights;
        </li>
        <li>access data or accounts you are not authorized to use;</li>
        <li>
          interfere with, overload or attempt to bypass the Service's security
          or usage limits;
        </li>
        <li>
          use automated means to create accounts or resell the Service as a
          standalone data product.
        </li>
      </ul>

      <h2>5. Paid features and billing</h2>
      <p>
        Some features consume usage credits or require a paid plan. Prices are
        shown before purchase. Payments are processed by Stripe through our
        billing provider. Subscriptions renew until cancelled. Fees are
        non-refundable except where required by law.
      </p>

      <h2>6. Third-party services</h2>
      <p>
        The Service relies on third parties such as Google, GitHub, Cloudflare,
        Stripe and DataForSEO. Their terms also apply to your use of them, and
        we are not responsible for their availability.
      </p>

      <h2>7. Open source</h2>
      <p>
        The Service is built on OpenSEO, which is available under the MIT
        License. These terms govern the hosted Service, not the open-source
        code.
      </p>

      <h2>8. Suspension and termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or end access
        for violation of these terms, non-payment or to protect the Service or
        others. You can request deletion of your data as described in the
        Privacy Policy.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        The Service is provided “as is” and “as available”, without warranties
        of any kind, including fitness for a particular purpose and accuracy of
        third-party data.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Playbook Media is not liable for
        indirect, incidental, special or consequential damages, or lost profits,
        revenue or data. Our total liability for any claim is limited to the
        amount you paid us in the 12 months before the claim.
      </p>

      <h2>11. Changes to these terms</h2>
      <p>
        We may update these terms. We will post changes here and update the date
        above. Continued use after changes take effect means you accept them.
      </p>

      <h2>12. Governing law</h2>
      <p>
        These terms are governed by the laws of the State of New Jersey, United
        States, without regard to conflict-of-law rules.
      </p>

      <h2>13. Contact</h2>
      <p>
        Playbook Media LLC ·{" "}
        <a href="mailto:team@playbookmedia.io">team@playbookmedia.io</a>
      </p>
    </LegalPage>
  );
}

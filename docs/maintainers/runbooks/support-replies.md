# Support saved replies (Relay)

Use these replies for mail to `team@playbookmedia.io`. Answer within 1 business day. Change the details to fit the question, and never ask a user to send a token, a password or a key.

## Google connection problems

> Thanks for writing. Relay reads Search Console with read-only access. Please check three things:
>
> 1. Sign in to Google with an account that can see the property in Search Console. A Full or Restricted user is enough.
> 2. In Relay, open your project, then **Project settings → Integrations**, and click **Connect** under Google Search Console. Choose the property that matches your website, for example `sc-domain:example.com`.
> 3. If Google shows "This app isn't verified", click **Advanced**, then **Go to Relay**. Google is still reviewing our app, and the data access stays read-only.
>
> If it still fails, reply with the exact message on the screen and the time it happened. Our help page is https://relay.playbookmedia.io/docs/google-search-console.

## GitHub setup

> Thanks for writing. The simplest way to connect a repository is the Relay GitHub App:
>
> 1. Open your project, then **Project settings → Integrations → GitHub publishing**.
> 2. Click **Install GitHub App** and choose only the repository of your website.
> 3. Back in Relay, click **Choose a repository from the App**, pick it, and connect.
>
> Relay opens a pull request only after you approve the exact change, and it never merges or deploys. Please do not send us a token by email. The full guide is https://relay.playbookmedia.io/docs/github-publishing.

## Credit questions

> Thanks for writing. Every plan includes monthly credits: 1,000 on Free and 10,000 on Base. A top-up costs $1 for 1,000 credits. Research tools, site audits and the assistant use credits. Search Console detection and GitHub publishing use none.
>
> You can see your balance and your usage by feature on the **Billing** page. If a charge looks wrong, reply with the date and the feature, and we will check it.

## Data deletion

> Thanks for writing. We will delete your Relay account and all of its data. This includes your projects, your Search Console and Analytics connections, stored GitHub tokens and your billing records with our payment provider. We also revoke Relay's access to your Google account.
>
> To protect your account, please send this request from the email address you use to sign in to Relay. We will confirm by email when the deletion is complete, within 30 days.

To run the deletion, follow `delete-user-data.md`. If the user shares an organization with other members, remove them from it first.

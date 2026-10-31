/**
 * Playbook fork: the link in a password reset or verification email. Better
 * Auth puts the token in the URL (`/api/auth/reset-password/<token>`,
 * `/api/auth/verify-email?token=`), so request logs and traces record it.
 * This link opens our page with the token in the fragment instead. Browsers
 * never send the fragment; the page posts the token in a request body
 * (src/client/features/auth/linkToken.ts).
 *
 * Only the `redirect` of Better Auth's callbackURL is kept, so the token can
 * only reach our own page.
 */
export function linkWithToken(
  authUrl: string,
  pagePath: "/reset-password" | "/verify-email",
  token: string,
) {
  const link = new URL(pagePath, authUrl);
  const callbackURL = new URL(authUrl).searchParams.get("callbackURL");
  const redirect = callbackURL
    ? URL.parse(callbackURL, authUrl)?.searchParams.get("redirect")
    : null;
  if (redirect) link.searchParams.set("redirect", redirect);
  link.hash = new URLSearchParams({ token }).toString();
  return link.toString();
}

import { env } from "cloudflare:workers";
import { sendHostedInvitationEmail as sendLoopsInvitationEmail } from "@/server/email/loops";
import { AppError } from "@/server/lib/errors";
import { getOptionalEnvValue } from "@/server/lib/runtime-env";

// Playbook fork: Relay sends team invites through Cloudflare Email Sending
// (Workers Paid includes 3,000 emails a month). Loops keeps the customer list
// for product updates. Without the EMAIL binding (local dev, Docker), the
// upstream Loops path runs. The deploy binds EMAIL (deploy/alchemy), and the
// sender subdomain must be onboarded in Cloudflare Email Service.
const FROM = { name: "Relay", email: "invites@mail.playbookmedia.io" };

type Invitation = Parameters<typeof sendLoopsInvitationEmail>[0];

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

export async function sendHostedInvitationEmail(invite: Invitation) {
  const sender = env.EMAIL;
  if (!sender) return sendLoopsInvitationEmail(invite);

  const { email, inviteUrl, organizationName, inviterName, inviterEmail } =
    invite;
  const line = `${inviterName} (${inviterEmail}) invited you to join ${organizationName} on Relay.`;
  await sender.send({
    from: FROM,
    to: email,
    replyTo: inviterEmail,
    // Names are user input: no line breaks in the subject.
    subject:
      `${inviterName} invited you to ${organizationName} on Relay`.replace(
        /\s+/g,
        " ",
      ),
    text: `${line}\n\nAccept the invitation: ${inviteUrl}\n\nIf you did not expect this email, you can ignore it.`,
    html: `<p>${escapeHtml(line)}</p><p><a href="${escapeHtml(inviteUrl)}">Accept the invitation</a></p><p style="color:#666">If you did not expect this email, you can ignore it.</p>`,
  });
}

/** Whether this deployment can send Relay's own emails (the EMAIL binding). */
export function relayEmailConfigured(): boolean {
  return Boolean(env.EMAIL);
}

// RFC-0026 phase A: the test alert a protected site's reviewer confirms.
const ALERT_FROM = {
  name: "Relay",
  email: "notifications@mail.playbookmedia.io",
};

export async function sendProtectionAlertEmail(alert: {
  to: string;
  projectId: string;
  projectName: string;
  productionOrigin: string;
}) {
  const sender = env.EMAIL;
  if (!sender)
    throw new AppError(
      "VALIDATION_ERROR",
      "Email sending is not set up on this deployment.",
    );
  const origin =
    (await getOptionalEnvValue("BETTER_AUTH_URL")) ??
    "https://relay.playbookmedia.io";
  const settingsUrl = `${origin}/p/${encodeURIComponent(alert.projectId)}/settings/protection`;
  const line = `This is a test alert for ${alert.productionOrigin} (${alert.projectName}). Once scheduled checks run, Relay will send this site's incident alerts to this address.`;
  await sender.send({
    from: ALERT_FROM,
    to: alert.to,
    // Names are user input: no line breaks in the subject.
    subject: `Relay test alert for ${alert.projectName}`.replace(/\s+/g, " "),
    text: `${line}\n\nConfirm that you received it: ${settingsUrl}`,
    html: `<p>${escapeHtml(line)}</p><p><a href="${escapeHtml(settingsUrl)}">Confirm that you received it</a></p>`,
  });
}

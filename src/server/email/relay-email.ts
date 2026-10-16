import { env } from "cloudflare:workers";
import { sendHostedInvitationEmail as sendLoopsInvitationEmail } from "@/server/email/loops";

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

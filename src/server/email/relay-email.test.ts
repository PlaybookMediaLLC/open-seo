import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendHostedInvitationEmail as sendLoopsInvitationEmail } from "@/server/email/loops";
import { sendHostedInvitationEmail } from "./relay-email";

const mocks = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  send: vi.fn<(message: Record<string, string>) => Promise<unknown>>(),
}));
vi.mock("cloudflare:workers", () => ({ env: mocks.env }));
vi.mock("@/server/email/loops", () => ({
  sendHostedInvitationEmail: vi.fn(),
}));

const invite = {
  email: "new@example.com",
  inviteUrl: "https://relay.playbookmedia.io/accept-invitation/inv_1",
  organizationName: "<b>Acme</b>\nCo",
  inviterName: "Ada",
  inviterEmail: "ada@example.com",
};

describe("sendHostedInvitationEmail", () => {
  beforeEach(() => {
    mocks.env.EMAIL = { send: mocks.send };
    mocks.send.mockResolvedValue({ messageId: "m1" });
  });

  it("sends through the Cloudflare binding with user input escaped", async () => {
    await sendHostedInvitationEmail(invite);

    const message = mocks.send.mock.calls[0][0];
    expect(message).toMatchObject({
      to: "new@example.com",
      replyTo: "ada@example.com",
      subject: "Ada invited you to <b>Acme</b> Co on Relay",
    });
    expect(message.html).toContain("&#60;b&#62;Acme&#60;/b&#62;");
    expect(sendLoopsInvitationEmail).not.toHaveBeenCalled();
  });

  it("falls back to Loops without the binding", async () => {
    delete mocks.env.EMAIL;

    await sendHostedInvitationEmail(invite);

    expect(sendLoopsInvitationEmail).toHaveBeenCalledWith(invite);
  });
});

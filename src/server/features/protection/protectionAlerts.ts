import { and, eq, isNotNull } from "drizzle-orm";
import { protectionEnrollments } from "@/db/schema";
import { consumeEmailSendBudget } from "@/server/auth/invitation-send-limit";
import { requireOrgPermission } from "@/server/auth/org-gate";
import {
  relayEmailConfigured,
  sendProtectionAlertEmail,
} from "@/server/email/relay-email";
import { AppError } from "@/server/lib/errors";
import {
  audit,
  conflict,
  MANAGE,
  requireEnrollment,
  reviewerCandidates,
  type ProtectionContext,
} from "./protectionAccess";
import { ProtectionRepository } from "./repositories/ProtectionRepository";

// RFC-0026 phase A (IRFC-0001): the reviewer's tested alert channel. Test
// alerts share the organization's daily email allowance with invitations.
const TEST_ALERTS_PER_DAY = 3;

export async function sendTestAlert(context: ProtectionContext): Promise<void> {
  requireOrgPermission(context, MANAGE);
  const enrollment = await requireEnrollment(context.project.id);
  const reviewerUserId = enrollment.reviewerUserId;
  if (!reviewerUserId)
    throw new AppError("VALIDATION_ERROR", "Choose a reviewer first.");
  const reviewer = (await reviewerCandidates(context, reviewerUserId)).find(
    (candidate) => candidate.userId === reviewerUserId,
  );
  if (!reviewer)
    throw new AppError(
      "VALIDATION_ERROR",
      "The reviewer is no longer a member of this organization.",
    );
  if (!relayEmailConfigured())
    throw new AppError(
      "VALIDATION_ERROR",
      "Email sending is not set up on this deployment.",
    );
  await consumeEmailSendBudget(context.organizationId, {
    key: `protection-alerts:${enrollment.id}`,
    limit: TEST_ALERTS_PER_DAY,
    message: "This site has already sent its test alerts for today.",
  });
  await sendProtectionAlertEmail({
    to: reviewer.email,
    projectId: context.project.id,
    projectName: context.project.name,
    productionOrigin: enrollment.productionOrigin,
  });
  await ProtectionRepository.markAlertTested(enrollment.id, reviewerUserId);
}

export async function confirmAlert(context: ProtectionContext): Promise<void> {
  const enrollment = await requireEnrollment(context.project.id);
  if (enrollment.reviewerUserId !== context.userId)
    throw new AppError(
      "FORBIDDEN",
      "Only the reviewer can confirm the test alert.",
    );
  if (!enrollment.alertTestedAt)
    throw new AppError("VALIDATION_ERROR", "Send a test alert first.");
  if (enrollment.alertConfirmedAt) return;
  const landed = await ProtectionRepository.updateEnrollment({
    enrollmentId: enrollment.id,
    userId: context.userId,
    set: { alertConfirmedAt: new Date().toISOString() },
    where: and(
      eq(protectionEnrollments.reviewerUserId, context.userId),
      isNotNull(protectionEnrollments.alertTestedAt),
    ),
    audit: audit(
      context,
      enrollment.id,
      "protection.alert_confirmed",
      "Confirmed the protection test alert",
    ),
  });
  if (!landed) throw conflict();
}

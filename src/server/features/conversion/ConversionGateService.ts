import { eq } from "drizzle-orm";
import { db } from "@/db";
import { runBatch } from "@/db/runBatch";
import { projectConversionEvents } from "@/db/schema";
import { hasOrgPermission } from "@/lib/org-permissions";
import { requireOrgPermission } from "@/server/auth/org-gate";
import { auditInsert } from "@/server/features/activity/auditLog";
import { Ga4ConnectionRepository } from "@/server/features/ga4/repositories/Ga4ConnectionRepository";
import { Ga4MeasurementHealthService } from "@/server/features/ga4/services/Ga4MeasurementHealthService";
import { Ga4ReportingService } from "@/server/features/ga4/services/Ga4ReportingService";
import {
  authorize,
  type OpportunityContext,
} from "@/server/features/opportunities/services/opportunityAccess";
import { Ga4ReportError } from "@/server/lib/ga4Errors";

// RFC-0012 5.2: the tracking gate. Conversion work starts only when GA4 can
// support a decision; otherwise the owner sees what to set up in GA4.
const MIN_EVENTS = 30;

const FIXES = {
  web_stream: "Add a web data stream in GA4: Admin > Data streams.",
  key_event:
    "Mark the event that means a conversion, for example sign_up or generate_lead, as a key event in GA4: Admin > Events.",
  volume: `The conversion needs at least ${MIN_EVENTS} events in the last 28 days. Check that the site sends the event.`,
  chosen: "Choose the key event that counts as a conversion.",
} as const;

async function conversionOf(projectId: string) {
  const [row] = await db
    .select({
      eventName: projectConversionEvents.eventName,
      valueMinor: projectConversionEvents.valueMinor,
      currency: projectConversionEvents.currency,
      channel: projectConversionEvents.channel,
    })
    .from(projectConversionEvents)
    .where(eq(projectConversionEvents.projectId, projectId));
  return row ?? null;
}

async function gate(projectId: string, eventName: string | null) {
  if (!(await Ga4ConnectionRepository.getByProjectId(projectId)))
    return { status: "not_connected" as const };
  try {
    const [health, report] = await Promise.all([
      Ga4MeasurementHealthService.getMeasurementHealth(projectId),
      Ga4ReportingService.runReport({
        projectId,
        kind: "key_events",
        channel: "all",
        limit: 200,
      }),
    ]);
    const counts = new Map(
      report.rows.map((row) => [String(row.eventName), Number(row.keyEvents)]),
    );
    const keyEvents = health.keyEvents.map((event) => ({
      eventName: event.eventName,
      count: counts.get(event.eventName) ?? 0,
    }));
    const chosen = keyEvents.find((event) => event.eventName === eventName);
    const results = {
      web_stream: health.summary.webStreamCount > 0,
      key_event: keyEvents.length > 0,
      // Before a choice, any key event with enough events passes.
      volume: (chosen ? [chosen] : keyEvents).some(
        (event) => event.count >= MIN_EVENTS,
      ),
      chosen: Boolean(chosen),
    };
    const checks = (
      ["web_stream", "key_event", "volume", "chosen"] as const
    ).map((id) => ({
      id,
      ok: results[id],
      fix: results[id] ? null : FIXES[id],
    }));
    return {
      status: checks.every((check) => check.ok)
        ? ("passed" as const)
        : ("failed" as const),
      checks,
      keyEvents,
      currency: report.request.currencyCode,
      dateRange: report.request.resolvedDateRange,
      // RFC-0012 5.3: the form detector needs GA4's form interaction events.
      formsMeasured: health.webStreams.some(
        (stream) =>
          stream.enhancedMeasurement.streamEnabled &&
          stream.enhancedMeasurement.formInteractionsEnabled,
      ),
    };
  } catch (error) {
    return {
      status: "error" as const,
      message:
        error instanceof Ga4ReportError
          ? error.message
          : "Google Analytics did not answer. Try again later.",
    };
  }
}

/** The chosen conversion and the gate result. The caller authorizes. */
export async function readGate(projectId: string) {
  const conversion = await conversionOf(projectId);
  return {
    conversion,
    gate: await gate(projectId, conversion?.eventName ?? null),
  };
}

async function get(context: OpportunityContext, projectId: string) {
  await authorize(context, projectId);
  return {
    canManage: hasOrgPermission(context.role, { integration: ["manage"] }),
    ...(await readGate(projectId)),
  };
}

async function save(
  context: OpportunityContext,
  input: {
    projectId: string;
    eventName: string;
    valueMinor: number | null;
    currency: string | null;
    channel: "organic_search" | "all";
  },
) {
  await authorize(context, input.projectId);
  requireOrgPermission(context, { integration: ["manage"] });
  const values = {
    eventName: input.eventName,
    valueMinor: input.valueMinor,
    currency: input.valueMinor === null ? null : input.currency,
    channel: input.channel,
    createdBy: context.userId,
    updatedAt: new Date().toISOString(),
  };
  await runBatch((tx) => [
    auditInsert(tx, {
      organizationId: context.organizationId,
      projectId: input.projectId,
      actor: context,
      action: "conversion.event_changed",
      targetType: "project",
      targetId: input.projectId,
      summary: `Chose the GA4 key event "${input.eventName}" as the conversion`,
    }),
    tx
      .insert(projectConversionEvents)
      .values({ projectId: input.projectId, ...values })
      .onConflictDoUpdate({
        target: projectConversionEvents.projectId,
        set: values,
      }),
  ]);
}

export const ConversionGateService = { get, save };

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, CircleMinus, CircleX } from "lucide-react";
import { toast } from "sonner";
import { CardShell } from "@/client/components/CardShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { QueryState } from "@/client/components/QueryState";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  confirmProtectionAlert,
  getProtection,
  sendProtectionTestAlert,
  setProtectionStatus,
  verifyProtectionOrigin,
} from "@/serverFunctions/protection";
import type { PROTECTION_STATUSES } from "@/shared/protection";
import { MonitoredPagesCard } from "./MonitoredPagesCard";
import {
  protectionQueryKey,
  useProtectionMutation,
  type Protection,
} from "./protectionQueries";
import { ProtectionSettingsForm } from "./ProtectionSettingsForm";

type Status = (typeof PROTECTION_STATUSES)[number];

const STATUS_LABELS = {
  setup: "Setting up",
  active: "Active",
  paused: "Paused",
  ended: "Ended",
} as const satisfies Record<Status, string>;

const formatDate = (iso: string) => new Date(iso).toLocaleString();

// RFC-0026 phase A: what this project protects, who reviews its alerts, what
// Relay may do, and whether protection can start.
export function ProtectionSettings({ projectId }: { projectId: string }) {
  const query = useQuery({
    queryKey: protectionQueryKey(projectId),
    queryFn: () => getProtection({ data: { projectId } }),
  });
  return (
    <QueryState query={query} errorFallback="Could not load protection">
      {(data) =>
        data.domain ? (
          <div className="grid gap-6">
            <CardShell
              title="Site, reviewer and permissions"
              titleInfo={
                data.enrollment ? (
                  <Badge variant="secondary">
                    {STATUS_LABELS[data.enrollment.status]}
                  </Badge>
                ) : null
              }
            >
              <ProtectionSettingsForm
                key={data.enrollment?.id ?? "new"}
                projectId={projectId}
                data={data}
              />
            </CardShell>
            {data.enrollment ? (
              <>
                <OwnershipAndAlerts projectId={projectId} data={data} />
                <MonitoredPagesCard
                  projectId={projectId}
                  data={data}
                  enrollment={data.enrollment}
                />
                <ReadinessCard projectId={projectId} data={data} />
              </>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Add the project's website in General settings before protecting it.
          </p>
        )
      }
    </QueryState>
  );
}

function OwnershipAndAlerts({
  projectId,
  data,
}: {
  projectId: string;
  data: Protection;
}) {
  const enrollment = data.enrollment;
  const verify = useProtectionMutation(
    projectId,
    (_: void) => verifyProtectionOrigin({ data: { projectId } }),
    (result) =>
      result.verified
        ? toast.success("Ownership verified")
        : toast.error(
            "Relay couldn't verify ownership. Connect a Search Console property that covers this origin, or place the IndexNow key file on it.",
          ),
  );
  const sendAlert = useProtectionMutation(
    projectId,
    (_: void) => sendProtectionTestAlert({ data: { projectId } }),
    () => toast.success("Test alert sent to the reviewer"),
  );
  const confirm = useProtectionMutation(projectId, (_: void) =>
    confirmProtectionAlert({ data: { projectId } }),
  );
  if (!enrollment) return null;
  const reviewer = data.reviewerCandidates.find(
    (candidate) => candidate.userId === enrollment.reviewerUserId,
  );
  return (
    <CardShell title="Ownership and alerts">
      <div className="space-y-6 text-sm">
        <section className="space-y-2">
          <h3 className="font-medium">Ownership</h3>
          <p className="text-muted-foreground">
            {enrollment.originVerifiedAt
              ? `${enrollment.productionOrigin} was verified through ${enrollment.originVerifiedBy === "search_console" ? "Search Console" : "the IndexNow key file"} on ${formatDate(enrollment.originVerifiedAt)}.`
              : `Verify that you own ${enrollment.productionOrigin} with a Search Console property that covers it, or with the project's IndexNow key file.`}
          </p>
          {data.canManage ? (
            <Button
              size="sm"
              variant="outline"
              pending={verify.isPending}
              onClick={() => verify.mutate()}
            >
              Verify ownership
            </Button>
          ) : null}
        </section>
        <section className="space-y-2">
          <h3 className="font-medium">Reviewer alerts</h3>
          <p className="text-muted-foreground" data-ph-mask>
            {!reviewer
              ? "Choose a reviewer above, then send them a test alert."
              : enrollment.alertConfirmedAt
                ? `${reviewer.name || reviewer.email} confirmed a test alert on ${formatDate(enrollment.alertConfirmedAt)}.`
                : enrollment.alertTestedAt
                  ? `A test alert went to ${reviewer.email} on ${formatDate(enrollment.alertTestedAt)}. The reviewer confirms it here.`
                  : `Send a test alert to ${reviewer.email}. Up to 3 a day.`}
          </p>
          {!data.emailConfigured ? (
            <p role="status">
              Email sending isn't set up on this deployment, so Relay can't send
              test alerts.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {data.canManage ? (
              <Button
                size="sm"
                variant="outline"
                disabled={!reviewer || !data.emailConfigured}
                pending={sendAlert.isPending}
                onClick={() => sendAlert.mutate()}
              >
                Send test alert
              </Button>
            ) : null}
            {data.isReviewer &&
            enrollment.alertTestedAt &&
            !enrollment.alertConfirmedAt ? (
              <Button
                size="sm"
                pending={confirm.isPending}
                onClick={() => confirm.mutate()}
              >
                I received it
              </Button>
            ) : null}
          </div>
        </section>
      </div>
    </CardShell>
  );
}

const STATE_ICONS = {
  passed: <CircleCheck className="size-4 text-success" aria-hidden />,
  failed: <CircleX className="size-4 text-destructive" aria-hidden />,
  not_available: (
    <CircleMinus className="size-4 text-muted-foreground" aria-hidden />
  ),
  not_required: (
    <CircleMinus className="size-4 text-muted-foreground" aria-hidden />
  ),
} as const;

const STATE_LABELS = {
  passed: "Passed",
  failed: "Failed",
  not_available: "Not available",
  not_required: "Not required",
} as const;

const ITEM_LABELS = {
  origin: "Production origin",
  repository: "Repository",
  pages: "Pages",
  baseline: "Known-good baseline",
  reviewer: "Reviewer",
  schedule: "Scheduled checks",
  repairs: "Repairs",
  search_data: "Search data",
} as const;

const CONFIRMS = {
  paused: {
    title: "Pause protection?",
    label: "Pause",
    body: "Checks stop until you resume protection.",
  },
  active: {
    title: "Resume protection?",
    label: "Resume",
    body: "Checks start again.",
  },
  ended: {
    title: "End protection?",
    label: "End",
    body: "Relay stops protecting this site. You can set it up again later.",
  },
} as const;

function ReadinessCard({
  projectId,
  data,
}: {
  projectId: string;
  data: Protection;
}) {
  const [confirming, setConfirming] = useState<keyof typeof CONFIRMS | null>(
    null,
  );
  const setStatus = useProtectionMutation(projectId, (status: Status) =>
    setProtectionStatus({ data: { projectId, status } }),
  );
  const change = (status: Status) =>
    setStatus.mutate(status, { onSettled: () => setConfirming(null) });
  const { items, canActivate, canResume } = data.readiness;
  const blocking = items.find(
    (item) => item.required && item.state !== "passed",
  );
  const status = data.enrollment?.status;
  return (
    <CardShell title="Readiness">
      <div className="space-y-4 text-sm">
        <ul className="divide-y rounded-lg border">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 p-3">
              <span className="mt-0.5">{STATE_ICONS[item.state]}</span>
              <span className="min-w-0">
                <span className="block font-medium">
                  {ITEM_LABELS[item.id]}
                  {item.required ? null : (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      (optional)
                    </span>
                  )}
                </span>
                <span className="block text-muted-foreground">
                  <span className="sr-only">{STATE_LABELS[item.state]}: </span>
                  {item.message}
                </span>
              </span>
            </li>
          ))}
        </ul>
        {!data.canManage ? (
          <p className="text-muted-foreground">
            Ask an organization owner or admin to change protection.
          </p>
        ) : status === "ended" ? (
          <Button
            size="sm"
            pending={setStatus.isPending}
            onClick={() => change("setup")}
          >
            Set up again
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {status === "setup" ? (
                <Button
                  size="sm"
                  disabled={!canActivate}
                  pending={setStatus.isPending}
                  onClick={() => change("active")}
                >
                  Activate
                </Button>
              ) : null}
              {status === "active" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirming("paused")}
                >
                  Pause
                </Button>
              ) : null}
              {status === "paused" ? (
                <Button
                  size="sm"
                  disabled={!canResume}
                  onClick={() => setConfirming("active")}
                >
                  Resume
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirming("ended")}
              >
                End
              </Button>
            </div>
            {status === "setup" && blocking ? (
              <p className="text-muted-foreground">
                Activate is unavailable: {blocking.message}
              </p>
            ) : null}
          </div>
        )}
        {confirming ? (
          <ConfirmDialog
            title={CONFIRMS[confirming].title}
            confirmLabel={CONFIRMS[confirming].label}
            destructive={confirming === "ended"}
            pending={setStatus.isPending}
            onClose={() => setConfirming(null)}
            onConfirm={() => change(confirming)}
          >
            {CONFIRMS[confirming].body}
          </ConfirmDialog>
        ) : null}
      </div>
    </CardShell>
  );
}

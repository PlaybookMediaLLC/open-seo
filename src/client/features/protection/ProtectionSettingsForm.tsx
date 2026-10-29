import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pickBy } from "remeda";
import { toast } from "sonner";
import { useAppForm } from "@/client/components/form/useAppForm";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { saveProtectionSettings } from "@/serverFunctions/protection";
import { protectionQueryKey, type Protection } from "./protectionQueries";

const NO_REVIEWER = "none";
const HOURS = Array.from({ length: 24 }, (_, hour) => ({
  value: hour,
  label: `${String(hour).padStart(2, "0")}:00 UTC`,
}));

// RFC-0026 phase A: the production origin, daily check hour, reviewer,
// notes and permissions, saved together.
export function ProtectionSettingsForm({
  projectId,
  data,
}: {
  projectId: string;
  data: Protection;
}) {
  const queryClient = useQueryClient();
  const { enrollment, canManage, domain } = data;
  const save = useMutation({
    mutationFn: saveProtectionSettings,
    meta: { errorToast: false },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: protectionQueryKey(projectId),
      });
      toast.success("Protection settings saved");
    },
  });
  const form = useAppForm({
    defaultValues: {
      productionOrigin: enrollment?.productionOrigin ?? `https://${domain}`,
      checkHourUtc: enrollment?.checkHourUtc ?? 6,
      reviewerUserId: enrollment?.reviewerUserId ?? NO_REVIEWER,
      notes: enrollment?.notes ?? "",
      allowRepairProposals: enrollment?.allowRepairProposals ?? false,
      allowPullRequests: enrollment?.allowPullRequests ?? false,
    },
    onSubmit: async ({ value, formApi }) => {
      // Only what this person edited since the form last loaded or saved, so
      // an old tab cannot send back an origin or reviewer someone replaced.
      const shown = formApi.options.defaultValues ?? value;
      const edited = enrollment
        ? pickBy(value, (field, key) => field !== shown[key])
        : value;
      try {
        await save.mutateAsync({
          data: {
            projectId,
            ...edited,
            ...(edited.reviewerUserId === undefined
              ? {}
              : {
                  reviewerUserId:
                    edited.reviewerUserId === NO_REVIEWER
                      ? null
                      : edited.reviewerUserId,
                }),
            ...(edited.notes === undefined
              ? {}
              : { notes: edited.notes.trim() || null }),
          },
        });
      } catch (error) {
        toast.error(getStandardErrorMessage(error));
        return;
      }
      formApi.reset(value);
    },
  });
  const originLocked =
    enrollment !== null &&
    enrollment.status !== "setup" &&
    enrollment.status !== "paused";
  const reviewers = [
    { value: NO_REVIEWER, label: "No reviewer yet" },
    ...data.reviewerCandidates.map((candidate) => ({
      value: candidate.userId,
      label: candidate.name
        ? `${candidate.name} (${candidate.email})`
        : candidate.email,
    })),
  ];
  return (
    <form.AppForm>
      <form.Form className="grid gap-4 sm:grid-cols-2">
        <form.AppField name="productionOrigin">
          {(field) => (
            <field.SelectField
              label="Production origin"
              description={
                originLocked
                  ? "Pause protection to change the origin."
                  : "The live site Relay protects."
              }
              items={[`https://${domain}`, `https://www.${domain}`].map(
                (origin) => ({ value: origin, label: origin }),
              )}
              disabled={!canManage || originLocked}
            />
          )}
        </form.AppField>
        <form.AppField name="checkHourUtc">
          {(field) => (
            <field.SelectField
              label="Daily check time"
              items={HOURS}
              disabled={!canManage}
            />
          )}
        </form.AppField>
        <form.AppField name="reviewerUserId">
          {(field) => (
            <field.SelectField
              label="Reviewer"
              description="Receives incident alerts and confirms a test alert. Changing the reviewer clears that confirmation."
              items={reviewers}
              disabled={!canManage}
            />
          )}
        </form.AppField>
        <form.AppField name="notes">
          {(field) => (
            <field.TextareaField
              label="Response expectations and support contact"
              maxLength={1000}
              rows={3}
              disabled={!canManage}
            />
          )}
        </form.AppField>
        <div className="space-y-3 sm:col-span-2">
          <form.AppField name="allowRepairProposals">
            {(field) => (
              <field.SwitchField
                label="Prepare repair proposals"
                description="Relay may draft code changes for confirmed regressions."
                disabled={!canManage}
              />
            )}
          </form.AppField>
          <form.AppField name="allowPullRequests">
            {(field) => (
              <field.SwitchField
                label="Open pull requests"
                description="Relay may open a pull request for an approved repair."
                disabled={!canManage}
              />
            )}
          </form.AppField>
          <p className="text-sm text-muted-foreground">
            Your team always reviews, merges and deploys. Relay never merges.
          </p>
        </div>
        {canManage ? (
          <div className="sm:col-span-2">
            <form.SubmitButton>
              {enrollment ? "Save settings" : "Start setup"}
            </form.SubmitButton>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground sm:col-span-2">
            Ask an organization owner or admin to change these settings.
          </p>
        )}
      </form.Form>
    </form.AppForm>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/client/components/ui/button";
import { dateLabel } from "@/client/features/opportunities/shared";
import {
  connectSupportSource,
  disconnectSupportSource,
  getSupportSource,
  processSupportNow,
} from "@/serverFunctions/support";

/** RFC-0017 5.4: GitHub Issues as a read-only source of support topics. */
export function SupportSource({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}) {
  const queryKey = ["support-source", projectId];
  const client = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn: () => getSupportSource({ data: { projectId } }),
  });
  const refresh = () => client.invalidateQueries({ queryKey });
  const action = useMutation({
    meta: { errorToast: false },
    mutationFn: async (kind: "connect" | "disconnect" | "process") => {
      const data = { projectId };
      if (kind === "connect") await connectSupportSource({ data });
      else if (kind === "disconnect") await disconnectSupportSource({ data });
      else await processSupportNow({ data });
    },
    onSettled: () => void refresh(),
  });
  const data = query.data;
  if (!data) return null;
  return (
    <div className="space-y-2">
      <h4 className="font-medium">Support topics from GitHub Issues</h4>
      {!data.enabled ? (
        <p className="text-muted-foreground">
          Support topics are off on this server until its privacy policy covers
          ticket text.
        </p>
      ) : data.source ? (
        <p>
          Connected. {data.topics} topics
          {data.source.lastProcessedAt
            ? `, grouped on ${dateLabel(data.source.lastProcessedAt)}`
            : ", not grouped yet"}
          .
        </p>
      ) : (
        <p className="text-muted-foreground">
          Relay reads the title and first message of the last 90 days of issues,
          removes personal data, and groups them into topics. It stores only
          counts and 3 short redacted examples per topic.
        </p>
      )}
      {canManage && data.enabled && (
        <div className="flex flex-wrap gap-2">
          {data.source ? (
            <>
              <Button
                size="sm"
                variant="outline"
                pending={action.isPending && action.variables === "process"}
                onClick={() => action.mutate("process")}
              >
                Read tickets now (uses credits)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => action.mutate("disconnect")}
              >
                Disconnect and delete topics
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => action.mutate("connect")}
            >
              Use GitHub Issues
            </Button>
          )}
        </div>
      )}
      {action.isError && (
        <p role="alert" className="text-destructive">
          {action.error.message}
        </p>
      )}
    </div>
  );
}

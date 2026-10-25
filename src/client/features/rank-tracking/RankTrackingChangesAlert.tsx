import { Link } from "@tanstack/react-router";
import { IconInfoCircle } from "@tabler/icons-react";
import { Alert, AlertDescription } from "@/client/components/ui/alert";

export function RankTrackingChangesAlert({ projectId }: { projectId: string }) {
  return (
    <Alert variant="info">
      <IconInfoCircle />
      <AlertDescription className="text-foreground">
        <p className="font-medium">Check the status of each rank run.</p>
        <p>
          Google can return incomplete results. Some checks are retried; a
          missing position alone does not establish a ranking drop.
        </p>
        <Link
          to="/p/$projectId/search-performance"
          params={{ projectId }}
          className="underline"
        >
          Compare with Search Console observations
        </Link>
      </AlertDescription>
    </Alert>
  );
}

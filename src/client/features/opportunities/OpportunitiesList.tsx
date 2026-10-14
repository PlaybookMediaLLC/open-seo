import { Link } from "@tanstack/react-router";
import { Target } from "lucide-react";
import { EmptyState } from "@/client/components/EmptyState";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { Badge } from "@/client/components/ui/badge";
import { formatRelativeTime } from "@/client/lib/relative-time";
import { OpportunityStatusBadge, typeLabels } from "./shared";
import type { Opportunity } from "@/types/schemas/opportunities";

export function OpportunitiesList({
  rows,
  projectId,
  filtered,
}: {
  rows: Opportunity[];
  projectId: string;
  filtered: boolean;
}) {
  if (!rows.length)
    return (
      <EmptyState
        icon={Target}
        title={filtered ? "No matching opportunities" : "No opportunities yet"}
        description={
          filtered
            ? "Adjust the filters or include deferred opportunities."
            : "Run detection to find pages within reach and pages losing search traffic. Only opportunities supported by your Search Console data appear here."
        }
      />
    );
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Opportunity</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Effort</TableHead>
            <TableHead>Last detected</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-lg whitespace-normal">
                <Link
                  to="/p/$projectId/opportunities/$opportunityId"
                  params={{ projectId, opportunityId: row.id }}
                  className="font-medium hover:underline"
                >
                  {row.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground break-all">
                  {row.url}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">{typeLabels[row.type]}</Badge>
                  {row.deferredUntil &&
                  new Date(row.deferredUntil).getTime() > Date.now() ? (
                    <Badge variant="warning">
                      Deferred until{" "}
                      {new Date(row.deferredUntil).toLocaleDateString()}
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <span className="font-semibold tabular-nums">
                  {row.priority}
                </span>
                <span className="text-muted-foreground"> / 100</span>
              </TableCell>
              <TableCell>
                <OpportunityStatusBadge status={row.status} />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                ~{row.effortHours} h
              </TableCell>
              <TableCell
                className="whitespace-nowrap text-muted-foreground"
                title={row.lastDetectedAt}
              >
                {formatRelativeTime(row.lastDetectedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}

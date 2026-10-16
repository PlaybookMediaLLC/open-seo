import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { IconFlask as FlaskConical } from "@tabler/icons-react";
import { PageHeader } from "@/client/components/PageHeader";
import { QueryError } from "@/client/components/QueryState";
import { EmptyState } from "@/client/components/EmptyState";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { dateLabel } from "@/client/features/opportunities/shared";
import { experimentListOptions } from "./queries";

export function ExperimentsPage({ projectId }: { projectId: string }) {
  const [offset, setOffset] = useState(0);
  const query = useQuery(experimentListOptions(projectId, offset));
  return (
    <div className="overflow-auto page-pad">
      <div className="mx-auto max-w-7xl space-y-5">
        <PageHeader
          title="Experiments & Results"
          description="Track reviewed changes from pull request to human-confirmed deployment and Search Console observations."
        />
        <div className="rounded-xl border bg-card p-4 text-sm space-y-2">
          <p className="font-medium">Observed change is not causal proof.</p>
          <p className="text-muted-foreground">
            Register a successful pull request from its opportunity's publishing
            history. Refresh GitHub status explicitly, attest to production
            deployment, then request bounded Search Console measurements.
            Merging a pull request does not prove deployment. No automatic
            provider requests run here.
          </p>
        </div>
        {query.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading experiments…
          </p>
        ) : query.isError ? (
          <QueryError
            fallback="Could not load experiments"
            onRetry={() => void query.refetch()}
          />
        ) : (
          <>
            {!query.data.canManage && (
              <p className="text-sm text-muted-foreground">
                Read-only access. A project owner or administrator manages
                deployment attestations and refreshes.
              </p>
            )}
            {!query.data.items.length ? (
              <EmptyState
                icon={FlaskConical}
                title={
                  offset ? "No experiments on this page" : "No experiments yet"
                }
                description="Open a successful publishing proposal and choose Track results. Registration pins its existing pull request and makes no external request."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<a href="/docs/experiments" />}
                  >
                    Read the guide
                  </Button>
                }
              />
            ) : (
              <TableCard>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Experiment</TableHead>
                      <TableHead>Pull request</TableHead>
                      <TableHead>Production deployment</TableHead>
                      <TableHead>Latest assessment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {query.data.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="max-w-md whitespace-normal">
                          <Link
                            className="font-medium hover:underline"
                            to="/p/$projectId/experiments/$experimentId"
                            params={{ projectId, experimentId: item.id }}
                          >
                            {item.opportunityTitle}
                          </Link>
                          <p className="mt-1 break-all text-xs text-muted-foreground">
                            {item.targetUrl}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {item.pullRequestState}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          {item.deployedAt ? (
                            <>
                              <p className="text-sm">
                                {dateLabel(item.deployedAt)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Human-attested
                              </p>
                            </>
                          ) : (
                            <span className="text-muted-foreground">
                              Not confirmed
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.latestRun?.outcome === "negative"
                                ? "warning"
                                : "secondary"
                            }
                          >
                            {item.latestRun?.outcome ?? "Pending"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <p className="text-muted-foreground">
                {query.data.total
                  ? `${offset + 1}–${Math.min(offset + 50, query.data.total)} of ${query.data.total}`
                  : "0 experiments"}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - 50))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  disabled={offset + 50 >= query.data.total}
                  onClick={() => setOffset(offset + 50)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
        <Button
          variant="outline"
          nativeButton={false}
          render={
            <Link to="/p/$projectId/opportunities" params={{ projectId }} />
          }
        >
          Browse opportunities
        </Button>
      </div>
    </div>
  );
}

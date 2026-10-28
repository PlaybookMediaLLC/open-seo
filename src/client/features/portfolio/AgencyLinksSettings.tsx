import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { SectionHeader } from "@/client/components/PageHeader";
import { QueryState } from "@/client/components/QueryState";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  acceptAgencyLink,
  endAgencyLink,
  getAgencyLinks,
  requestAgencyLink,
} from "@/serverFunctions/portfolio";
import type { AgencyLink } from "@/types/schemas/portfolio";

const SHARED =
  "It sees this organization's project names and domains, open opportunity counts, experiment results, credits spent and Search Console totals on its Portfolio page. It sees nothing else and can change nothing.";

// RFC-0007 6.6: one organization per client, linked to its agency by an
// explicit grant that either owner can end.
export function AgencyLinksSettings() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["agency-links"],
    queryFn: () => getAgencyLinks(),
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["agency-links"] });
    void queryClient.invalidateQueries({ queryKey: ["portfolio"] });
  };
  const request = useMutation({
    mutationFn: (clientOrganizationId: string) =>
      requestAgencyLink({ data: { clientOrganizationId } }),
    onSuccess: () => {
      toast.success("Request sent. Its owner accepts it in their settings.");
      refresh();
    },
  });
  const accept = useMutation({
    mutationFn: (linkId: string) => acceptAgencyLink({ data: { linkId } }),
    onSuccess: () => {
      toast.success("Agency access granted");
      refresh();
    },
  });
  const end = useMutation({
    mutationFn: (linkId: string) => endAgencyLink({ data: { linkId } }),
    onSuccess: () => {
      toast.success("Agency access ended");
      refresh();
    },
  });
  const [accepting, setAccepting] = useState<AgencyLink | null>(null);
  return (
    <section className="space-y-3">
      <SectionHeader title="Agency access" />
      <QueryState query={query} errorFallback="Could not load agency access">
        {(data) => (
          <div className="space-y-6 text-sm">
            <p className="text-muted-foreground">
              Agencies keep each client in its own organization. An agency
              organization the client's owner accepts can follow the client's
              projects on its Portfolio page.
            </p>
            {!data.canManage ? (
              <p className="text-muted-foreground">
                Only an owner can ask for, accept or end agency access.
              </p>
            ) : null}
            <LinkList
              title="Agencies that can see this organization"
              empty="No agency can see this organization."
              pendingLabel="Asks for access"
              links={data.agencies}
              actions={(link) =>
                data.canManage ? (
                  <>
                    {link.status === "pending" ? (
                      <Button size="sm" onClick={() => setAccepting(link)}>
                        Accept
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      pending={end.isPending && end.variables === link.id}
                      onClick={() => end.mutate(link.id)}
                    >
                      {link.status === "pending" ? "Decline" : "End access"}
                    </Button>
                  </>
                ) : null
              }
            />
            <LinkList
              title="Clients this organization follows"
              empty="This organization follows no client organizations."
              pendingLabel="Waiting for the client's owner"
              links={data.clients}
              actions={(link) =>
                data.canManage ? (
                  <Button
                    size="sm"
                    variant="outline"
                    pending={end.isPending && end.variables === link.id}
                    onClick={() => end.mutate(link.id)}
                  >
                    {link.status === "pending" ? "Withdraw" : "Stop following"}
                  </Button>
                ) : null
              }
            />
            {data.canManage && data.candidates.length ? (
              <div className="space-y-2">
                <p className="font-medium">
                  Ask a client organization you belong to
                </p>
                <ul className="divide-y rounded-lg border">
                  {data.candidates.map((candidate) => (
                    <li
                      key={candidate.organizationId}
                      className="flex items-center justify-between gap-3 p-3"
                    >
                      <span className="truncate">
                        {candidate.organizationName}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        pending={
                          request.isPending &&
                          request.variables === candidate.organizationId
                        }
                        onClick={() => request.mutate(candidate.organizationId)}
                      >
                        Ask for access
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </QueryState>
      {accepting ? (
        <ConfirmDialog
          title={`Let ${accepting.organizationName} follow this organization?`}
          confirmLabel="Accept"
          pending={accept.isPending}
          onClose={() => setAccepting(null)}
          onConfirm={() =>
            accept.mutate(accepting.id, {
              onSettled: () => setAccepting(null),
            })
          }
        >
          {SHARED} You can end it at any time.
        </ConfirmDialog>
      ) : null}
    </section>
  );
}

function LinkList({
  title,
  empty,
  pendingLabel,
  links,
  actions,
}: {
  title: string;
  empty: string;
  pendingLabel: string;
  links: AgencyLink[];
  actions: (link: AgencyLink) => ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="font-medium">{title}</p>
      {links.length ? (
        <ul className="divide-y rounded-lg border">
          {links.map((link) => (
            <li
              key={link.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{link.organizationName}</span>
                <Badge
                  variant={link.status === "active" ? "success" : "outline"}
                  size="sm"
                >
                  {link.status === "active" ? "Active" : pendingLabel}
                </Badge>
              </span>
              <span className="flex gap-2">{actions(link)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

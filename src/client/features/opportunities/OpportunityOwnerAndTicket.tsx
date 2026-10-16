import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/client/components/ui/sheet";
import {
  assignOpportunity,
  getOpportunityTicket,
} from "@/serverFunctions/opportunities";
import type { Opportunity } from "@/types/schemas/opportunities";
import { opportunityKeys, ownerOptions } from "./shared";

const UNASSIGNED = "unassigned";
const TICKET_STATUSES = ["approved", "in_progress", "implemented", "failed"];

/** RFC-0003 5.1: owners and admins pick one member, or nobody. */
export function OwnerSelect({
  opportunity,
  canAssign,
}: {
  opportunity: Opportunity;
  canAssign: boolean;
}) {
  const queryClient = useQueryClient();
  const owners = useQuery(ownerOptions(opportunity.projectId));
  const assign = useMutation({
    mutationFn: (ownerUserId: string | null) =>
      assignOpportunity({
        data: {
          projectId: opportunity.projectId,
          opportunityId: opportunity.id,
          expectedVersion: opportunity.version,
          ownerUserId,
        },
      }),
    onSuccess: (detail) => {
      queryClient.setQueryData(
        opportunityKeys.detail(opportunity.projectId, opportunity.id),
        detail,
      );
      void queryClient.invalidateQueries({
        queryKey: opportunityKeys.all(opportunity.projectId),
      });
      toast.success("Owner saved");
    },
    onError: () => {
      toast.error(
        "The owner was not saved. Someone may have changed this opportunity. Review the refreshed page and try again.",
      );
      void queryClient.invalidateQueries({
        queryKey: opportunityKeys.all(opportunity.projectId),
      });
    },
    meta: { errorToast: false },
  });
  const current = opportunity.ownerUserId ?? UNASSIGNED;
  const name = (userId: string) =>
    userId === UNASSIGNED
      ? "Unassigned"
      : (owners.data?.find((owner) => owner.userId === userId)?.name ??
        "Former member");
  return (
    <div className="flex items-center gap-2 text-sm">
      <span id="opportunity-owner" className="text-muted-foreground">
        Owner
      </span>
      <Select
        value={current}
        disabled={!canAssign || assign.isPending}
        onValueChange={(value) => {
          const next = String(value);
          if (next !== current)
            assign.mutate(next === UNASSIGNED ? null : next);
        }}
      >
        <SelectTrigger aria-labelledby="opportunity-owner" className="min-w-44">
          <SelectValue>{name(current)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
          {owners.data?.map((owner) => (
            <SelectItem key={owner.userId} value={owner.userId}>
              {owner.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** RFC-0003 5.6: plain ticket text from stored fields, ready to copy. */
export function TicketSheet({ opportunity }: { opportunity: Opportunity }) {
  const [open, setOpen] = useState(false);
  const ticket = useQuery({
    queryKey: [
      ...opportunityKeys.detail(opportunity.projectId, opportunity.id),
      "ticket",
      opportunity.version,
    ],
    queryFn: () =>
      getOpportunityTicket({
        data: {
          projectId: opportunity.projectId,
          opportunityId: opportunity.id,
        },
      }),
    enabled: open,
  });
  if (!TICKET_STATUSES.includes(opportunity.status)) return null;
  const text = ticket.data
    ? `# ${ticket.data.title}\n\n${ticket.data.body}`
    : "";
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Create ticket
      </Button>
      <SheetContent className="data-[side=right]:sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Ticket</SheetTitle>
          <SheetDescription>
            Copy this text into your team's tracker. It comes from the stored
            evidence only. No AI wrote it.
          </SheetDescription>
        </SheetHeader>
        <pre className="mx-4 flex-1 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs">
          {ticket.isPending ? "Loading…" : text}
        </pre>
        <SheetFooter>
          <Button
            disabled={!text}
            onClick={() =>
              void navigator.clipboard
                .writeText(text)
                .then(() => toast.success("Ticket copied"))
                .catch(() => toast.error("Copy failed. Select the text."))
            }
          >
            Copy
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

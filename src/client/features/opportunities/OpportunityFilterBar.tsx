import { useEffect, useState } from "react";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Checkbox } from "@/client/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
  type OpportunityStatus,
} from "@/types/schemas/opportunities";
import {
  opportunitySearchSchema,
  statusLabels,
  typeLabels,
  type OpportunityFilters,
  type OwnerOption,
} from "./shared";

const FRESHNESS_LABELS = {
  all: "All items",
  current: "In latest analysis",
  stale: "Not in latest analysis",
} as const;

/** Keeps typing local and writes the URL 300 ms after the last key. */
function SearchInput({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => setText(value ?? ""), [value]);
  useEffect(() => {
    const next = text.trim() || undefined;
    if (next === value) return;
    const timer = setTimeout(() => onChange(next), 300);
    return () => clearTimeout(timer);
  }, [text, value, onChange]);
  return (
    <Input
      id="opportunity-search"
      type="search"
      className="w-56"
      maxLength={200}
      placeholder="Part of a URL or query"
      value={text}
      onChange={(event) => setText(event.target.value)}
    />
  );
}

export function OpportunityFilterBar({
  filters,
  onChange,
  statusCounts,
  owners,
}: {
  filters: OpportunityFilters;
  onChange: (patch: Partial<OpportunityFilters>) => void;
  statusCounts: Partial<Record<OpportunityStatus, number>>;
  owners: OwnerOption[];
}) {
  const statusLabel = (status: OpportunityStatus) =>
    `${statusLabels[status]} (${statusCounts[status] ?? 0})`;
  const ownerLabel =
    filters.owner === "me"
      ? "Assigned to me"
      : filters.owner === "unassigned"
        ? "Unassigned"
        : filters.owner
          ? (owners.find((owner) => owner.userId === filters.owner)?.name ??
            "One member")
          : "Any owner";
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border p-4">
      <div className="space-y-1">
        <label
          htmlFor="opportunity-search"
          className="block text-xs font-medium"
        >
          Search
        </label>
        <SearchInput
          value={filters.q}
          onChange={(q) => onChange({ q, offset: 0 })}
        />
      </div>
      <div className="space-y-1">
        <label id="opportunity-status-label" className="text-xs font-medium">
          Status
        </label>
        <Select
          value={filters.status ?? "all"}
          onValueChange={(value) =>
            onChange({
              status:
                value === "all"
                  ? undefined
                  : opportunitySearchSchema.shape.status.parse(value),
            })
          }
        >
          <SelectTrigger
            aria-labelledby="opportunity-status-label"
            className="min-w-36"
          >
            <SelectValue>
              {filters.status ? statusLabel(filters.status) : "All statuses"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {OPPORTUNITY_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {statusLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <details
        className="w-full"
        open={Boolean(
          filters.type ||
          filters.owner ||
          filters.minPriority ||
          filters.includeDeferred ||
          filters.freshness !== "all",
        )}
      >
        <summary className="cursor-pointer text-sm font-medium">
          Advanced filters
        </summary>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label id="opportunity-type-label" className="text-xs font-medium">
              Type
            </label>
            <Select
              value={filters.type ?? "all"}
              onValueChange={(value) =>
                onChange({
                  type:
                    value === "all"
                      ? undefined
                      : opportunitySearchSchema.shape.type.parse(value),
                })
              }
            >
              <SelectTrigger
                aria-labelledby="opportunity-type-label"
                className="min-w-40"
              >
                <SelectValue>
                  {filters.type ? typeLabels[filters.type] : "All types"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {/* RFC-0012 5.8 and RFC-0013: search, conversion, accessibility. */}
                {(
                  [
                    "Search",
                    "Conversion",
                    "Accessibility",
                    "Performance",
                    "Docs",
                  ] as const
                ).map((group) => (
                  <SelectGroup key={group}>
                    <SelectLabel>{group}</SelectLabel>
                    {OPPORTUNITY_TYPES.filter(
                      (type) =>
                        (type.startsWith("cro_")
                          ? "Conversion"
                          : type === "accessibility_issue"
                            ? "Accessibility"
                            : type === "performance_issue"
                              ? "Performance"
                              : type.startsWith("docs_") ||
                                  type === "support_topic"
                                ? "Docs"
                                : "Search") === group,
                    ).map((type) => (
                      <SelectItem key={type} value={type}>
                        {typeLabels[type]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label id="opportunity-owner-label" className="text-xs font-medium">
              Owner
            </label>
            <Select
              value={filters.owner ?? "any"}
              onValueChange={(value) =>
                onChange({ owner: value === "any" ? undefined : String(value) })
              }
            >
              <SelectTrigger
                aria-labelledby="opportunity-owner-label"
                className="min-w-40"
              >
                <SelectValue>{ownerLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any owner</SelectItem>
                <SelectItem value="me">Assigned to me</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {owners.map((owner) => (
                  <SelectItem key={owner.userId} value={owner.userId}>
                    {owner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label
              id="opportunity-freshness-label"
              className="text-xs font-medium"
            >
              Freshness
            </label>
            <Select
              value={filters.freshness}
              onValueChange={(value) =>
                onChange({
                  freshness:
                    opportunitySearchSchema.shape.freshness.parse(value),
                })
              }
            >
              <SelectTrigger
                aria-labelledby="opportunity-freshness-label"
                className="min-w-44"
              >
                <SelectValue>{FRESHNESS_LABELS[filters.freshness]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FRESHNESS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label
              htmlFor="opportunity-priority"
              className="block text-xs font-medium"
            >
              Minimum priority
            </label>
            <Input
              id="opportunity-priority"
              type="number"
              min={0}
              max={100}
              step={1}
              className="w-32"
              value={filters.minPriority}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isInteger(value) && value >= 0 && value <= 100)
                  onChange({ minPriority: value });
              }}
            />
          </div>
          <div className="space-y-1">
            <label id="opportunity-sort-label" className="text-xs font-medium">
              Sort by
            </label>
            <Select
              value={filters.sort}
              onValueChange={(value) =>
                onChange({ sort: value === "newest" ? "newest" : "priority" })
              }
            >
              <SelectTrigger
                aria-labelledby="opportunity-sort-label"
                className="min-w-32"
              >
                <SelectValue>
                  {filters.sort === "priority" ? "Priority" : "Newest"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 py-2 text-sm">
            <Checkbox
              checked={filters.includeDeferred}
              onCheckedChange={(checked) =>
                onChange({ includeDeferred: checked })
              }
            />
            Show deferred
          </label>
          {filters.status ||
          filters.type ||
          filters.minPriority ||
          filters.offset ||
          filters.includeDeferred ||
          filters.owner ||
          filters.q ||
          filters.freshness !== "all" ? (
            <Button
              variant="ghost"
              onClick={() =>
                onChange({
                  status: undefined,
                  type: undefined,
                  minPriority: 0,
                  offset: 0,
                  includeDeferred: false,
                  owner: undefined,
                  q: undefined,
                  freshness: "all",
                })
              }
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </details>
    </div>
  );
}

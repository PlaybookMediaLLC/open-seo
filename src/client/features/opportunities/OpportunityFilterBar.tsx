import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Checkbox } from "@/client/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
} from "@/types/schemas/opportunities";
import {
  opportunitySearchSchema,
  statusLabels,
  typeLabels,
  type OpportunityFilters,
} from "./shared";

export function OpportunityFilterBar({
  filters,
  onChange,
}: {
  filters: OpportunityFilters;
  onChange: (patch: Partial<OpportunityFilters>) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border p-4">
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
              {filters.status ? statusLabels[filters.status] : "All statuses"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {OPPORTUNITY_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {statusLabels[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
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
            {OPPORTUNITY_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {typeLabels[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label htmlFor="opportunity-priority" className="text-xs font-medium">
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
          onCheckedChange={(checked) => onChange({ includeDeferred: checked })}
        />
        Include deferred
      </label>
      {filters.status ||
      filters.type ||
      filters.minPriority ||
      filters.offset ||
      filters.includeDeferred ? (
        <Button
          variant="ghost"
          onClick={() =>
            onChange({
              status: undefined,
              type: undefined,
              minPriority: 0,
              offset: 0,
              includeDeferred: false,
            })
          }
        >
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}

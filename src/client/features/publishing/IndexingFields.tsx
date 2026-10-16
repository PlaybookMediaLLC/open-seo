import { Checkbox } from "@/client/components/ui/checkbox";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";

export type IndexingValues = {
  canonical: string;
  changeRobots: boolean;
  index: boolean;
  follow: boolean;
  confirmPath: string;
};

// Canonical and robots changes can remove a page from Google, so the person
// types the page path to confirm (RFC-0005 5.9).
export function IndexingFields({
  values,
  onChange,
  pagePath,
}: {
  values: IndexingValues;
  onChange: (values: IndexingValues) => void;
  pagePath: string;
}) {
  const set = (patch: Partial<IndexingValues>) =>
    onChange({ ...values, ...patch });
  return (
    <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <p className="text-sm">
        These changes can remove the page from Google. Check them carefully.
      </p>
      <div className="space-y-1">
        <Label htmlFor="publishing-canonical">
          New canonical URL (optional)
        </Label>
        <Input
          id="publishing-canonical"
          value={values.canonical}
          onChange={(event) => set({ canonical: event.target.value })}
          maxLength={500}
          placeholder="/pricing or https://example.com/pricing"
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="publishing-change-robots"
          checked={values.changeRobots}
          onCheckedChange={(checked) => set({ changeRobots: checked })}
        />
        <Label htmlFor="publishing-change-robots">Change robots</Label>
      </div>
      {values.changeRobots && (
        <div className="flex gap-4 pl-6">
          {(["index", "follow"] as const).map((key) => (
            <div key={key} className="flex items-center gap-2">
              <Checkbox
                id={`publishing-robots-${key}`}
                checked={values[key]}
                onCheckedChange={(checked) => set({ [key]: checked })}
              />
              <Label htmlFor={`publishing-robots-${key}`}>{key}</Label>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="publishing-confirm-path">
          Type the page path to confirm: {pagePath}
        </Label>
        <Input
          id="publishing-confirm-path"
          value={values.confirmPath}
          onChange={(event) => set({ confirmPath: event.target.value })}
          maxLength={500}
        />
      </div>
    </div>
  );
}

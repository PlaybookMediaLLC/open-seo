import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { setPublishingProductionEnvironment } from "@/serverFunctions/publishing";
import { useRefreshPublishing } from "./queries";

// The GitHub deployment environment that counts as production for
// deployment signals, for example "Production" or "production".
export function ProductionEnvironmentForm({
  projectId,
  current,
}: {
  projectId: string;
  current: string;
}) {
  const [value, setValue] = useState(current);
  const [message, setMessage] = useState<string | null>(null);
  const refresh = useRefreshPublishing(projectId);
  const save = useMutation({
    meta: { errorToast: false },
    mutationFn: () =>
      setPublishingProductionEnvironment({
        data: { projectId, productionEnvironment: value },
      }),
    onSuccess: (result) => setMessage(result.message),
    onError: () => setMessage("Could not save the environment name."),
    onSettled: () => refresh(),
  });
  return (
    <form
      className="flex flex-wrap items-end gap-2 pt-2"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage(null);
        save.mutate();
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="production-environment">
          GitHub production environment
        </Label>
        <Input
          id="production-environment"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={100}
          required
        />
      </div>
      <Button
        type="submit"
        variant="outline"
        size="sm"
        pending={save.isPending}
        disabled={!value.trim() || value.trim() === current}
      >
        Save
      </Button>
      {message && (
        <p role="status" className="w-full text-xs text-muted-foreground">
          {message}
        </p>
      )}
    </form>
  );
}

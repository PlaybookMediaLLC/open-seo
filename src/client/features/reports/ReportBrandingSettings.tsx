import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SectionHeader } from "@/client/components/PageHeader";
import { QueryState } from "@/client/components/QueryState";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  getReportBranding,
  removeReportBranding,
  saveReportBranding,
} from "@/serverFunctions/reportBranding";
import { brandColorSchema, logoDataUrlSchema } from "@/shared/report-branding";

type Branding = Awaited<ReturnType<typeof getReportBranding>>;

// RFC-0007 6.7: the logo and color on this organization's shared reports.
export function ReportBrandingSettings() {
  const query = useQuery({
    queryKey: ["report-branding"],
    queryFn: () => getReportBranding(),
  });
  return (
    <section className="space-y-3">
      <SectionHeader title="Shared report branding" />
      <QueryState query={query} errorFallback="Could not load the branding">
        {(data) => (
          <BrandingForm
            key={`${data.branding?.brandColor}:${data.branding?.logoDataUrl?.length}`}
            data={data}
          />
        )}
      </QueryState>
    </section>
  );
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read the file.")),
    );
    reader.addEventListener("error", () =>
      reject(new Error("Could not read the file.")),
    );
    reader.readAsDataURL(file);
  });
}

function BrandingForm({ data }: { data: Branding }) {
  const queryClient = useQueryClient();
  const [color, setColor] = useState(data.branding?.brandColor ?? "");
  const [logo, setLogo] = useState(data.branding?.logoDataUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["report-branding"] });
  const save = useMutation({
    mutationFn: () =>
      saveReportBranding({
        data: { brandColor: color.trim() || null, logoDataUrl: logo },
      }),
    onSuccess: () => {
      toast.success("Branding saved");
      void refresh();
    },
  });
  const remove = useMutation({
    mutationFn: () => removeReportBranding(),
    onSuccess: () => {
      toast.success("Branding removed");
      void refresh();
    },
  });
  const colorError =
    color.trim() && !brandColorSchema.safeParse(color.trim()).success
      ? "Use a color like #1c4ed8."
      : null;
  const disabled = !data.canManage || save.isPending || remove.isPending;
  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        Shared report pages show this logo and color.{" "}
        {data.removesRelayMark ? (
          "On your plan, branded pages don't show the Relay mark."
        ) : (
          <>
            The Relay mark comes off on a paid plan.{" "}
            <Link to="/billing" className="text-primary underline">
              See plans
            </Link>
          </>
        )}{" "}
        Agents also use the color as the accent of reports written from a
        template.
      </p>
      {!data.canManage ? (
        <p className="text-muted-foreground">
          Ask an organization owner or admin to change the branding.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="brand-color">Brand color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Pick a brand color"
              className="h-9 w-12 cursor-pointer rounded border bg-transparent"
              value={
                brandColorSchema.safeParse(color).success ? color : "#000000"
              }
              disabled={disabled}
              onChange={(event) => setColor(event.target.value)}
            />
            <Input
              id="brand-color"
              value={color}
              placeholder="#1c4ed8"
              disabled={disabled}
              aria-invalid={colorError ? true : undefined}
              onChange={(event) => setColor(event.target.value)}
            />
          </div>
          {colorError ? <p className="text-destructive">{colorError}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand-logo">Logo (PNG or JPEG, at most 48 KB)</Label>
          <Input
            id="brand-logo"
            type="file"
            accept="image/png,image/jpeg"
            disabled={disabled}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setError(null);
              try {
                const value = await readFile(file);
                if (logoDataUrlSchema.safeParse(value).success) setLogo(value);
                else setError("Use a PNG or JPEG of at most 48 KB.");
              } catch (failure) {
                setError(
                  failure instanceof Error
                    ? failure.message
                    : "Could not read the file.",
                );
              }
            }}
          />
          {error ? <p className="text-destructive">{error}</p> : null}
          {logo ? (
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="Logo preview"
                className="h-8 max-w-[140px] object-contain"
              />
              {data.canManage ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => setLogo(null)}
                >
                  Remove logo
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {data.canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            pending={save.isPending}
            disabled={
              disabled || Boolean(colorError) || (!color.trim() && !logo)
            }
            onClick={() => save.mutate()}
          >
            Save branding
          </Button>
          {data.branding ? (
            <Button
              size="sm"
              variant="outline"
              pending={remove.isPending}
              disabled={disabled}
              onClick={() => remove.mutate()}
            >
              Remove branding
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

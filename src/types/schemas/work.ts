import { z } from "zod";

// RFC-0018 5.9: the weekly cycle settings.
export const workProjectSchema = z.object({ projectId: z.string().min(1) });
export const workSettingsInputSchema = workProjectSchema.extend({
  enabled: z.boolean().optional(),
  qualityBar: z.number().int().min(20).max(80),
  openPrLimit: z.number().int().min(1).max(10),
  cycleDay: z.number().int().min(1).max(7),
  cycleHour: z.number().int().min(0).max(23),
  timeZone: z.string().trim().min(1).max(64),
});
export type WorkSettingsInput = z.infer<typeof workSettingsInputSchema>;
export const workReportInputSchema = workProjectSchema.extend({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

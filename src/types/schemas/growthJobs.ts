import { z } from "zod";
import { GROWTH_JOB_KINDS } from "@/db/growth-jobs.schema";

// RFC-0008 5.4: the body of a signed run request from a Trigger.dev task.
export const growthRunInputSchema = z.object({
  kind: z.enum([...GROWTH_JOB_KINDS, "audit_followup"]),
  projectId: z.string().min(1).max(100),
  scheduleId: z.string().min(1).max(100).nullish(),
  windowKey: z.string().min(1).max(100),
  triggerRunId: z.string().min(1).max(100).nullish(),
  attempt: z.number().int().min(1).max(20),
  maxAttempts: z.number().int().min(1).max(20),
});
export type GrowthRunInput = z.infer<typeof growthRunInputSchema>;
export type GrowthJobKind = GrowthRunInput["kind"];

// RFC-0008 5.10: one row of the Automation tab.
export const saveScheduleInputSchema = z.object({
  projectId: z.string().min(1),
  kind: z.enum(GROWTH_JOB_KINDS),
  enabled: z.boolean(),
  interval: z.enum(["daily", "weekly"]),
  hourUtc: z.number().int().min(0).max(23),
});
export type SaveScheduleInput = z.infer<typeof saveScheduleInputSchema>;
export const automationProjectInputSchema = z.object({
  projectId: z.string().min(1),
});
export const runLogsInputSchema = automationProjectInputSchema.extend({
  runId: z.string().min(1),
});

import { z } from "zod";

// RFC-0012 5.2: Project settings > Conversion.
const project = z.object({ projectId: z.string().min(1) });
export const conversionProjectSchema = project;
export const saveConversionEventSchema = project
  .extend({
    // GA4 event names: a letter first, then letters, digits or underscores.
    eventName: z
      .string()
      .regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/, "Enter a GA4 event name."),
    valueMinor: z.number().int().min(0).max(100_000_000).nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
  })
  .refine((input) => input.valueMinor === null || input.currency !== null, {
    message: "A value needs a currency.",
    path: ["currency"],
  });

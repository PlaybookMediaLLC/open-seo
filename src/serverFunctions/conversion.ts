import { createServerFn } from "@tanstack/react-start";
import { ConversionDetectionService } from "@/server/features/conversion/ConversionDetectionService";
import { ConversionGateService } from "@/server/features/conversion/ConversionGateService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  conversionProjectSchema,
  saveConversionEventSchema,
} from "@/types/schemas/conversion";

// RFC-0012 5.2: Project settings > Conversion.
export const getConversionGate = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(conversionProjectSchema)
  .handler(({ context }) =>
    ConversionGateService.get(context, context.projectId),
  );

export const saveConversionEvent = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(saveConversionEventSchema)
  .handler(({ context, data }) =>
    ConversionGateService.save(context, {
      ...data,
      projectId: context.projectId,
    }),
  );

// RFC-0012 5.3: one conversion run from GA4 data.
export const findConversionOpportunities = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(conversionProjectSchema)
  .handler(({ context }) =>
    ConversionDetectionService.detect(context, context.projectId),
  );

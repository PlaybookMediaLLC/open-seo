import { createServerFn } from "@tanstack/react-start";
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

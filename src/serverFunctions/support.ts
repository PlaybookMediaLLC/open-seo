import { createServerFn } from "@tanstack/react-start";
import { SupportSourceService } from "@/server/features/support/SupportSourceService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { docsProjectSchema } from "@/types/schemas/docs";

// RFC-0017 5.4: GitHub Issues as a read-only support source.
export const getSupportSource = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(docsProjectSchema)
  .handler(({ context }) =>
    SupportSourceService.status(context, context.projectId),
  );

export const connectSupportSource = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(docsProjectSchema)
  .handler(({ context }) =>
    SupportSourceService.connect(context, context.projectId),
  );

export const disconnectSupportSource = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(docsProjectSchema)
  .handler(({ context }) =>
    SupportSourceService.disconnect(context, context.projectId),
  );

export const processSupportNow = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(docsProjectSchema)
  .handler(({ context }) =>
    SupportSourceService.processNow(context, context.projectId),
  );

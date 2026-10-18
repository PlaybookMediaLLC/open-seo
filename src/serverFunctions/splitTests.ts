import { createServerFn } from "@tanstack/react-start";
import { SplitTestService as service } from "@/server/features/split-tests/SplitTestService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  createSplitTestSchema,
  splitTestProjectSchema,
  splitTestSchema,
} from "@/types/schemas/splitTests";

// RFC-0011 5.9: Experiments & Results > Split tests.
export const listSplitTests = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(splitTestProjectSchema)
  .handler(({ context }) => service.list(context, context.projectId));

export const getSplitTest = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(splitTestSchema)
  .handler(({ context, data }) =>
    service.get(context, { ...data, projectId: context.projectId }),
  );

export const createSplitTest = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(createSplitTestSchema)
  .handler(({ context, data }) =>
    service.create(context, { ...data, projectId: context.projectId }),
  );

import { createServerFn } from "@tanstack/react-start";
import { SplitTestEndService as ends } from "@/server/features/split-tests/SplitTestEndService";
import { SplitTestPullService as pulls } from "@/server/features/split-tests/SplitTestPullService";
import { SplitTestService as service } from "@/server/features/split-tests/SplitTestService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  backtestPatternSchema,
  confirmSplitTestDeploymentSchema,
  createSplitTestSchema,
  endSplitTestSchema,
  splitTestEndSchema,
  openSplitTestPullSchema,
  previewSplitTestPullSchema,
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

export const refreshSplitTestFn = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(splitTestSchema)
  .handler(({ context, data }) =>
    service.refresh(context, { ...data, projectId: context.projectId }),
  );

// RFC-0011 5.4: the pull request, its check and the deployment.
export const previewSplitTestPull = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(previewSplitTestPullSchema)
  .handler(({ context, data }) =>
    pulls.preview(context, { ...data, projectId: context.projectId }),
  );

export const openSplitTestPull = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(openSplitTestPullSchema)
  .handler(({ context, data }) =>
    pulls.open(context, { ...data, projectId: context.projectId }),
  );

export const checkSplitTestPull = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(splitTestSchema)
  .handler(({ context, data }) =>
    pulls.check(context, { ...data, projectId: context.projectId }),
  );

export const confirmSplitTestDeployment = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(confirmSplitTestDeploymentSchema)
  .handler(({ context, data }) =>
    pulls.confirmDeployment(context, { ...data, projectId: context.projectId }),
  );

export const backtestSplitTest = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(splitTestSchema)
  .handler(({ context, data }) =>
    service.backtest(context, { ...data, projectId: context.projectId }),
  );

export const backtestSplitTestPattern = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(backtestPatternSchema)
  .handler(({ context, data }) =>
    service.backtestPattern(context, { ...data, projectId: context.projectId }),
  );

export const exportSplitTestCsv = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(splitTestSchema)
  .handler(({ context, data }) =>
    service.csv(context, { ...data, projectId: context.projectId }),
  );

// RFC-0011 5.7: apply the change to all pages, or remove the test.
export const previewSplitTestEnd = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(splitTestEndSchema)
  .handler(({ context, data }) =>
    ends.preview(context, { ...data, projectId: context.projectId }),
  );

export const endSplitTest = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(endSplitTestSchema)
  .handler(({ context, data }) =>
    ends.end(context, { ...data, projectId: context.projectId }),
  );

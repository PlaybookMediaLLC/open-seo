import { createServerFn } from "@tanstack/react-start";
import { SeoCheckSettingsService as service } from "@/server/features/seo-checks/SeoCheckSettingsService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  addPreviewHostSchema,
  changeIgnoreSchema,
  createCiTokenSchema,
  removePreviewHostSchema,
  revokeCiTokenSchema,
  saveSeoCheckSettingsSchema,
  seoCheckProjectSchema,
  seoCheckRunSchema,
  setPreviewAccessSchema,
} from "@/types/schemas/seoChecks";

// RFC-0010 5.11: Project settings > SEO checks.
export const getSeoChecks = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(seoCheckProjectSchema)
  .handler(({ context }) => service.get(context, context.projectId));

export const getSeoCheckRun = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(seoCheckRunSchema)
  .handler(({ context, data }) =>
    service.run(context, { ...data, projectId: context.projectId }),
  );

export const createCiTokenFn = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(createCiTokenSchema)
  .handler(({ context, data }) =>
    service.createToken(context, { ...data, projectId: context.projectId }),
  );

export const revokeCiTokenFn = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(revokeCiTokenSchema)
  .handler(({ context, data }) =>
    service.revokeToken(context, { ...data, projectId: context.projectId }),
  );

export const addPreviewHost = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(addPreviewHostSchema)
  .handler(({ context, data }) =>
    service.addHost(context, { ...data, projectId: context.projectId }),
  );

export const removePreviewHost = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(removePreviewHostSchema)
  .handler(({ context, data }) =>
    service.removeHost(context, { ...data, projectId: context.projectId }),
  );

export const setPreviewAccess = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(setPreviewAccessSchema)
  .handler(({ context, data }) =>
    service.setAccess(context, { ...data, projectId: context.projectId }),
  );

export const changeSeoCheckIgnore = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(changeIgnoreSchema)
  .handler(({ context, data }) =>
    service.changeIgnore(context, { ...data, projectId: context.projectId }),
  );

export const saveSeoCheckSettings = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(saveSeoCheckSettingsSchema)
  .handler(({ context, data }) =>
    service.saveSettings(context, { ...data, projectId: context.projectId }),
  );

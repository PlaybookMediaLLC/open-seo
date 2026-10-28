import { createServerFn } from "@tanstack/react-start";
import { ProtectionService } from "@/server/features/protection/ProtectionService";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  protectionProjectInputSchema,
  saveMonitoredPagesInputSchema,
  saveProtectionSettingsInputSchema,
  setProtectionStatusInputSchema,
} from "@/types/schemas/protection";

// RFC-0026 phase A (IRFC-0001): the project's protected-site record.
// requireProjectContext answers NOT_FOUND for another organization's project.
export const getProtection = createServerFn({ method: "GET" })
  .middleware(requireProjectContext)
  .validator(protectionProjectInputSchema)
  .handler(({ context }) => ProtectionService.get(context));

export const saveProtectionSettings = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(saveProtectionSettingsInputSchema)
  .handler(({ context, data }) =>
    ProtectionService.saveSettings(context, data),
  );

export const verifyProtectionOrigin = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(protectionProjectInputSchema)
  .handler(({ context }) => ProtectionService.verifyOrigin(context));

export const suggestMonitoredPages = createServerFn({ method: "GET" })
  .middleware(requireProjectContext)
  .validator(protectionProjectInputSchema)
  .handler(({ context }) => ProtectionService.suggestPages(context));

export const saveMonitoredPages = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(saveMonitoredPagesInputSchema)
  .handler(({ context, data }) => ProtectionService.savePages(context, data));

export const sendProtectionTestAlert = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(protectionProjectInputSchema)
  .handler(({ context }) => ProtectionService.sendTestAlert(context));

export const confirmProtectionAlert = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(protectionProjectInputSchema)
  .handler(({ context }) => ProtectionService.confirmAlert(context));

export const setProtectionStatus = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(setProtectionStatusInputSchema)
  .handler(({ context, data }) =>
    ProtectionService.setStatus(context, data.status),
  );

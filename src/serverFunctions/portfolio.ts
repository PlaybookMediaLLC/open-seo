import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { usesBetterAuth } from "@/lib/auth-mode";
import { AgencyLinkService } from "@/server/features/portfolio/services/AgencyLinkService";
import { PortfolioService } from "@/server/features/portfolio/services/PortfolioService";
import { AppError } from "@/server/lib/errors";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";
import {
  agencyLinkInputSchema,
  requestAgencyLinkInputSchema,
} from "@/types/schemas/portfolio";

// RFC-0007 6.1-6.2: the organization's portfolio, read-only for members.
export const getPortfolio = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .handler(({ context }) => PortfolioService.summary(context));

// RFC-0007 6.6: agency links join two organizations, so they need Relay's own
// accounts, where one person can belong to both.
function requireOwnAccounts() {
  if (!usesBetterAuth(env.AUTH_MODE)) throw new AppError("NOT_FOUND");
}

export const getAgencyLinks = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .handler(({ context }) => {
    requireOwnAccounts();
    return AgencyLinkService.list(context);
  });

export const requestAgencyLink = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(requestAgencyLinkInputSchema)
  .handler(({ context, data }) => {
    requireOwnAccounts();
    return AgencyLinkService.request(context, data);
  });

export const acceptAgencyLink = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(agencyLinkInputSchema)
  .handler(({ context, data }) => {
    requireOwnAccounts();
    return AgencyLinkService.accept(context, data);
  });

export const endAgencyLink = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .validator(agencyLinkInputSchema)
  .handler(({ context, data }) => {
    requireOwnAccounts();
    return AgencyLinkService.end(context, data);
  });

import { createFileRoute } from "@tanstack/react-router";
import { PortfolioPage } from "@/client/features/portfolio/PortfolioPage";

// RFC-0007 6.1: the organization's projects side by side.
export const Route = createFileRoute("/_app/portfolio")({
  component: PortfolioPage,
});

import {
  Link,
  Outlet,
  createFileRoute,
  useMatchRoute,
} from "@tanstack/react-router";
import { AuthPageCard, AuthPageShell } from "@/client/features/auth/AuthPage";
import { useHostedAuthRouteGuard } from "@/client/features/auth/useHostedAuthRouteGuard";
import { PageLoading } from "@/client/components/Spinner";
import { Button } from "@/client/components/ui/button";
import { useAppZoom } from "@/client/layout/useAppZoom"; // playbook-seam

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedShellLayout,
});

function AuthenticatedShellLayout() {
  const authGate = useHostedAuthRouteGuard();
  useAppZoom(); // playbook-seam
  const matchRoute = useMatchRoute(); // playbook-seam

  // Every page under this layout is hosted-only.
  if (!authGate.isHostedMode) {
    return (
      <AuthPageShell>
        <AuthPageCard
          title="Not available"
          helperText="This page isn't available right now."
        >
          <Button
            nativeButton={false}
            render={<Link to="/app" />}
            variant="secondary"
            className="w-full"
          >
            Back to OpenSEO
          </Button>
        </AuthPageCard>
      </AuthPageShell>
    );
  }

  if (!authGate.canRenderAuthenticatedContent) {
    return <PageLoading />;
  }

  // Onboarding draws its own full-page layout.
  if (matchRoute({ to: "/onboarding" })) return <Outlet />; // playbook-seam

  return (
    <AuthPageShell>
      <Outlet />
    </AuthPageShell>
  );
}

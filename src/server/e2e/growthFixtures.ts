// E2E provider fake for the growth workflow (tests/growth-workflow.e2e.ts).
// Inert unless the build sets VITE_E2E_GROWTH_FIXTURES=1. Production builds
// replace the flag with undefined, so the fake is never bundled.
export function installGrowthFixtures() {
  if (import.meta.env.VITE_E2E_GROWTH_FIXTURES === "1")
    void import("./growthProviderFake").then((fake) =>
      fake.installGrowthProviderFake(),
    );
}

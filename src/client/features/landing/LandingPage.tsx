import { useSession } from "@/lib/auth-client";
import { LandingBuildIt } from "./LandingBuildIt";
import { LandingAdaptability, LandingLogos } from "./LandingFeatures";
import { LandingFaq, LandingFooter } from "./LandingFooter";
import { LandingHero, LandingNav } from "./LandingHero";
import { LandingAgents, LandingIntegrations } from "./LandingIntegrations";
import { LandingPricing } from "./LandingPricing";
import { LandingAudiences } from "./LandingSections";
import { LandingWhatsInside } from "./LandingWhatsInside";

/** The public marketing page at "/". Signed-in visitors get "Open app" CTAs. */
export function LandingPage() {
  const { data: session } = useSession();
  const signedIn = Boolean(session?.user?.id);
  return (
    <div className="landing landing-scroll">
      <LandingNav signedIn={signedIn} />
      <main className="flex flex-col items-center">
        <LandingHero signedIn={signedIn} />
        <LandingLogos />
        <LandingAdaptability />
        <LandingWhatsInside />
        <LandingBuildIt />
        <LandingIntegrations />
        <LandingAgents />
        <LandingAudiences />
        <LandingPricing signedIn={signedIn} />
        <LandingFaq />
      </main>
      <LandingFooter />
    </div>
  );
}

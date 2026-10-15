import { useSession } from "@/lib/auth-client";
import { LandingAgents, LandingIntegrations } from "./LandingIntegrations";
import {
  LandingAdaptability,
  LandingBuildIt,
  LandingWhatsInside,
} from "./LandingFeatures";
import { LandingFaq, LandingFooter } from "./LandingFooter";
import {
  LandingDemo,
  LandingHero,
  LandingLogos,
  LandingNav,
} from "./LandingHero";
import { LandingAudiences, LandingPricing } from "./LandingSections";

/** The public marketing page at "/". Signed-in visitors get "Open app" CTAs. */
export function LandingPage() {
  const { data: session } = useSession();
  const signedIn = Boolean(session?.user?.id);
  return (
    <div className="landing landing-scroll">
      <LandingNav signedIn={signedIn} />
      <main>
        <LandingHero signedIn={signedIn} />
        <LandingDemo />
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

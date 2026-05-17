import IntroSection from "@/app/components/home/IntroSection";
import DetailSection from "@/app/components/home/DetailSection";
import ExploreSection from "@/app/components/home/ExploreSection";
import HowItWorksSection from "@/app/components/home/HowItWorksSection";
import CreateMyPreview from "@/app/components/home/CreateMyPreview";
import HeroSection from "../../components/home/HeroSection";

export default function HomePage() {
  return (
    <main className="flex flex-col">
      <HeroSection />
      <IntroSection />
      <DetailSection />
      <ExploreSection />
      <HowItWorksSection />
      <CreateMyPreview />
    </main>
  );
}

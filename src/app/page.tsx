import {
  HeroSection,
  IntroSection,
  DetailSection,
  ExploreSection,
  HowItWorksSection,
  CreateMyPreview,
} from "@/features/home";

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

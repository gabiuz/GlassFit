import {
  HeroSection,
  DetailSection,
  ExploreSection,
  HowItWorksSection,
  CreateMyPreview,
} from "@/features/home";

export default function HomePage() {
  return (
    <main className="flex flex-col">
      <HeroSection />
      <DetailSection />
      <ExploreSection />
      <HowItWorksSection />
      <CreateMyPreview />
    </main>
  );
}

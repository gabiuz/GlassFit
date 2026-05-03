import IntroSection from "@/app/components/home/IntroSection";
import DetailSection from "@/app/components/home/DetailSection";
import HeroSection from "../../components/home/HeroSection";

export default function HomePage() {
  return (
    <main className="flex flex-col">
      <HeroSection />
      <IntroSection />
      <DetailSection />
    </main>
  );
}

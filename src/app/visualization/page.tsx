import { HeroSection, UploadImage, GuideLine } from "@/features/visualization";

export default function VisualizationPage() {
    return (
        <main className="flex flex-col">
            <HeroSection />
            <div className="flex flex-col gap-14 px-24.25 py-17.75">
                <UploadImage />
                <GuideLine />
            </div>
        </main>
    );
}
"use client";

import Image from "next/image";
import { useRef } from "react";
import type { CalibrationMode } from "@/lib/visualization/types";

type GuidelineType = "good" | "bad";

interface GuidelineCard {
    id: string;
    type: GuidelineType;
    title: string;
    description: string;
    logoSrc: string;
    imageSrc: string;
}

const standardGuidelines: GuidelineCard[] = [
    {
        id: "full-wall",
        type: "good",
        title: "Show the full wall",
        description: "Make sure the installation area is visible",
        logoSrc: "/guideline_assets/wall_icon.svg",
        imageSrc: "/guideline_assets/wall_asset.png",
    },
    {
        id: "good-lighting",
        type: "good",
        title: "Good Lighting",
        description: "Use a clear and well-lit photo",
        logoSrc: "/guideline_assets/light_icon.svg",
        imageSrc: "/guideline_assets/lighting_asset.png",
    },
    {
        id: "avoid-blur",
        type: "bad",
        title: "Avoid Blurry Image",
        description: "Avoid photos with too many obstructions",
        logoSrc: "/guideline_assets/avoid_icon.svg",
        imageSrc: "/guideline_assets/blurry_asset.png",
    },
    {
        id: "no-extreme",
        type: "bad",
        title: "No Extreme Angles",
        description: "Take the photo from a stable, straight angle",
        logoSrc: "/guideline_assets/avoid_icon.svg",
        imageSrc: "/guideline_assets/extreme_asset.png",
    },
];

const fiducialGuidelines: GuidelineCard[] = [
    {
        id: "paper-same-wall",
        type: "good",
        title: "Tape Flat on Target Wall",
        description: "Affix the paper to the exact same wall as the window or door opening. Both must share the same surface plane.",
        logoSrc: "/guideline_assets/wall_icon.svg",
        imageSrc: "/guideline_assets/paper_same_wall.png",
    },
    {
        id: "paper-corners-visible",
        type: "good",
        title: "All 4 Corners Clear",
        description: "Ensure the entire paper rectangle is in frame with no tape or objects covering the outer edges.",
        logoSrc: "/guideline_assets/light_icon.svg",
        imageSrc: "/guideline_assets/paper_corners_visible.png",
    },
    {
        id: "paper-wrong-wall",
        type: "bad",
        title: "Do Not Place on Side Walls or Floor",
        description: "Placing paper on floors, tables, or adjacent side walls distorts depth calibration and produces false measurements.",
        logoSrc: "/guideline_assets/avoid_icon.svg",
        imageSrc: "/guideline_assets/paper_wrong_wall.png",
    },
    {
        id: "paper-flat",
        type: "bad",
        title: "Ensure Paper Lies Completely Flat",
        description: "Curled or folded sheets cause perspective skew. Tape all 4 corners securely against the wall.",
        logoSrc: "/guideline_assets/avoid_icon.svg",
        imageSrc: "/guideline_assets/paper_flat.png",
    },
];

interface GuideLineProps {
    mode?: CalibrationMode;
}

export function GuideLine({ mode = "standard" }: GuideLineProps = {}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);
    const isFiducial = mode === "paper_fiducial";
    const cards = isFiducial ? fiducialGuidelines : standardGuidelines;

    const onMouseDown = (e: React.MouseEvent) => {
        const el = scrollRef.current;
        if (!el) return;
        isDragging.current = true;
        startX.current = e.pageX - el.offsetLeft;
        scrollLeft.current = el.scrollLeft;
        el.style.cursor = "grabbing";
        el.style.userSelect = "none";
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current || !scrollRef.current) return;
        e.preventDefault();
        const el = scrollRef.current;
        const x = e.pageX - el.offsetLeft;
        const walk = (x - startX.current) * 1.5;
        el.scrollLeft = scrollLeft.current - walk;
    };

    const stopDrag = () => {
        isDragging.current = false;
        if (scrollRef.current) {
            scrollRef.current.style.cursor = "grab";
            scrollRef.current.style.userSelect = "";
        }
    };

    return (
        <div className="w-full flex flex-col gap-6 px-0 sm:px-6 md:px-12 lg:pl-35 lg:pr-0">
            {/* Section heading */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-medium text-black">
                        {isFiducial ? "Precision Calibration Guidelines" : "Photo Guideline"}
                    </h2>
                    {isFiducial && (
                        <span className="rounded-full bg-cyan-100 px-3 py-0.5 text-xs font-semibold text-cyan-800">
                            Fiducial Paper Guidance
                        </span>
                    )}
                </div>
                {isFiducial && (
                    <p className="text-base text-neutral-600">
                        Follow these paper placement steps to achieve quote-ready dimensional accuracy (error within 2% to 5%).
                    </p>
                )}
            </div>

            {/* Carousel track */}
            <div
                ref={scrollRef}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={stopDrag}
                onMouseLeave={stopDrag}
                className="flex gap-4 sm:gap-8 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 no-scrollbar"
                style={{ scrollbarWidth: "none", cursor: "grab" }}
            >
                {cards.map((card) => (
                    <div
                        key={card.id}
                        className="snap-start shrink-0 w-[calc(100vw-3rem)] max-w-[387px] sm:w-[387px] h-[490px] sm:h-auto p-5 sm:p-7 bg-gray-900 rounded-[20px] flex flex-col justify-between items-start gap-4 sm:gap-7"
                    >
                        {/* Card header */}
                        <div className="flex justify-start items-center gap-4 sm:gap-7 w-full">
                            {/* Icon: replace logoSrc in the data above */}
                            <div className="size-14 sm:size-16 relative overflow-hidden shrink-0">
                                {card.logoSrc ? (
                                    <Image src={card.logoSrc} alt={card.title} fill className="object-contain select-none" draggable="false" />
                                ) : (
                                    <>
                                        <div
                                            className="w-8 h-7 left-[16.45px] top-[22.36px] absolute opacity-40"
                                            style={{ backgroundColor: card.type === "good" ? "#06B6D4" : "#EF4444" }}
                                        />
                                        <div
                                            className="size-12 left-[9.90px] top-[9.90px] absolute"
                                            style={{ backgroundColor: card.type === "good" ? "#06B6D4" : "#EF4444" }}
                                        />
                                    </>
                                )}
                            </div>
                            {/* Text */}
                            <div className="flex-1 min-w-0 sm:w-56 min-h-[72px] sm:min-h-[120px] flex flex-col justify-center sm:justify-start items-start gap-1 sm:gap-1.5">
                                <div className="text-white text-lg sm:text-2xl font-medium leading-snug sm:leading-7">
                                    {card.title}
                                </div>
                                <div className="self-stretch text-white text-sm sm:text-xl font-normal leading-snug sm:leading-7">
                                    {card.description}
                                </div>
                            </div>
                        </div>

                        {/* Card image: replace imageSrc in the data above */}
                        <div className="self-stretch flex-1 sm:flex-initial sm:h-72 overflow-hidden relative bg-gray-700 flex items-center justify-center rounded-xl sm:rounded-none">
                            {card.imageSrc ? (
                                <Image src={card.imageSrc} alt={card.title} fill className="object-cover select-none" draggable="false" />
                            ) : (
                                <p className="text-gray-500 text-sm">Image</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

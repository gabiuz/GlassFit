"use client";

import Image from "next/image";
import { useRef } from "react";

type GuidelineType = "good" | "bad";

interface GuidelineCard {
    id: string;
    type: GuidelineType;
    title: string;
    description: string;
    logoSrc: string;  // TODO: path to icon image, e.g. "/icons/full-wall.svg"
    imageSrc: string; // TODO: path to example photo, e.g. "/guidelines/full-wall.jpg"
}

const guidelines: GuidelineCard[] = [
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


export function GuideLine() {
    const scrollRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);

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
        <div className="w-full flex flex-col gap-6 pl-35">
            {/* Section heading */}
            <h2 className="text-3xl font-medium text-black">Photo Guideline</h2>

            {/* Carousel track */}
            <div
                ref={scrollRef}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={stopDrag}
                onMouseLeave={stopDrag}
                className="flex gap-8 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2"
                style={{ scrollbarWidth: "none", cursor: "grab" }}
            >
                {guidelines.map((card) => (
                    <div
                        key={card.id}
                        className="snap-start shrink-0 w-[387px] p-7 bg-gray-900 rounded-[20px] inline-flex flex-col justify-center items-start gap-7"
                    >
                        {/* Card header */}
                        <div className="inline-flex justify-start items-center gap-7">
                            {/* Icon — replace logoSrc in the data above */}
                            <div className="size-16 relative overflow-hidden shrink-0">
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
                            <div className="w-56 min-h-[120px] inline-flex flex-col justify-start items-start gap-1.5">
                                <div className="text-white text-2xl font-medium leading-7">
                                    {card.title}
                                </div>
                                <div className="self-stretch text-white text-xl font-normal leading-7">
                                    {card.description}
                                </div>
                            </div>
                        </div>

                        {/* Card image — replace imageSrc in the data above */}
                        <div className="self-stretch h-72 overflow-hidden relative bg-gray-700 flex items-center justify-center">
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

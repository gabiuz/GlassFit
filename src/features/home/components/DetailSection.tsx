"use client";
import { useEffect, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import { ChevronLeft, ChevronRight } from "lucide-react";

const SIDE_CARD_WIDTH = 384;
const ACTIVE_CARD_WIDTH = 478;
const CARD_HEIGHT = 400;
const TRACK_HORIZONTAL_PADDING = 48;
const DEFAULT_CARDS_WIDTH = SIDE_CARD_WIDTH * 2 + ACTIVE_CARD_WIDTH;

const detailCards = [
  {
    number: "01",
    title: "Product Catalog",
    description:
      "Browse glass and aluminum products with available variants, finishes, and pricing-based options.",
  },
  {
    number: "02",
    title: "Space Image Upload",
    description:
      "Upload a photo of the actual area where the product may be installed.",
  },
  {
    number: "03",
    title: "Image Analysis",
    description:
      "The system processes the uploaded image to prepare it for product placement and visual fitting.",
  },
  {
    number: "04",
    title: "Product Overlay",
    description:
      "Place the selected product on the uploaded image and adjust its size, scale, position, and orientation.",
  },
  {
    number: "05",
    title: "Visual Output",
    description:
      "Generate a preview that shows how the selected glass or aluminum product may appear in the user's space.",
  },
  {
    number: "06",
    title: "Price Estimation",
    description:
      "Receive an estimated price based on the selected product configuration and pricing rules.",
  },
  {
    number: "07",
    title: "Saved Configuration",
    description:
      "Save the selected product, customization details, visual output, and estimated price.",
  },
  {
    number: "08",
    title: "Signed Reference Link",
    description:
      "Generate a secure reference link that can be sent to the business through Messenger or Viber.",
  },
];

function wrapIndex(index: number, total: number) {
  return ((index % total) + total) % total;
}

export function DetailSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [cardScale, setCardScale] = useState(1);
  const carouselRef = useRef<HTMLDivElement>(null);
  const totalCards = detailCards.length;

  useEffect(() => {
    const carousel = carouselRef.current;

    if (!carousel) return;

    const updateCardScale = () => {
      const availableCardsWidth = Math.max(
        carousel.clientWidth - TRACK_HORIZONTAL_PADDING,
        0,
      );

      setCardScale(Math.min(1, availableCardsWidth / DEFAULT_CARDS_WIDTH));
    };

    updateCardScale();

    const resizeObserver = new ResizeObserver(updateCardScale);
    resizeObserver.observe(carousel);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => wrapIndex(prev + 1, totalCards));
    }, 2000);

    return () => clearInterval(interval);
  }, [activeIndex, isPaused, totalCards]);

  const leftIndex = wrapIndex(activeIndex - 1, totalCards);
  const rightIndex = wrapIndex(activeIndex + 1, totalCards);

  const displayedCards = [
    { card: detailCards[leftIndex], cardIndex: leftIndex, isActive: false },
    { card: detailCards[activeIndex], cardIndex: activeIndex, isActive: true },
    { card: detailCards[rightIndex], cardIndex: rightIndex, isActive: false },
  ];

  const handlePaginationClick = (nextIndex: number) => {
    setActiveIndex(nextIndex);
  };

  return (
    <section className="relative flex flex-col gap-17.5 bg-white py-12 px-6 lg:py-24 lg:px-28">
      <div className="w-full mx-auto text-center flex flex-col lg:flex-row justify-between items-center gap-6 lg:gap-12.5 3xl:max-w-420 5xl:max-w-410">
        <h2 className="text-3xl text-center sm:text-4xl lg:text-5xl font-medium capitalize leading-tight lg:leading-[57.60px] lg:text-start">
          <span className="bg-grad-light bg-clip-text text-transparent">
            Plan Your Glass and Aluminum
            <br />
          </span>
          <span className="bg-grad-light bg-clip-text text-transparent">
            Project with Confidence
          </span>
        </h2>
        <p className="w-full lg:w-140.5 text-center lg:text-start text-black text-lg lg:text-xl font-normal leading-7">
          GlassFit combines product browsing, image-based visualization,
          customization, and estimated pricing to help customers prepare better
          before talking to the business.
        </p>
      </div>
      {/* Mobile: single active card + swipe navigation */}
      <div
        className="lg:hidden flex flex-col gap-6"
        onTouchStart={(e) => {
          const touch = e.touches[0];
          (e.currentTarget as HTMLDivElement).dataset.touchStartX = String(touch.clientX);
        }}
        onTouchEnd={(e) => {
          const startX = Number((e.currentTarget as HTMLDivElement).dataset.touchStartX ?? 0);
          const endX = e.changedTouches[0].clientX;
          const diff = startX - endX;
          if (Math.abs(diff) > 40) {
            if (diff > 0) {
              setActiveIndex((prev) => wrapIndex(prev + 1, totalCards));
            } else {
              setActiveIndex((prev) => wrapIndex(prev - 1, totalCards));
            }
          }
        }}
      >
        {/* Active card */}
        <div className="w-full h-[420px] overflow-hidden">
          <Card
            number={detailCards[activeIndex].number}
            title={detailCards[activeIndex].title}
            description={detailCards[activeIndex].description}
            isActive={true}
            className="w-full rounded-[25px] h-full"
          />
        </div>

        {/* Mobile navigation row: prev arrow + dots + next arrow */}
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            aria-label="Previous card"
            onClick={() => setActiveIndex((prev) => wrapIndex(prev - 1, totalCards))}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/10 transition-colors hover:bg-black/20"
          >
            <ChevronLeft className="h-4 w-4 text-black" />
          </button>

          <div className="flex items-center gap-3">
            {detailCards.map((card, index) => {
              const isActiveDot = index === activeIndex;
              return (
                <button
                  type="button"
                  key={card.number}
                  onClick={() => handlePaginationClick(index)}
                  className={`h-2.5 cursor-pointer rounded-full transition-all duration-300 ${isActiveDot ? "w-5 bg-green" : "w-2.5 bg-black/30"
                    }`}
                />
              );
            })}
          </div>

          <button
            type="button"
            aria-label="Next card"
            onClick={() => setActiveIndex((prev) => wrapIndex(prev + 1, totalCards))}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/10 transition-colors hover:bg-black/20"
          >
            <ChevronRight className="h-4 w-4 text-black" />
          </button>
        </div>
      </div>

      {/* Desktop: 3-card carousel */}
      <div
        className="hidden lg:block w-full mx-auto"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Cards Container */}
        <div
          ref={carouselRef}
          className="mx-auto max-w-full overflow-visible py-4"
        >
          <div className="flex items-end justify-center px-6">
            {displayedCards.map(({ card, cardIndex, isActive }) => {
              const cardWidth = isActive
                ? ACTIVE_CARD_WIDTH
                : SIDE_CARD_WIDTH;

              return (
                <div
                  key={card.number}
                  onClick={() => setActiveIndex(cardIndex)}
                  className="flex shrink-0 cursor-pointer items-end origin-bottom"
                  style={{
                    width: cardWidth * cardScale,
                    height: CARD_HEIGHT * cardScale,
                  }}
                >
                  <div
                    className="origin-bottom-left"
                    style={{ transform: `scale(${cardScale})` }}
                  >
                    <Card
                      number={card.number}
                      title={card.title}
                      description={card.description}
                      isActive={isActive}
                      className={isActive ? "w-[29.875rem]" : "w-96"}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="hidden lg:flex items-center justify-center gap-6">
        <div className="flex items-center gap-3">
          {detailCards.map((card, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                type="button"
                key={card.number}
                onClick={() => handlePaginationClick(index)}
                className={`h-2.5 w-2.5 cursor-pointer rounded-full ${isActive ? "bg-green" : "bg-black/30"
                  }`}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

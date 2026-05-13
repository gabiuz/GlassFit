"use client";
import { useState } from "react";
import { motion } from "motion/react";
import Card from "../ui/Card";

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

const CARD_WIDTH_REM = 24;
const ACTIVE_CARD_WIDTH_REM = 29.875;
const SECTION_INLINE_PADDING_REM = 7;
const CAROUSEL_TRANSITION = {
  duration: 0.5,
  ease: [0.22, 1, 0.36, 1],
} as const;

function wrapIndex(index: number, total: number) {
  return ((index % total) + total) % total;
}

function getActiveSlot(totalCards: number) {
  return Math.floor((totalCards - 1) / 2);
}

function getShortestDistance(
  currentIndex: number,
  nextIndex: number,
  total: number,
) {
  const forwardDistance = wrapIndex(nextIndex - currentIndex, total);
  const backwardDistance = forwardDistance - total;

  return Math.abs(forwardDistance) <= Math.abs(backwardDistance)
    ? forwardDistance
    : backwardDistance;
}

function getLoopedCards<T>(cards: T[], activeIndex: number) {
  const totalCards = cards.length;
  const activeSlot = getActiveSlot(totalCards);

  return Array.from({ length: totalCards }, (_, slot) => {
    const cardIndex = wrapIndex(activeIndex - activeSlot + slot, totalCards);

    return {
      card: cards[cardIndex],
      cardIndex,
    };
  });
}

export default function DetailSection() {
  const [carouselState, setCarouselState] = useState({
    activeIndex: 0,
    displayIndex: 0,
    isSliding: false,
    slideOffsetRem: 0,
  });
  const totalCards = detailCards.length;
  const activeSlot = getActiveSlot(totalCards);
  const activeCardCenterOffsetRem =
    activeSlot * CARD_WIDTH_REM + ACTIVE_CARD_WIDTH_REM / 2;
  const carouselCards = getLoopedCards(detailCards, carouselState.displayIndex);
  const activeFeatureIndex = carouselState.activeIndex;

  const handlePaginationClick = (nextIndex: number) => {
    setCarouselState((currentState) => {
      if (nextIndex === currentState.activeIndex) {
        return currentState;
      }

      const distance = getShortestDistance(
        currentState.activeIndex,
        nextIndex,
        totalCards,
      );

      return {
        activeIndex: wrapIndex(nextIndex, totalCards),
        displayIndex: currentState.activeIndex,
        isSliding: true,
        slideOffsetRem: -distance * CARD_WIDTH_REM,
      };
    });
  };

  const handleSlideComplete = () => {
    setCarouselState((currentState) => {
      if (!currentState.isSliding) {
        return currentState;
      }

      return {
        ...currentState,
        displayIndex: currentState.activeIndex,
        isSliding: false,
        slideOffsetRem: 0,
      };
    });
  };

  return (
    <section className="relative flex flex-col gap-17.5 bg-white py-24 px-28">
      <div className="w-fit flex justify-between items-center gap-12.5">
        <h2 className=" whitespace-nowrap text-5xl font-medium capitalize leading-[57.60px] text-start">
          <span className="bg-grad-light bg-clip-text text-transparent">
            Plan Your Glass and Aluminum
            <br />
          </span>
          <span className="bg-grad-light bg-clip-text text-transparent">
            Project with Confidence
          </span>
        </h2>
        <p className="w-140.5 text-black text-xl font-normal leading-7">
          GlassFit combines product browsing, image-based visualization,
          customization, and estimated pricing to help customers prepare better
          before talking to the business.
        </p>
      </div>
      <div className="overflow-x-hidden overflow-y-visible">
        <motion.div
          className="flex items-end"
          animate={{
            x: `calc(50vw - ${
              SECTION_INLINE_PADDING_REM + activeCardCenterOffsetRem
            }rem + ${carouselState.slideOffsetRem}rem)`,
          }}
          transition={
            carouselState.isSliding ? CAROUSEL_TRANSITION : { duration: 0 }
          }
          onAnimationComplete={handleSlideComplete}
          style={{
            transformOrigin: "bottom center",
          }}
        >
          {carouselCards.map(({ card, cardIndex }) => {
            const isActive = cardIndex === carouselState.activeIndex;

            return (
              <div key={card.number} className="shrink-0 origin-bottom">
                <Card
                  number={card.number}
                  title={card.title}
                  description={card.description}
                  isActive={isActive}
                  className={`transition-[width] duration-500 ease-out ${
                    isActive ? "w-119.5" : ""
                  }`}
                />
              </div>
            );
          })}
        </motion.div>
      </div>
      <div className="flex items-center justify-center gap-6">
        <div className="flex items-center gap-3">
          {detailCards.map((card, index) => {
            const isActive = index === activeFeatureIndex;
            return (
              <button
                type="button"
                key={card.number}
                onClick={() => handlePaginationClick(index)}
                className={`h-2.5 w-2.5 cursor-pointer rounded-full ${
                  isActive ? "bg-green" : "bg-black/30"
                }`}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

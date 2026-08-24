"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const CARD_COUNT = 8;
const TOTAL_CARDS = CARD_COUNT * 3;
const INTERVAL_MS = 2000;
const INACTIVE_CARD_WIDTH = 409;
const INACTIVE_CARD_HEIGHT = 296;
const ACTIVE_CARD_WIDTH = 469;
const ACTIVE_CARD_HEIGHT = 394;
const TRACK_WIDTH = INACTIVE_CARD_WIDTH * 2 + ACTIVE_CARD_WIDTH;
const TRACK_HORIZONTAL_PADDING = 48;
const LOOP_START = CARD_COUNT;
const LOOP_END = CARD_COUNT * 2 - 1;
const INITIAL_ACTIVE = LOOP_START;

const spring = { type: "spring" as const, stiffness: 80, damping: 22 };

const detailCards = [
  {
    title: "Product Catalog",
    description:
      "Browse glass and aluminum products with available variants, finishes, and pricing-based options.",
  },
  {
    title: "Space Image Upload",
    description:
      "Upload a photo of the actual area where the product may be installed.",
  },
  {
    title: "Image Analysis",
    description:
      "The system processes the uploaded image to prepare it for product placement and visual fitting.",
  },
  {
    title: "Product Overlay",
    description:
      "Place the selected product on the uploaded image and adjust its size, scale, position, and orientation.",
  },
  {
    title: "Visual Output",
    description:
      "Generate a preview that shows how the selected glass or aluminum product may appear in the user's space.",
  },
  {
    title: "Price Estimation",
    description:
      "Receive an estimated price based on the selected product configuration and pricing rules.",
  },
  {
    title: "Saved Configuration",
    description:
      "Save the selected product, customization details, visual output, and estimated price.",
  },
  {
    title: "Signed Reference Link",
    description:
      "Generate a secure reference link that can be sent to the business through Messenger or Viber.",
  },
];

function getFeatureIndex(index: number) {
  return ((index % CARD_COUNT) + CARD_COUNT) % CARD_COUNT;
}

function getCardNumber(index: number) {
  return String(getFeatureIndex(index) + 1).padStart(2, "0");
}

function calcOffset(index: number) {
  return TRACK_WIDTH / 2 - index * INACTIVE_CARD_WIDTH - ACTIVE_CARD_WIDTH / 2;
}

type DetailCardProps = {
  index: number;
  isActive: boolean;
  isMobile?: boolean;
};

function DetailCard({ index, isActive, isMobile = false }: DetailCardProps) {
  const feature = detailCards[getFeatureIndex(index)];
  const cardNumber = getCardNumber(index);
  const cardTransition = isMobile ? { duration: 0 } : spring;

  return (
    <motion.article
      animate={
        isMobile
          ? undefined
          : {
              width: isActive ? ACTIVE_CARD_WIDTH : INACTIVE_CARD_WIDTH,
              height: isActive ? ACTIVE_CARD_HEIGHT : INACTIVE_CARD_HEIGHT,
            }
      }
      transition={cardTransition}
      className="relative shrink-0 overflow-hidden rounded-t-[25px] bg-black text-white"
      style={{
        width: isMobile
          ? "100%"
          : isActive
            ? ACTIVE_CARD_WIDTH
            : INACTIVE_CARD_WIDTH,
        height: isMobile
          ? 420
          : isActive
            ? ACTIVE_CARD_HEIGHT
            : INACTIVE_CARD_HEIGHT,
      }}
      aria-hidden={!isActive && !isMobile}
    >
      <motion.div
        className="absolute inset-0 bg-black"
        initial={{ opacity: isActive ? 0 : 1 }}
        animate={{ opacity: isActive ? 0 : 1 }}
        transition={{ duration: isMobile ? 0 : 0.2, ease: "easeOut" }}
      />
      <motion.div
        className="absolute inset-0 bg-grad-light"
        initial={{ opacity: isActive ? 1 : 0 }}
        animate={{ opacity: isActive ? 1 : 0 }}
        transition={{ duration: isMobile ? 0 : 0.2, ease: "easeOut" }}
      />

      <div
        className="absolute z-10 flex flex-col items-start gap-5 px-7 py-10 sm:px-8"
        style={{
          top: 0,
          left: 0,
          width: isMobile ? "100%" : ACTIVE_CARD_WIDTH,
          height: ACTIVE_CARD_HEIGHT,
        }}
      >
        <p className="text-5xl font-medium leading-tight text-white">
          {cardNumber}
        </p>

        <div className="flex flex-col items-start gap-8">
          <h3 className="text-3xl font-medium leading-10 text-white">
            {feature.title}
          </h3>

          <motion.p
            className="max-w-[26.375rem] overflow-hidden text-base leading-7 text-white/70 lg:text-xl"
            initial={{
              clipPath:
                isActive || isMobile
                  ? "inset(0% 0% 0% 0%)"
                  : "inset(0% 0% 100% 0%)",
              opacity: isActive || isMobile ? 1 : 0,
            }}
            animate={{
              clipPath:
                isActive || isMobile
                  ? "inset(0% 0% 0% 0%)"
                  : "inset(0% 0% 100% 0%)",
              opacity: isActive || isMobile ? 1 : 0,
            }}
            transition={{ duration: isMobile ? 0 : 0.2, ease: "easeOut" }}
          >
            {feature.description}
          </motion.p>
        </div>
      </div>
    </motion.article>
  );
}

export function DetailSection() {
  const shouldReduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(INITIAL_ACTIVE);
  const [isPaused, setIsPaused] = useState(false);
  const [cardScale, setCardScale] = useState(1);
  const [autoAdvanceResetKey, setAutoAdvanceResetKey] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(calcOffset(INITIAL_ACTIVE));
  const stripTransform = useMotionTemplate`translateX(${x}px)`;
  const activeFeatureIndex = getFeatureIndex(activeIndex);

  const animateTo = useCallback(
    (index: number) => {
      x.stop();
      if (shouldReduceMotion) {
        x.set(calcOffset(index));
        return;
      }

      animate(x, calcOffset(index), spring);
    },
    [shouldReduceMotion, x],
  );

  const goNext = useCallback(() => {
    setActiveIndex((previousIndex) => {
      const nextIndex = previousIndex + 1;

      if (nextIndex > LOOP_END) {
        const snapIndex = previousIndex - CARD_COUNT;
        x.set(calcOffset(snapIndex));

        requestAnimationFrame(() => {
          const resumeIndex = snapIndex + 1;
          animateTo(resumeIndex);
          setActiveIndex(resumeIndex);
        });

        return snapIndex;
      }

      animateTo(nextIndex);
      return nextIndex;
    });
  }, [animateTo, x]);

  const goPrevious = useCallback(() => {
    setActiveIndex((previousIndex) => {
      const nextIndex = previousIndex - 1;

      if (nextIndex < LOOP_START) {
        const snapIndex = previousIndex + CARD_COUNT;
        x.set(calcOffset(snapIndex));

        requestAnimationFrame(() => {
          const resumeIndex = snapIndex - 1;
          animateTo(resumeIndex);
          setActiveIndex(resumeIndex);
        });

        return snapIndex;
      }

      animateTo(nextIndex);
      return nextIndex;
    });
  }, [animateTo, x]);

  const resetAutoAdvance = useCallback(() => {
    setAutoAdvanceResetKey((key) => key + 1);
  }, []);

  const handleNextClick = () => {
    resetAutoAdvance();
    goNext();
  };

  const handlePreviousClick = () => {
    resetAutoAdvance();
    goPrevious();
  };

  const handlePaginationClick = (nextFeatureIndex: number) => {
    const nextIndex = LOOP_START + nextFeatureIndex;

    resetAutoAdvance();
    setActiveIndex(nextIndex);
    animateTo(nextIndex);
  };

  useEffect(() => {
    const carousel = carouselRef.current;

    if (!carousel) return;

    const updateCardScale = () => {
      const availableCardsWidth = Math.max(
        carousel.clientWidth - TRACK_HORIZONTAL_PADDING,
        0,
      );

      setCardScale(Math.min(1, availableCardsWidth / TRACK_WIDTH));
    };

    updateCardScale();

    const resizeObserver = new ResizeObserver(updateCardScale);
    resizeObserver.observe(carousel);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (isPaused || shouldReduceMotion) return;

    const interval = setInterval(goNext, INTERVAL_MS);

    return () => clearInterval(interval);
  }, [autoAdvanceResetKey, goNext, isPaused, shouldReduceMotion]);

  return (
    <section className="relative flex flex-col gap-17.5 bg-white px-6 py-12 lg:px-28 lg:py-24">
      <div className="mx-auto flex w-full flex-col items-center justify-between gap-6 text-center lg:flex-row lg:gap-12.5 3xl:max-w-420 5xl:max-w-410">
        <h2 className="text-center text-3xl font-medium capitalize leading-tight sm:text-4xl lg:text-start lg:text-5xl lg:leading-[57.60px]">
          <span className="bg-grad-light bg-clip-text text-transparent">
            Plan Your Glass and Aluminum
            <br />
          </span>
          <span className="bg-grad-light bg-clip-text text-transparent">
            Project with Confidence
          </span>
        </h2>
        <p className="w-full text-center text-lg font-normal leading-7 text-black lg:w-140.5 lg:text-start lg:text-xl">
          GlassFit combines product browsing, image-based visualization,
          customization, and estimated pricing to help customers prepare better
          before talking to the business.
        </p>
      </div>

      <div
        className="flex flex-col gap-6 lg:hidden"
        onTouchStart={(event) => {
          const touch = event.touches[0];
          event.currentTarget.dataset.touchStartX = String(touch.clientX);
        }}
        onTouchEnd={(event) => {
          const startX = Number(event.currentTarget.dataset.touchStartX ?? 0);
          const endX = event.changedTouches[0].clientX;
          const diff = startX - endX;

          if (Math.abs(diff) > 40) {
            resetAutoAdvance();

            if (diff > 0) {
              goNext();
            } else {
              goPrevious();
            }
          }
        }}
      >
        <DetailCard index={activeIndex} isActive isMobile />

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            aria-label="Previous card"
            onClick={handlePreviousClick}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/10 transition-colors hover:bg-black/20"
          >
            <ChevronLeft className="h-4 w-4 text-black" />
          </button>

          <div className="flex items-center gap-3">
            {detailCards.map((card, index) => {
              const isActiveDot = index === activeFeatureIndex;

              return (
                <button
                  type="button"
                  key={card.title}
                  aria-label={`Show ${card.title}`}
                  onClick={() => handlePaginationClick(index)}
                  className={`h-2.5 rounded-full transition-all duration-200 ${
                    isActiveDot ? "w-5 bg-green" : "w-2.5 bg-black/30"
                  }`}
                />
              );
            })}
          </div>

          <button
            type="button"
            aria-label="Next card"
            onClick={handleNextClick}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/10 transition-colors hover:bg-black/20"
          >
            <ChevronRight className="h-4 w-4 text-black" />
          </button>
        </div>
      </div>

      <div
        className="hidden w-full lg:block"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >
        <div ref={carouselRef} className="mx-auto max-w-full overflow-visible">
          <div
            className="mx-auto overflow-hidden"
            style={{
              width: TRACK_WIDTH * cardScale,
              height: ACTIVE_CARD_HEIGHT * cardScale,
            }}
          >
            <div
              className="origin-bottom-left"
              style={{
                width: TRACK_WIDTH,
                height: ACTIVE_CARD_HEIGHT,
                transform: `scale(${cardScale})`,
              }}
            >
              <div
                className="flex items-end overflow-hidden"
                style={{ width: TRACK_WIDTH, height: ACTIVE_CARD_HEIGHT }}
              >
                <motion.div
                  className="flex items-end"
                  style={{ transform: stripTransform }}
                >
                  {Array.from({ length: TOTAL_CARDS }).map((_, index) => (
                    <DetailCard
                      key={index}
                      index={index}
                      isActive={index === activeIndex}
                    />
                  ))}
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden items-center justify-center gap-6 lg:flex">
        <div className="flex items-center gap-3">
          {detailCards.map((card, index) => {
            const isActiveDot = index === activeFeatureIndex;

            return (
              <button
                type="button"
                key={card.title}
                aria-label={`Show ${card.title}`}
                onClick={() => handlePaginationClick(index)}
                className={`h-2.5 rounded-full transition-all duration-200 ${
                  isActiveDot ? "w-5 bg-green" : "w-2.5 bg-black/30"
                }`}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

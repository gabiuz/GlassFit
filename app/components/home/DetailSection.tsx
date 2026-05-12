"use client";
import { useEffect, useState } from "react";
import * as motion from "motion/react-client";
import Card from "../ui/Card";
import { AnimatePresence } from "motion/react";

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

// Number of cards visible in the carousel window at once.
const VISIBLE_COUNT = 5;
// Index within the visible window that receives the highlighted style.
const HIGHLIGHTED_SLOT = 1;

export default function DetailSection() {
  const total = detailCards.length;
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % total);
    }, 3500);
    return () => clearInterval(id);
  }, [total]);

  // Derive the visible window via modulo — detailCards is never mutated.
  const visibleCards = Array.from({ length: VISIBLE_COUNT }, (_, i) =>
    detailCards[(activeIndex + i) % total],
  );

  return (
    <section className="relative flex flex-col gap-17.5 bg-white py-24 px-28">
      <div className="w-fit flex justify-between items-center gap-12.5">
        <h2 className="whitespace-nowrap text-5xl font-medium capitalize leading-[57.60px] text-start">
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
        <div className="relative flex items-end">
          <AnimatePresence initial={false} mode="popLayout">
            {visibleCards.map((card, index) => {
              const isHighlighted = index === HIGHLIGHTED_SLOT;
              return (
                <motion.div
                  // Stable key — card.number is unique across the dataset.
                  // AnimatePresence uses this to know exactly which card
                  // entered and which exited each tick.
                  key={card.number}
                  layout
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ type: "spring", stiffness: 180, damping: 24 }}
                >
                  <Card
                    number={card.number}
                    title={card.title}
                    description={isHighlighted ? card.description : undefined}
                    className={isHighlighted ? "w-119.5 bg-grad-light" : ""}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

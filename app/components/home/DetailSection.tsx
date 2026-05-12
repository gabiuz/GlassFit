"use client";
import { useState } from "react";
import * as motion from "motion/react-client";
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

export default function DetailSection() {
  const [middleIndex, setMiddleIndex] = useState(0);
  const middleSlot = 1;
  const totalCards = detailCards.length;
  const visibleCards = Array.from({ length: 3 }, (_, offset) => {
    const index = (middleIndex - middleSlot + offset + totalCards) % totalCards;
    return detailCards[index];
  });
  const activeFeatureIndex = middleIndex;

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
        <div className="flex items-end">
          {visibleCards.map((card, index) => {
            const isMiddleCard = index === middleSlot;
            return (
              <motion.div
                key={card.number}
                layout
                transition={{ type: "spring", stiffness: 180, damping: 24 }}
              >
                <Card
                  number={card.number}
                  title={card.title}
                  description={isMiddleCard ? card.description : undefined}
                  className={isMiddleCard ? "w-119.5 bg-grad-light" : ""}
                />
              </motion.div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-center gap-6">
        <div className="flex items-center gap-3">
          {detailCards.map((card, index) => {
            const isActive = index === activeFeatureIndex;
            return (
              <button
                type="button"
                key={card.number}
                onClick={() => setMiddleIndex(index)}
                className={`h-2.5 w-2.5 cursor-pointer rounded-full transition-colors ${
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

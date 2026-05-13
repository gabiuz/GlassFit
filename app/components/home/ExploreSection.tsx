import Card from "../shared/Card";

const exploreCards = [
  {
    number: "01",
    title: "Glass Doors",
    description:
      "Explore glass and aluminum door styles for entrances, rooms, and office areas.",
    imageUrl: "/glass_door.svg",
    imageAlt: "Glass door",
  },
  {
    number: "02",
    title: "Shower Enclosures",
    description: "Replace with product highlight copy.",
    imageUrl: "/glass_door.svg",
    imageAlt: "Shower enclosure",
  },
  {
    number: "03",
    title: "Office Partitions",
    description: "Replace with product highlight copy.",
    imageUrl: "/glass_door.svg",
    imageAlt: "Office partitions",
  },
  {
    number: "04",
    title: "Storefront Systems",
    description: "Replace with product highlight copy.",
    imageUrl: "/glass_door.svg",
    imageAlt: "Storefront systems",
  },
  {
    number: "05",
    title: "Window Systems",
    description: "Replace with product highlight copy.",
    imageUrl: "/glass_door.svg",
    imageAlt: "Window systems",
  },
  {
    number: "06",
    title: "Aluminum Frames",
    description: "Replace with product highlight copy.",
    imageUrl: "/glass_door.svg",
    imageAlt: "Aluminum frames",
  },
];

export default function ExploreSection() {
  return (
    <section className="relative bg-grad-dark py-24 px-28">
      <div className="flex flex-col gap-20.25">
        <div className="flex flex-col gap-5">
          <h2 className="text-5xl text-white font-medium text-center capitalize leading-[57.60px] ">
            Explore glass and aluminum products
          </h2>
          <p className="text-white text-center text-xl font-normal leading-7">
            Choose from different glass and aluminum products designed for
            homes, offices, stores, and commercial spaces.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {exploreCards.map((card) => (
            <Card
              key={card.title}
              number={card.number}
              title={card.title}
              description={card.description}
              imageUrl={card.imageUrl}
              imageAlt={card.imageAlt}
              layout="explore"
            />
          ))}
        </div>
      </div>
    </section>
  );
}

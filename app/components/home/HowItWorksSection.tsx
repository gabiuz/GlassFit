import Image from "next/image";

const howItWorksSteps = [
  {
    title: "Browse Products",
    description:
      "Explore available glass and aluminum products, including windows, doors, partitions, cabinets, enclosures, railings, and other fittings.",
    icon: "/magnifying_glass.svg",
  },
  {
    title: "Upload a Space Image",
    description:
      "Add a clear photo of the area where the product may be installed.",
    icon: "/cloud_up.svg",
  },
  {
    title: "Customize the Product Overlay",
    description:
      "Place, move, resize, rotate, and adjust the selected product on the uploaded space image.",
    icon: "/crop.svg",
  },
  {
    title: "View the Visual Output",
    description:
      "Review the generated preview to see how the selected product may look in the actual space.",
    icon: "/eye.svg",
  },
  {
    title: "Get an Estimated Price",
    description:
      "Generate an estimated price based on the chosen product, variant, size, and customization details.",
    icon: "/calculator.svg",
  },
  {
    title: "Send a Reference Link",
    description:
      "Log in or register, save the configuration, and send the generated reference link to the business through Messenger or Viber.",
    icon: "/link.svg",
  },
];

export default function HowItWorksSection() {
  return (
    <section className="relative bg-white px-27.5 py-25">
      <div className="mx-auto flex w-full max-w-360 flex-col items-center gap-28">
        <div className="flex flex-col items-center gap-5 text-center">
          <h2 className="bg-grad-light bg-clip-text text-5xl font-medium leading-[57.60px] text-transparent">
            How GlassFit Works
          </h2>
          <p className="w-270.75 text-xl font-normal leading-7  text-black">
            GlassFit makes it easier to plan glass and aluminum projects by
            turning a simple space photo into a useful design reference.
            Customers can explore products, create a visual preview, review an
            estimated price, and send the final reference to the business for
            consultation.
          </p>
        </div>
        <div className="flex items-center gap-30">
          <div className="relative h-216.5 w-120.5 shrink-0 overflow-hidden">
            <Image
              src="/images/glass_door_2.png"
              alt="Glass door preview"
              className="object-cover object-left"
              width={482}
              height={866}
              priority
            />
          </div>
          <div className="flex w-180.5 flex-col gap-7.5">
            {howItWorksSteps.map((step) => (
              <div key={step.title} className="flex items-center gap-7.5">
                <div className="relative h-16.5 w-16.5 shrink-0">
                  <Image
                    src={step.icon}
                    alt=""
                    width={66}
                    height={66}
                    aria-hidden="true"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-3xl font-medium leading-10  text-black">
                    {step.title}
                  </h3>
                  <p className="text-xl font-normal leading-7  text-[#262323]">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

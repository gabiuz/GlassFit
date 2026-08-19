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

export function HowItWorksSection() {
  return (
    <section className="relative bg-white px-4 py-12 lg:px-27.5 lg:py-25">
      <div className="mx-auto flex w-full max-w-360 flex-col items-center gap-12 lg:gap-28">
        <div className="flex flex-col items-center gap-5 text-center">
          <h2 className="bg-grad-light bg-clip-text text-3xl sm:text-4xl lg:text-5xl font-medium leading-tight lg:leading-[57.60px] text-transparent">
            How GlassFit Works
          </h2>
          <p className="w-full max-w-4xl text-lg lg:text-xl font-normal leading-7  text-black">
            GlassFit makes it easier to plan glass and aluminum projects by
            turning a simple space photo into a useful design reference.
            Customers can explore products, create a visual preview, review an
            estimated price, and send the final reference to the business for
            consultation.
          </p>
        </div>
        <div className="flex w-full flex-col items-center gap-12 lg:flex-row lg:gap-12 xl:gap-20 2xl:gap-30">
          <div className="relative hidden h-216.5 w-[36%] max-w-120.5 overflow-hidden lg:block">
            <Image
              src="/images/glass_door_2.png"
              alt="Glass door preview"
              className="object-cover object-left"
              width={482}
              height={866}
              priority
            />
          </div>
          <div className="flex w-full min-w-0 flex-1 flex-col gap-5 sm:gap-6 lg:gap-7.5 lg:max-w-180.5">
            {howItWorksSteps.map((step) => (
              <div
                key={step.title}
                className="flex flex-col items-start sm:items-start gap-3 sm:gap-5 lg:gap-7.5 lg:flex-row"
              >
                <div className="relative w-[50px] h-[50px] md:w-14 md:h-14 lg:h-16.5 lg:w-16.5 shrink-0">
                  <Image
                    src={step.icon}
                    alt=""
                    fill
                    aria-hidden="true"
                    className="object-contain"
                  />
                </div>
                <div className="flex flex-col gap-0.5 sm:gap-1 lg:gap-1.5">
                  <h3 className="text-base sm:text-lg md:text-xl lg:text-3xl font-medium leading-tight lg:leading-10 text-black">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm md:text-base lg:text-xl font-normal leading-relaxed lg:leading-7 text-[#262323]">
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

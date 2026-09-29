import Image from "next/image";

const navbarIcons = [
  {
    key: "location",
    src: "/navbar_icons/location.svg",
    label: "Bicutan, Parañaque",
  },
  {
    key: "phone",
    src: "/navbar_icons/phone.svg",
    label: "+639 0676 676",
  },
  {
    key: "clock",
    src: "/navbar_icons/clock.svg",
    label: "Monday - Friday, 6:00AM - 7:00PM",
  },
];

export function HeroSection() {
  return (
    <section className="relative z-0 bg-white-20">
      <div className="hidden lg:block bg-grad-dark py-2.5 font-normal text-white">
        <div className="flex flex-wrap justify-center items-center gap-6.25">
          {navbarIcons.map((icon) => (
            <div key={icon.key} className="flex items-center gap-2">
              <Image
                src={icon.src}
                alt=""
                width={16}
                height={16}
                aria-hidden="true"
              />
              <p>{icon.label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="relative min-h-60 md:min-h-115">
        <div className="absolute inset-0 overflow-hidden">
          <video
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            loop
            muted
            playsInline
          >
            <source src="/hero_video.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-white/70"></div>
        </div>
        <div className="relative z-10">
          <div className="flex min-h-60 md:min-h-115 items-center justify-center px-4">
            <h1 className="text-4xl sm:text-6xl lg:text-8xl text-black font-medium text-center uppercase leading-tight lg:leading-[115.20px]">
              <span className="bg-grad-light bg-clip-text text-transparent">
                Privacy Policy
              </span>
            </h1>
          </div>
        </div>
      </div>
    </section>
  );
}

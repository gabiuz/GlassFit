import Image from "next/image";

const contactItems = [
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

export function ProfileHero() {
  return (
    <section className="relative z-0 bg-white">
      {/* Top Contact Bar */}
      <div className="hidden lg:block bg-grad-dark py-2.5 font-normal text-white">
        <div className="flex flex-wrap justify-center items-center gap-6.25">
          {contactItems.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <Image
                src={item.src}
                alt=""
                width={16}
                height={16}
                aria-hidden="true"
              />
              <p className="text-sm tracking-[-0.3px]">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Hero Banner with Video Overlay (Figma node 1371:7403) */}
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
          <div className="absolute inset-0 bg-white/70" />
        </div>
        <div className="relative z-10 flex min-h-60 md:min-h-115 items-center justify-center px-4 pt-16 lg:pt-20">
          <h1 className="text-4xl sm:text-6xl lg:text-[96px] font-medium text-center uppercase tracking-[-1.824px] leading-tight lg:leading-[115.20px]">
            <span className="bg-grad-light bg-clip-text text-transparent">
              MY PROFILE
            </span>
          </h1>
        </div>
      </div>
    </section>
  );
}

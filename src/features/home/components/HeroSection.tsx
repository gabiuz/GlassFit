import Image from "next/image";
import Link from "next/link";
import Button from "@/components/shared/Button";

const navbarIcons = [
  {
    key: "location",
    src: "/navbar_icons/location.svg",
    label: "Bicutan, Parañaque",
  },
  {
    key: "phone",
    src: "/navbar_icons/phone.svg",
    label: "0918-601-4737",
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
      <div className="relative min-h-[85vh] md:min-h-[85vh] lg:min-h-screen xl:min-h-[120vh] 5xl:min-h-[110vh]!">
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 shadow-[inset_0_-26px_30px_-26px_rgba(0,0,0,0.25)]"></div>
        <div className="hidden xl:block pointer-events-none absolute -bottom-2 right-0 z-20 h-30 w-[38%] 2xl:w-[45%] 4xl:w-[50%] 5xl:!w-[55%] 4xl:h-40 5xl:!h-48 filter-[drop-shadow(0_-2px_24px_rgba(0,0,0,0.25))]">
          <div className="h-full w-full bg-white [clip-path:polygon(40%_0,100%_0,100%_100%,0_100%)]"></div>
        </div>
        <Image
          src="/glass_door.svg"
          alt=""
          width={2000}
          height={1125}
          aria-hidden="true"
          className="hidden xl:block pointer-events-none absolute xl:w-167.5 xl:h-236.5 xl:-bottom-22 2xl:w-192.5 2xl:h-272 2xl:-bottom-30 5xl:w-280! 5xl:h-395! 5xl:-bottom-44! right-0 z-30"
        />
        <div className="relative z-10">
          <div className="px-6 pt-32 pb-12 flex justify-start items-start md:pl-16 md:pt-48 lg:pl-27 lg:pt-57 lg:pb-0 4xl:pl-36 4xl:pt-64 5xl:pl-48! 5xl:pt-72!">
            <div className="flex w-full max-w-full flex-col gap-6 font-[family-name:var(--font-made-okine)] xl:max-w-[480px] xl:gap-7 2xl:max-w-[540px] 3xl:max-w-[700px] 4xl:max-w-[777px] 4xl:gap-[34px]">
              <div className="flex flex-col gap-2 4xl:gap-[10px]">
                <p className="bg-gradient-to-r from-[#097283] from-[6.931%] to-[#45c9e3] bg-clip-text text-lg font-normal leading-[1.4] tracking-[-0.532px] text-transparent sm:text-xl md:text-2xl xl:text-[28px]">
                  See the Fit Before Installation
                </p>
                <h1 className="text-[28px] font-medium uppercase leading-[1.2] tracking-[-1.615px] text-[#0f1422] xs:text-[32px] sm:text-4xl md:text-5xl lg:text-[64px] xl:text-[clamp(46px,calc(6.09375vw-32px),85px)]">
                  The Smarter
                  <br />
                  Way to Fit
                  <br />
                  <span className="whitespace-nowrap bg-gradient-to-r from-[#097283] from-[6.931%] to-[#45c9e3] bg-clip-text text-transparent">
                    Glass &amp; Aluminum
                  </span>
                </h1>
              </div>
              <div>
                <p className="w-full text-sm font-normal leading-[1.4] tracking-[-0.456px] text-[#0f1422] sm:text-base md:text-lg lg:text-xl 4xl:text-[24px]">
                  Preview custom fittings on your photo and get accurate estimates in minutes. Built for precise planning, instant quotes, and faster sign-offs.
                </p>
              </div>
              <div className="flex flex-col items-stretch gap-3.5 sm:flex-row sm:items-center sm:gap-5 4xl:gap-[30px]">
                <Link href="/visualization" className="w-full sm:w-auto">
                  <Button
                    variant="lightGradWhiteText"
                    value="Start Visualizing"
                    leftIcon={null}
                    rightIcon={
                      <Image
                        src="/right_arrow.svg"
                        width={17}
                        height={16}
                        alt=""
                        className="h-[16px] w-[17px] 4xl:h-5 4xl:w-5"
                      />
                    }
                    className="w-full justify-center rounded-[25px]! px-[20px]! py-[15px]! text-[18px]! tracking-[-0.38px] sm:w-auto xl:text-[20px]!"
                  />
                </Link>
                <Link href="/product" className="w-full sm:w-auto">
                  <Button
                    variant="blackBtnWhiteText"
                    value="View Product Catalog"
                    leftIcon={null}
                    rightIcon={null}
                    className="w-full justify-center rounded-[25px]! px-[20px]! py-[15px]! text-[18px]! tracking-[-0.38px] sm:w-auto xl:text-[20px]!"
                  />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

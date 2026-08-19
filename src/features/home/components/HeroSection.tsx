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
            <div className="flex flex-col gap-8.5 4xl:gap-10 5xl:gap-12">
              <div className="flex flex-col gap-2.5 4xl:gap-4 5xl:gap-6">
                <h3 className="text-green text-xl md:text-2xl lg:text-3xl 4xl:text-4xl 5xl:text-5xl! font-normal leading-7 lg:leading-10 4xl:leading-13">
                  See. Fit. Transform.
                </h3>
                <h1 className="text-4xl md:text-7xl lg:text-8xl 4xl:text-[112px] 5xl:text-[150px]! text-black font-medium uppercase leading-tight lg:leading-[115.20px] 4xl:leading-32 5xl:leading-38!">
                  The Future Is
                  <br />
                  <span className="bg-grad-light bg-clip-text text-transparent">
                    Visualize
                  </span>
                </h1>
              </div>
              <div>
                <p className="text-black text-lg lg:text-xl 4xl:text-2xl 5xl:text-3xl! font-normal leading-7 4xl:leading-9 5xl:leading-10!">
                  A smarter way to preview customized fittings using your actual
                  <br className="hidden lg:inline" /> space photo
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3.75 4xl:gap-5">
                <Link href="/visualization" className="w-full sm:w-auto">
                  <Button
                    variant="lightGradWhiteText"
                    value="Start Visualizing"
                    leftIcon={null}
                    rightIcon={
                      <Image
                        src="/right_arrow.svg"
                        width={25}
                        height={25}
                        alt=""
                        className="4xl:w-7 4xl:h-7 5xl:w-8 5xl:h-8"
                      ></Image>
                    }
                    className="w-full sm:w-auto justify-center 4xl:px-7 4xl:py-4 4xl:text-xl 5xl:px-9! 5xl:py-5! 5xl:text-3xl!"
                  ></Button>
                </Link>
                <Link href="/product" className="w-full sm:w-auto">
                  <Button
                    variant="blackBtnWhiteText"
                    value="View Product Catalog"
                    leftIcon={null}
                    rightIcon={null}
                    className="w-full sm:w-auto justify-center 4xl:px-7 4xl:py-4 4xl:text-xl 5xl:px-9! 5xl:py-5! 5xl:text-2xl"
                  ></Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

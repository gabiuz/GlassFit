import Image from "next/image";
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
      <div className="relative min-h-screen lg:min-h-[120vh]">
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
        <div className="hidden xl:block pointer-events-none absolute -bottom-2 right-0 z-20 h-30 w-[38%] 2xl:w-[45%] filter-[drop-shadow(0_-2px_24px_rgba(0,0,0,0.25))]">
          <div className="h-full w-full bg-white [clip-path:polygon(40%_0,100%_0,100%_100%,0_100%)]"></div>
        </div>
        <Image
          src="/glass_door.svg"
          alt=""
          width={2000}
          height={1125}
          aria-hidden="true"
          className="hidden xl:block pointer-events-none absolute xl:w-[670px] xl:h-[946px] xl:-bottom-22 2xl:w-[770px] 2xl:h-[1088px] 2xl:-bottom-30 right-0 z-30"
        />
        <div className="relative z-10">
          <div className="px-6 pt-32 pb-12 flex justify-start items-start md:pl-16 md:pt-48 lg:pl-27 lg:pt-57 lg:pb-0">
            <div className="flex flex-col gap-8.5">
              <div className="flex flex-col gap-2.5">
                <h3 className="text-green text-xl md:text-2xl lg:text-3xl font-normal leading-7 lg:leading-10 ">
                  See. Fit. Transform.
                </h3>
                <h1 className="text-4xl sm:text-6xl lg:text-8xl text-black font-medium uppercase leading-tight lg:leading-[115.20px]">
                  The Future Is
                  <br />
                  <span className="bg-grad-light bg-clip-text text-transparent">
                    Visualize
                  </span>
                </h1>
              </div>
              <div>
                <p className="text-black text-lg lg:text-xl font-normal leading-7">
                  A smarter way to preview customized fittings using your actual
                  <br className="hidden lg:inline" /> space photo
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3.75">
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
                    ></Image>
                  }
                  className="w-full sm:w-auto justify-center"
                ></Button>
                <Button
                  variant="blackBtnWhiteText"
                  value="View Sample Review"
                  leftIcon={null}
                  rightIcon={null}
                  className="w-full sm:w-auto justify-center"
                ></Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

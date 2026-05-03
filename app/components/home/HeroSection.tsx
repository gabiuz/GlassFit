import Image from "next/image";
import Button from "../shared/Button";

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

export default function HeroSection() {
  return (
    <section className="bg-white-20">
      <div className="bg-grad-dark py-2.5 font-normal text-white">
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
      <div className="relative h-screen overflow-hidden">
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
        <div className="relative z-10">
          <div className="pl-27 pt-57 flex flex-col gap-8.5">
            <div className="flex flex-col gap-2.5">
              <h3 className="text-green text-3xl font-normal leading-10 ">
                See. Fit. Transform.
              </h3>
              <h1 className="text-8xl text-black font-medium uppercase leading-[115.20px]">
                The Future Is
                <br />
                <span className="bg-grad-light bg-clip-text text-transparent">
                  Visualize
                </span>
              </h1>
            </div>
            <div>
              <p className="text-black text-xl font-normal leading-7">
                A smarter way to preview customized fittings using your actual
                <br />
                space photo
              </p>
            </div>
            <div className="flex gap-3.75">
              <Button
                variant="lightGradWhiteText"
                value="Start Visualizing"
                leftArrow={null}
                rightArrow={
                  <Image
                    src="/right_arrow.svg"
                    width={25}
                    height={25}
                    alt=""
                  ></Image>
                }
              ></Button>
              <Button
                variant="blackBtnWhiteText"
                value="View Sample Review"
                leftArrow={null}
                rightArrow={null}
              ></Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import Image from "next/image";
import Button from "../shared/Button";

export default function ExploreSection() {
  return (
    <section className="relative bg-grad-dark px-27.5 py-25">
      <div className="flex flex-col items-center gap-20.25">
        <div className="flex flex-col items-center gap-5 text-center text-white">
          <h2 className="text-[48px] font-medium leading-[1.2] tracking-[-0.912px]">
            Explore Glass and Aluminum Products
          </h2>
          <p className="text-[20px] font-normal leading-[1.4] tracking-[-0.38px]">
            Choose from different glass and aluminum products designed for
            homes, offices, stores, and commercial spaces.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-10">
          <div className="flex w-98.75  flex-col gap-10">
            <div className="flex flex-col items-start w-hug gap-3.75 rounded-3xl bg-white/5 pl-7.5 pt-7.5 text-white">
              <div className="flex w-fit gap-47.5 items-center justify-between">
                <p className="text-3xl font-medium leading-10 ">Doors</p>
                <div className="rounded-full bg-grad-light px-6.25 py-2.5">
                  <span className="text-2xl font-normal leading-8">1</span>
                </div>
              </div>
              <p className="w-73.25 text-xl font-normal leading-[1.4] tracking-[-0.38px]">
                Explore glass and aluminum door styles for entrances, rooms, and
                office areas.
              </p>
              <div className="relative aspect-364/386 w-full ">
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-br-[25px]">
                  <Image
                    src="/images/doors.png"
                    alt="Glass doors"
                    width={364}
                    height={386}
                    className="absolute left-[-31.22%] top-[-17.7%] h-[139.43%] w-[147.57%] max-w-none object-cover"
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-6.25 rounded-3xl bg-white pl-7.5 pt-7.5 text-black">
              <div className="flex w-fit gap-35.5 items-center justify-between">
                <p className="text-3xl font-medium leading-10 ">Windows</p>
                <div className="rounded-full bg-black px-6.25 py-2.5">
                  <span className="text-2xl text-white font-normal leading-8">
                    2
                  </span>
                </div>
              </div>
              <p className="w-85.25 text-xl font-normal leading-7">
                Preview window designs for residential and commercial spaces.
              </p>
              <div className="relative h-58.5 w-91.25">
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <Image
                    src="/images/windows.png"
                    alt="Windows"
                    width={365}
                    height={234}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-10">
            <div className="flex w-99 flex-col items-start">
              <div className="flex w-full flex-col justify-between items-center gap-1.5 rounded-3xl bg-black pt-7.5 text-white">
                <div className="flex flex-col items-end gap-3.75">
                  <div className="flex items-center justify-end gap-35">
                    <p className="text-3xl font-medium leading-10">
                      Partitions
                    </p>
                    <div className="w-16 rounded-full bg-grad-light px-6.25 py-2.5">
                      <span className="text-2xl font-normal leading-8">3</span>
                    </div>
                  </div>
                  <p className="w-85 text-xl font-normal leading-7">
                    Visualize glass partitions and dividers for interiors,
                    offices, and shared spaces.
                  </p>
                </div>
                <div className="relative h-70.5 w-full">
                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[25px]">
                    <Image
                      src="/images/partitions.png"
                      alt="Partitions"
                      width={396}
                      height={282}
                      className="absolute left-[-2.88%] top-[-19.08%] h-[161.34%] w-[105.27%] max-w-none "
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex w-99.25 flex-col gap-3.75 rounded-3xl bg-white/10 pl-7.5 pt-7.5 text-white">
              <div className="flex items-center gap-6">
                <p className="text-3xl font-medium leading-[1.2] tracking-[-0.608px]">
                  Modular Cabinets
                </p>
                <div className="w-16.25 rounded-full bg-green px-6.25 py-2.5">
                  <span className="text-2xl font-normal leading-8 ">4</span>
                </div>
              </div>
              <p className="w-70 text-xl font-normal leading-7 ">
                Preview aluminum cabinet designs for kitchens, storage areas,
                and display spaces.
              </p>
              <div className="relative aspect-367/339 w-full rounded-br-[25px]">
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-br-[25px]">
                  <Image
                    src="/images/modular_cabinets.png"
                    alt="Modular cabinets"
                    width={2000}
                    height={1333}
                    className="absolute left-[-16.38%] top-[-79.3%] h-[301.2%] w-[277.69%] max-w-none "
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-10">
            <div className="flex w-99.25 flex-col gap-3.75 rounded-3xl bg-white/10 pl-7.5 pt-7.5 text-white">
              <div className="flex items-center gap-6">
                <p className="w-62.5 text-3xl font-medium leading-10 ">
                  Shower Enclosures
                </p>
                <div className="w-16 rounded-full bg-black px-6.25 py-2.5">
                  <span className="text-2xl font-normal leading-8">5</span>
                </div>
              </div>
              <p className="w-84.5 text-xl font-normal leading-7 ">
                View glass enclosure options for bathroom and comfort room
                spaces.
              </p>
              <div className="relative h-79.75 w-91.75 rounded-br-[25px]">
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-br-[25px]">
                  <Image
                    src="/images/shower_enclosure.png"
                    alt="Shower enclosures"
                    width={367}
                    height={319}
                    className="absolute -bottom-6 -left-10 h-[115%] w-[115%] max-w-none rounded-br-[25px] object-cover object-bottom"
                  />
                </div>
              </div>
            </div>

            <div className="flex w-99 flex-col items-start">
              <div className="flex w-full flex-col items-center gap-1.5 rounded-3xl bg-[#279DB2] pt-7.5 text-white">
                <div className="flex flex-col items-end gap-3.75">
                  <div className="flex w-85 items-center justify-between">
                    <p className="w-45 text-3xl font-medium leading-10 ">
                      Exterior Installation
                    </p>
                    <div className="w-16 rounded-full bg-black px-6.25 py-2.5">
                      <span className="text-2xl font-normal leading-8">6</span>
                    </div>
                  </div>
                  <p className="w-85 text-xl font-normal leading-7 ">
                    Explore exterior glass and aluminum installations such as
                    gates, fences, and other outdoor fittings
                  </p>
                </div>
                <div className="relative h-73.5 w-full rounded-bl-[25px] rounded-br-[25px] rounded-tl-[25px]">
                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-bl-[25px] rounded-br-[25px] rounded-tl-[25px]">
                    <Image
                      src="/images/exterior_installation.png"
                      alt="Exterior installation"
                      width={396}
                      height={294}
                      className="absolute left-[-10.89%] top-[-1.27%] h-[102.54%] w-[118.73%] max-w-none object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Button
          variant="whiteOutline"
          value="Explore Product Catalog"
          leftIcon={null}
          rightIcon={<Image src="/cart.svg" width={25} height={25} alt="" />}
        />
      </div>
    </section>
  );
}

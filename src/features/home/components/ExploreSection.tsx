import Image from "next/image";
import Button from "@/components/shared/Button";

function CardDoors() {
  return (
    <div className="flex flex-col items-start w-full xl:h-full gap-2 sm:gap-3.75 rounded-2xl sm:rounded-3xl bg-white/5 pl-4 pt-4 sm:pl-7.5 sm:pt-7.5 text-white">
      <div className="flex w-full items-center justify-between gap-2 pr-4 sm:pr-7.5">
        <p className="text-base sm:text-2xl xl:text-3xl font-medium leading-tight xl:leading-10">Doors</p>
        <div className="rounded-full bg-grad-light px-2.5 py-0.5 sm:px-4 sm:py-1.5 xl:px-6.25 xl:py-2.5 shrink-0 flex items-center justify-center">
          <span className="text-xs sm:text-xl xl:text-2xl font-normal leading-normal xl:leading-8">1</span>
        </div>
      </div>
      <p className="w-full text-xs sm:text-base xl:text-xl font-normal leading-[1.4] tracking-[-0.38px] pr-4 sm:pr-7.5">
        Explore glass and aluminum door styles for entrances, rooms, and
        office areas.
      </p>
      <div className="relative aspect-364/386 w-full mt-auto">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-br-[18px] sm:rounded-br-[25px]">
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
  );
}

function CardWindows() {
  return (
    <div className="flex flex-col xl:h-full gap-3 sm:gap-6.25 rounded-2xl sm:rounded-3xl bg-white pl-4 pr-4 pt-4 sm:pl-7.5 sm:pr-7.5 sm:pt-7.5 xl:pr-0 text-black">
      <div className="flex w-full items-center justify-between gap-2 xl:pr-7.5">
        <p className="text-base sm:text-2xl xl:text-3xl font-medium leading-tight xl:leading-10">Windows</p>
        <div className="rounded-full bg-black px-2.5 py-0.5 sm:px-4 sm:py-1.5 xl:px-6.25 xl:py-2.5 shrink-0 flex items-center justify-center">
          <span className="text-xs sm:text-xl xl:text-2xl text-white font-normal leading-normal xl:leading-8">
            2
          </span>
        </div>
      </div>
      <p className="w-full text-xs sm:text-base xl:text-xl font-normal leading-tight xl:leading-7 xl:pr-7.5">
        Preview window designs for residential and commercial spaces.
      </p>
      <div className="relative h-auto aspect-[365/234] xl:aspect-none xl:h-58.5 w-full max-w-full xl:max-w-[365px] mt-auto mx-auto">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-br-[18px] sm:rounded-br-[25px] xl:rounded-none">
          <Image
            src="/images/windows.png"
            alt="Windows"
            width={365}
            height={234}
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </div>
  );
}

function CardPartitions() {
  return (
    <div className="flex w-full flex-col justify-between items-center gap-1.5 rounded-2xl sm:rounded-3xl bg-black pt-4 sm:pt-7.5 text-white xl:h-full">
      <div className="flex flex-col items-start gap-2 sm:gap-3.75 px-4 sm:px-7.5 w-full">
        <div className="flex w-full items-center justify-between gap-2">
          <p className="text-base sm:text-2xl xl:text-3xl font-medium leading-tight xl:leading-10">
            Partitions
          </p>
          <div className="px-2.5 py-0.5 sm:px-4 sm:py-1.5 xl:px-0 xl:py-2.5 rounded-full bg-grad-light shrink-0 flex justify-center items-center xl:w-16">
            <span className="text-xs sm:text-xl xl:text-2xl font-normal leading-normal xl:leading-8">3</span>
          </div>
        </div>
        <p className="w-full text-xs sm:text-base xl:text-xl font-normal leading-tight xl:leading-7">
          Visualize glass partitions and dividers for interiors,
          offices, and shared spaces.
        </p>
      </div>
      <div className="relative h-auto aspect-[396/282] xl:aspect-none xl:h-70.5 w-full mt-auto">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-b-[18px] sm:rounded-b-[25px] xl:rounded-[25px]">
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
  );
}

function CardModularCabinets() {
  return (
    <div className="flex w-full flex-col xl:h-full gap-2 sm:gap-3.75 rounded-2xl sm:rounded-3xl bg-white/10 pl-4 pt-4 sm:pl-7.5 sm:pt-7.5 text-white">
      <div className="flex w-full items-center justify-between gap-2 pr-4 sm:pr-7.5">
        <p className="text-base sm:text-2xl xl:text-3xl font-medium leading-tight xl:leading-[1.2] tracking-[-0.608px]">
          Modular Cabinets
        </p>
        <div className="px-2.5 py-0.5 sm:px-4 sm:py-1.5 xl:px-0 xl:py-2.5 rounded-full bg-green shrink-0 flex justify-center items-center xl:w-16.25">
          <span className="text-xs sm:text-xl xl:text-2xl font-normal leading-normal xl:leading-8 ">4</span>
        </div>
      </div>
      <p className="w-full text-xs sm:text-base xl:text-xl font-normal leading-tight xl:leading-7 pr-4 sm:pr-7.5">
        Preview aluminum cabinet designs for kitchens, storage areas,
        and display spaces.
      </p>
      <div className="relative aspect-367/339 w-full rounded-br-[18px] sm:rounded-br-[25px] mt-auto">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-br-[18px] sm:rounded-br-[25px]">
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
  );
}

function CardShowerEnclosures() {
  return (
    <div className="flex w-full flex-col xl:h-full gap-2 sm:gap-3.75 rounded-2xl sm:rounded-3xl bg-white/10 pl-4 pt-4 sm:pl-7.5 sm:pt-7.5 text-white">
      <div className="flex w-full items-center justify-between gap-2 pr-4 sm:pr-7.5">
        <p className="text-base sm:text-2xl xl:text-3xl font-medium leading-tight xl:leading-10 ">
          Shower Enclosures
        </p>
        <div className="px-2.5 py-0.5 sm:px-4 sm:py-1.5 xl:px-0 xl:py-2.5 rounded-full bg-black shrink-0 flex justify-center items-center xl:w-16">
          <span className="text-xs sm:text-xl xl:text-2xl font-normal leading-normal xl:leading-8">5</span>
        </div>
      </div>
      <p className="w-full text-xs sm:text-base xl:text-xl font-normal leading-tight xl:leading-7 pr-4 sm:pr-7.5">
        View glass enclosure options for bathroom and comfort room
        spaces.
      </p>
      <div className="relative h-auto aspect-[367/319] xl:aspect-none xl:h-79.75 w-full max-w-[367px] rounded-br-[18px] sm:rounded-br-[25px] mt-auto">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-br-[18px] sm:rounded-br-[25px]">
          <Image
            src="/images/shower_enclosure.png"
            alt="Shower enclosures"
            width={367}
            height={319}
            className="absolute -bottom-6 -left-10 h-[115%] w-[115%] max-w-none rounded-br-[18px] sm:rounded-br-[25px] xl:rounded-br-[25px] object-cover object-bottom"
          />
        </div>
      </div>
    </div>
  );
}

function CardExteriorInstallation() {
  return (
    <div className="flex w-full flex-col justify-between items-center gap-1.5 rounded-2xl sm:rounded-3xl bg-[#279DB2] pt-4 sm:pt-7.5 text-white h-full">
      <div className="flex flex-col items-start gap-2 sm:gap-3.75 px-4 sm:px-7.5 w-full">
        <div className="flex w-full items-center justify-between gap-2">
          <p className="text-base sm:text-2xl xl:text-3xl font-medium leading-tight xl:leading-10 ">
            Exterior Installation
          </p>
          <div className="px-2.5 py-0.5 sm:px-4 sm:py-1.5 xl:px-0 xl:py-2.5 rounded-full bg-black shrink-0 flex justify-center items-center xl:w-16">
            <span className="text-xs sm:text-xl xl:text-2xl font-normal leading-normal xl:leading-8">6</span>
          </div>
        </div>
        <p className="w-full text-xs sm:text-base xl:text-xl font-normal leading-tight xl:leading-7 ">
          Explore exterior glass and aluminum installations such as
          gates, fences, and other outdoor fittings
        </p>
      </div>
      <div className="relative h-auto aspect-[396/294] xl:aspect-none xl:h-73.5 w-full rounded-b-[18px] sm:rounded-b-[25px] xl:rounded-bl-[25px] xl:rounded-br-[25px] xl:rounded-tl-[25px] mt-auto">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-b-[18px] sm:rounded-b-[25px] xl:rounded-bl-[25px] xl:rounded-br-[25px] xl:rounded-tl-[25px]">
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
  );
}

export function ExploreSection() {
  return (
    <section className="relative bg-grad-dark px-4 py-12 lg:px-27.5 lg:py-25">
      <div className="flex flex-col items-center gap-10 md:gap-14 lg:gap-20.25">
        <div className="flex flex-col items-center gap-5 text-center text-white">
          <h2 className="text-2xl sm:text-4xl lg:text-[48px] font-medium leading-[1.2] tracking-[-0.912px]">
            Explore Glass and Aluminum Products
          </h2>
          <p className="text-sm sm:text-base lg:text-[20px] font-normal leading-[1.4] tracking-[-0.38px]">
            Choose from different glass and aluminum products designed for
            homes, offices, stores, and commercial spaces.
          </p>
        </div>

        {/* Desktop Layout (visible at xl and above) */}
        <div className="hidden xl:flex xl:flex-row xl:justify-center xl:gap-10 w-full">
          <div className="flex w-full max-w-[395px] flex-col gap-10">
            <CardDoors />
            <CardWindows />
          </div>
          <div className="flex w-full max-w-[396px] flex-col gap-10">
            <CardPartitions />
            <CardModularCabinets />
          </div>
          <div className="flex w-full max-w-[396px] flex-col gap-10">
            <CardShowerEnclosures />
            <CardExteriorInstallation />
          </div>
        </div>

        {/* Mobile/Tablet Layout (visible below xl) */}
        <div className="flex xl:hidden flex-row gap-4 md:gap-6 w-full">
          <div className="flex flex-col gap-4 md:gap-6 w-1/2">
            <CardDoors />
            <CardPartitions />
            <CardShowerEnclosures />
          </div>
          <div className="flex flex-col gap-4 md:gap-6 w-1/2">
            <CardWindows />
            <CardModularCabinets />
            <CardExteriorInstallation />
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

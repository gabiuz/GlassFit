export default function DetailSection() {
  return (
    <section className="relative flex flex-col gap-17.5 bg-white py-25 px-27.5">
      <div className="w-fit flex justify-between items-center gap-12.5">
        <h2 className=" whitespace-nowrap text-5xl font-medium capitalize leading-[57.60px] text-start">
          <span className="bg-grad-light bg-clip-text text-transparent">
            Plan Your Glass and Aluminum
            <br />
          </span>
          <span className="bg-grad-light bg-clip-text text-transparent">
            Project with Confidence
          </span>
        </h2>
        <p className="text-black text-xl font-normal leading-7 whitespace-nowrap ">
          GlassFit combines product browsing, image-based <br /> visualization,
          customization, and estimated pricing to help <br /> customers prepare
          better before talking to the business.
        </p>
      </div>
      <div></div>
    </section>
  );
}

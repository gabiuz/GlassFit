"use client";
import Button from "../shared/Button";

export default function IntroSection() {
  return (
    <section className="relative z-40 bg-white py-25 px-27.5">
      <div className="flex flex-col justify-center items-center gap-13">
        <h2 className="text-5xl font-medium capitalize leading-[57.60px] text-black text-center">
          Smarter Glass And Aluminum Visualization
          <br />
          <span className="bg-grad-light bg-clip-text text-transparent">
            Starts Here
          </span>
        </h2>
        <div className="w-[90%] text-center text-black">
          <p className="">
            GlassFit helps customers preview glass and aluminum products before
            installation.
          </p>
          <br />
          <p>
            With photo-based simulation, users can choose a product, upload a
            space image, adjust the product overlay, view a visual output, and{" "}
            <br />
            generate an estimated price before sending a reference link to the
            business through Messenger or Viber.
          </p>
        </div>
        <Button
          value="Learn More"
          variant="blackBtnWhiteText"
          leftIcon={null}
          rightIcon={null}
        ></Button>
      </div>
    </section>
  );
}

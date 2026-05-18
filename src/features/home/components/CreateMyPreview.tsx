import Image from "next/image";
import Button from "@/components/shared/Button";

export function CreateMyPreview() {
  return (
    <section className="px-27.5 py-25">
      <div className="relative overflow-hidden rounded-[25px] bg-green px-69.25 py-25">
        <div className="pointer-events-none absolute inset-0">
          <Image
            src="/cta_background.jpg"
            alt="CTA Background"
            fill
            className="object-cover opacity-20"
            aria-hidden="true"
          />
        </div>
        <div className="relative flex flex-col items-center gap-10.5 text-center text-white">
          <h2 className="text-5xl font-medium leading-[57.60px]">
            Ready to See Your Space with a New Look?
          </h2>
          <p className="w-173.25 text-xl font-normal leading-7">
            Start with a product, upload your space image, and create a visual
            reference for your glass and aluminum project.
          </p>
          <Button
            variant="blackBtnWhiteText"
            value="Create My Preview"
            leftIcon={null}
            rightIcon={null}
          />
        </div>
      </div>
    </section>
  );
}

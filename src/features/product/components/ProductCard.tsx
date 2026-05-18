"use client";
import Button from "@/components/shared/Button";
import Image from "next/image";

const tags = ["Aluminum", "Frosted"];

export function ProductCard() {
  return (
    <div className="max-w-68.25 rounded-[10px] bg-white/50 shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)]">
      <div>
        <Image
          src="/product_card_placeholder.png"
          alt="product card placeholder"
          width={273}
          height={224}
        ></Image>
      </div>
      <div className="flex flex-col p-5 gap-7.5">
        <div className="flex flex-col gap-2.5 justify-start items-start">
          <h1 className="uppercase text-black  text-xl font-normal leading-7">
            Product Title
          </h1>
          <div className="flex gap-1.25">
            {tags.map((tag) => {
              return (
                <div
                  key={tag}
                  className="px-2.5 py-1.25 rounded-[20px] border border-[#C3C3C3]"
                >
                  <span className="text-black">{tag}</span>
                </div>
              );
            })}
          </div>
          <div className="w-fit">
            <p className="text-black text-sm font-normal leading-5">
              A customizable aluminum-framed window suitable for residential and
              commercial spaces.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 justify-start items-start">
          <div>
            <span className="text-green text-xl font-medium leading-7 ">
              P 00,000
            </span>
          </div>
          <div className="flex gap-2.5">
            <Button
              leftIcon={null}
              rightIcon={null}
              variant="greenBtnWhiteText"
              value="View Product"
              className="whitespace-nowrap rounded-[10px]! text-sm! px-3.75! py-1.25!"
            ></Button>
            <Button
              leftIcon={null}
              rightIcon={
                <Image
                  src="/right_arrow.svg"
                  width={10}
                  height={7.5}
                  alt="right arrow"
                ></Image>
              }
              variant="blackBtnWhiteText"
              value="Visualize"
              className="whitespace-nowrap rounded-[10px]! text-sm! px-3.75! py-1.25!"
            ></Button>
          </div>
        </div>
      </div>
    </div>
  );
}

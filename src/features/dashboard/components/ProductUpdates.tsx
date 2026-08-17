import type { ProductUpdate } from "../data";

type ProductUpdatesProps = {
  updates: ProductUpdate[];
};

export function ProductUpdates({ updates }: ProductUpdatesProps) {
  return (
    <div className="p-[30px] bg-white rounded-[20px] flex flex-col gap-5 items-start shrink-0 select-none">
      <div className="w-full flex items-center justify-between gap-[50px] whitespace-nowrap">
        <h2 className="text-[#07b6d3] text-2xl font-medium leading-[1.2] tracking-[-0.456px]">
          Product Update
        </h2>
        <button
          type="button"
          className="text-[#c3c3c3] text-base font-normal leading-[1.4] tracking-[-0.304px] hover:text-black transition-colors cursor-pointer"
        >
          View All
        </button>
      </div>
      <div className="w-full flex flex-col gap-2.5 items-start">
        {updates.map((update) => (
          <ProductUpdateItem key={`${update.productName}-${update.description}`} update={update} />
        ))}
      </div>
    </div>
  );
}

function ProductUpdateItem({ update }: { update: ProductUpdate }) {
  return (
    <div className="flex items-center gap-[15px] shrink-0">
      <div className="size-2 bg-[#07b6d3] rounded-full shrink-0" />
      <div className="w-[144px] flex flex-col gap-1 items-start shrink-0">
        <p className="w-full text-black text-xs font-normal leading-[1.4] tracking-[-0.228px]">
          {update.productName}
        </p>
        <p className="w-full text-[#c3c3c3] text-xs font-normal leading-[1.4] tracking-[-0.228px]">
          {update.description}
        </p>
      </div>
    </div>
  );
}

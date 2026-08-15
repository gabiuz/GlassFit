import type { ProductUpdate } from "../data";

type ProductUpdatesProps = {
  updates: ProductUpdate[];
};

export function ProductUpdates({ updates }: ProductUpdatesProps) {
  return (
    <div className="size-93 p-7 bg-white rounded-[20px] inline-flex flex-col justify-start items-start gap-5">
      <div className="size- inline-flex justify-start items-center gap-12">
        <div className="justify-start text-cyan-500 text-2xl font-medium leading-7">
          Product Update
        </div>
        <button
          type="button"
          className="justify-start text-stone-300 text-base font-normal leading-6"
        >
          View All
        </button>
      </div>
      <div className="self-stretch flex flex-col justify-start items-start gap-2.5">
        {updates.map((update) => (
          <ProductUpdateItem key={`${update.productName}-${update.description}`} update={update} />
        ))}
      </div>
    </div>
  );
}

function ProductUpdateItem({ update }: { update: ProductUpdate }) {
  return (
    <div className="size- inline-flex justify-center items-center gap-3.5">
      <div className="size-2 bg-cyan-500 rounded-full"></div>
      <div className="size- inline-flex flex-col justify-start items-start gap-1">
        <div className="self-stretch justify-start text-black text-xs font-light leading-4">
          {update.productName}
        </div>
        <div className="self-stretch justify-start text-stone-300 text-xs font-light leading-4">
          {update.description}
        </div>
      </div>
    </div>
  );
}

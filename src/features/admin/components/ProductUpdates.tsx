import type { ProductUpdate } from "../data";
import Link from "next/link";

type ProductUpdatesProps = {
  updates: ProductUpdate[];
};

export function ProductUpdates({ updates }: ProductUpdatesProps) {
  return (
    <div className="p-5 sm:p-6 lg:p-[30px] bg-white rounded-[20px] flex flex-col gap-4 sm:gap-5 w-full select-none shadow-xs">
      <div className="w-full flex items-center justify-between gap-4">
        <h2 className="text-[#07b6d3] text-xl sm:text-2xl font-medium leading-tight tracking-tight whitespace-nowrap">
          Product Update
        </h2>
        <Link
          href="/admin/products"
          className="text-[#c3c3c3] text-sm sm:text-base font-normal leading-[1.4] tracking-tight whitespace-nowrap hover:text-black transition-colors"
        >
          View All
        </Link>
      </div>
      <div className="w-full flex flex-col gap-3 sm:gap-3.5 items-start">
        {updates.map((update) => (
          <ProductUpdateItem key={`${update.productName}-${update.description}`} update={update} />
        ))}
      </div>
    </div>
  );
}

function ProductUpdateItem({ update }: { update: ProductUpdate }) {
  return (
    <div className="flex items-start gap-3 w-full">
      <div className="size-2 bg-[#07b6d3] rounded-full shrink-0 mt-1.5" />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5 items-start">
        <p className="w-full text-black text-xs sm:text-sm font-normal leading-snug tracking-tight truncate">
          {update.productName}
        </p>
        <p className="w-full text-[#c3c3c3] text-[11px] sm:text-xs font-normal leading-snug tracking-tight truncate">
          {update.description}
        </p>
      </div>
    </div>
  );
}


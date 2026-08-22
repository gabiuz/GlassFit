"use client";

import type { CSSProperties } from "react";
import Button from "@/components/shared/Button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import type { QuickAction } from "../data";

type QuickActionsProps = {
  actions: QuickAction[];
};

const quickActionButtonStyle: CSSProperties = {
  padding: "8px 16px",
  borderRadius: "10px",
  gap: "8px",
  fontSize: "0.875rem",
  lineHeight: "1.25rem",
  letterSpacing: "0",
};

export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full select-none">
      <h2 className="text-black text-xl sm:text-2xl font-medium leading-tight tracking-tight">
        Quick Actions
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-5 w-full">
        {actions.map((action) => (
          <QuickActionCard key={action.title} action={action} />
        ))}
      </div>
    </div>
  );
}

function QuickActionCard({ action }: { action: QuickAction }) {
  const router = useRouter();
  const isFeatured = action.isFeatured === true;

  const handleClick = () => {
    if (action.buttonLabel.toLowerCase().includes("product")) {
      router.push("/admin/products");
    } else if (action.buttonLabel.toLowerCase().includes("booking")) {
      router.push("/admin/bookings");
    }
  };

  return (
    <div
      className={cn(
        "p-5 rounded-[20px] flex flex-col justify-between gap-4 sm:gap-5 w-full shadow-xs transition-shadow hover:shadow-md",
        isFeatured ? "bg-[#0f1422]" : "bg-white"
      )}
    >
      <div className="flex items-center justify-start w-full">
        <p
          className={cn(
            "text-base font-medium leading-snug tracking-tight",
            isFeatured ? "text-white" : "text-[#0f1422]"
          )}
        >
          {action.title}
        </p>
      </div>

      <Button
        type="button"
        variant={isFeatured ? "whiteBtnBlackText" : "greenBtnWhiteText"}
        value={action.buttonLabel}
        onClick={handleClick}
        leftIcon={null}
        rightIcon={null}
        className={cn(
          "cursor-pointer hover:opacity-90 transition-opacity self-start",
          isFeatured ? "outline outline-1 outline-offset-[-1px] outline-[#c3c3c3]" : ""
        )}
        style={quickActionButtonStyle}
      />
    </div>
  );
}


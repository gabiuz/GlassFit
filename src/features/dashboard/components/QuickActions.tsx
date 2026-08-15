import type { CSSProperties } from "react";
import Button from "@/components/shared/Button";
import { cn } from "@/lib/utils";
import type { QuickAction } from "../data";

type QuickActionsProps = {
  actions: QuickAction[];
};

const quickActionButtonStyle: CSSProperties = {
  padding: "5px 14px",
  borderRadius: "10px",
  gap: "10px",
  fontSize: "0.875rem",
  lineHeight: "1.25rem",
  letterSpacing: "0",
};

export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <div className="size- inline-flex flex-col justify-start items-start gap-5">
      <div className="self-stretch justify-start text-black text-2xl font-medium leading-7">
        Quick Actions
      </div>
      <div className="size- flex flex-col justify-start items-start gap-6">
        {actions.map((action) => (
          <QuickActionCard key={action.title} action={action} />
        ))}
      </div>
    </div>
  );
}

function QuickActionCard({ action }: { action: QuickAction }) {
  const isFeatured = action.isFeatured === true;

  return (
    <div
      className={cn(
        "size- p-5 rounded-3xl flex flex-col justify-start items-start gap-5",
        isFeatured
          ? "bg-gray-900 shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)]"
          : "bg-white"
      )}
    >
      <div className="size- inline-flex justify-center items-center gap-5">
        <div
          className={cn(
            "w-40 justify-start text-base font-normal leading-6",
            isFeatured ? "text-white" : "text-gray-900"
          )}
        >
          {action.title}
        </div>
      </div>
      <Button
        type="button"
        variant={isFeatured ? "whiteBtnBlackText" : "greenBtnWhiteText"}
        value={action.buttonLabel}
        leftIcon={null}
        rightIcon={null}
        className={cn(
          "shadow-[0px_4px_50px_0px_rgba(0,0,0,0.25)]",
          isFeatured ? "outline outline-1 outline-offset-[-1px] outline-stone-300" : ""
        )}
        style={quickActionButtonStyle}
      />
    </div>
  );
}

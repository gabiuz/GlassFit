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
    <div className="flex flex-col gap-[19px] items-start shrink-0 select-none">
      <h2 className="text-black text-2xl font-medium leading-[1.2] tracking-[-0.456px]">
        Quick Actions
      </h2>
      <div className="flex flex-col gap-[26px] items-start shrink-0">
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
        "p-5 rounded-[20px] flex flex-col gap-5 items-start shrink-0",
        isFeatured ? "bg-[#0f1422]" : "bg-white"
      )}
    >
      <div className="flex items-center justify-center shrink-0">
        <p
          className={cn(
            "w-40 text-base font-medium leading-[1.4] tracking-[-0.304px]",
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
        leftIcon={null}
        rightIcon={null}
        className={cn(
          isFeatured ? "outline outline-1 outline-offset-[-1px] outline-[#c3c3c3]" : ""
        )}
        style={quickActionButtonStyle}
      />
    </div>
  );
}

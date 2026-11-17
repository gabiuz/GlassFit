"use client";

import { HelpCircle } from "lucide-react";

export interface AdminHelpButtonProps {
  onClick: () => void;
  ariaLabel: string;
  /** Places the Help button inline on mobile (<768px) to avoid covering sticky footers. */
  inlineOnMobile?: boolean;
}

export function AdminHelpButton({
  onClick,
  ariaLabel,
  inlineOnMobile = false,
}: AdminHelpButtonProps) {
  const positionClass = inlineOnMobile
    ? "static md:fixed md:bottom-5 md:right-5 md:z-40 shrink-0"
    : "fixed bottom-5 right-5 z-40";

  return (
    <button
      type="button"
      data-onboarding-target="admin-header-help"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`${positionClass} inline-flex min-h-11 items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-[#0f1422] shadow-lg transition-colors hover:border-[#07b6d3] hover:bg-[#e9f9fb] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#07b6d3] focus-visible:ring-offset-2`}
    >
      <HelpCircle className="size-4 text-[#07b6d3]" aria-hidden="true" />
      <span>Help</span>
    </button>
  );
}

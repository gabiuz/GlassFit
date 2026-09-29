import { cn } from "@/lib/utils";

type StaffStatus = "Active" | "Suspended" | "Inactive";

type StaffStatusBadgeProps = {
    status: StaffStatus | string;
};

const statusConfig: Record<StaffStatus, { bg: string; text: string; label: string }> = {
    Active: { bg: "bg-[#05b64b]", text: "text-white", label: "Active" },
    Suspended: { bg: "bg-[#ffc876]", text: "text-[#0f1422]", label: "Suspended" },
    Inactive: { bg: "bg-[#c3c3c3]", text: "text-white", label: "Inactive" },
};

export function StaffStatusBadge({ status }: StaffStatusBadgeProps) {
    const config = statusConfig[status as StaffStatus] ?? statusConfig.Inactive;

    return (
        <div
            data-status={status}
            className={cn(
                "px-2.5 py-[5px] rounded-[20px] flex items-center justify-center w-fit",
                config.bg
            )}
        >
            <span
                className={cn(
                    "text-xs font-normal leading-tight tracking-tight whitespace-nowrap",
                    config.text
                )}
            >
                {config.label}
            </span>
        </div>
    );
}

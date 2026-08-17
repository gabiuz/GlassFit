import { cn } from "@/lib/utils";
import Image from "next/image";

type AdminNavItem = {
    label: string;
    icon: string;
    isSelected?: boolean;
};

type AdminNavGroup = {
    label: string;
    items: AdminNavItem[];
};

const adminNavGroups: AdminNavGroup[] = [
    {
        label: "GENERAL",
        items: [
            { label: "Dashboard", icon: "/admin/dashboard-icon.svg", isSelected: true },
            { label: "Product", icon: "/admin/product-icon.svg" },
            { label: "Booking", icon: "/admin/booking-icon.svg" },
        ],
    },
    {
        label: "SUPPORT",
        items: [{ label: "Settings", icon: "/admin/settings-icon.svg" }],
    },
];

export default function AdminSidePanel() {
    return (
        <aside
            data-variant="Dashboard"
            className="w-[268px] shrink-0 min-h-[calc(100vh-106px)] pl-[90px] pr-[30px] pt-5 pb-[100px] bg-white border-r border-white drop-shadow-[0px_0px_2.5px_rgba(0,0,0,0.25)] flex flex-col gap-8 items-start select-none"
        >
            {adminNavGroups.map((group) => (
                <AdminNavigationGroup key={group.label} group={group} />
            ))}
        </aside>
    );
}

function AdminNavigationGroup({ group }: { group: AdminNavGroup }) {
    return (
        <div className="flex flex-col gap-2.5 items-start w-full">
            <div className="py-2 flex items-center">
                <span className="text-[#c3c3c3] text-xs font-normal leading-[1.4] tracking-[-0.228px]">
                    {group.label}
                </span>
            </div>
            <div className="flex flex-col gap-4 items-start w-full">
                {group.items.map((item) => (
                    <AdminNavigationItem key={item.label} item={item} />
                ))}
            </div>
        </div>
    );
}

function AdminNavigationItem({ item }: { item: AdminNavItem }) {
    const isSelected = item.isSelected === true;

    return (
        <button
            type="button"
            data-state={isSelected ? "Selected" : "Default"}
            className={cn(
                "w-[148px] px-4 py-2 flex items-center gap-2 cursor-pointer transition-all",
                isSelected
                    ? "bg-gradient-to-r from-[#097283] from-[6.931%] to-[#45c9e3] rounded-[10px] text-white"
                    : "rounded text-[#0f1422] hover:bg-neutral-100"
            )}
        >
            <div className="size-[15px] relative shrink-0 overflow-hidden flex items-center justify-center">
                <Image
                    src={item.icon}
                    alt=""
                    width={15}
                    height={15}
                    aria-hidden="true"
                    className={cn(isSelected ? "brightness-0 invert" : "")}
                />
            </div>
            <span
                className={cn(
                    "text-lg font-normal leading-[1.5] tracking-[-0.342px] whitespace-nowrap",
                    isSelected ? "text-white" : "text-[#0f1422]"
                )}
            >
                {item.label}
            </span>
        </button>
    );
}

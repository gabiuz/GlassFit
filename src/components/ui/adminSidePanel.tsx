import { cn } from "@/lib/utils";
import Button from "@/components/shared/Button";
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
        <div
            data-variant="Dashboard"
            className="w-69 h-screen pl-24 pr-7 pt-5 bg-white shadow-[0px_0px_5px_0px_rgba(0,0,0,0.25)] outline outline-1 outline-offset-[-1px] outline-white inline-flex flex-col justify-start items-start gap-8"
        >
            {adminNavGroups.map((group) => (
                <AdminNavigationGroup key={group.label} group={group} />
            ))}
        </div>
    );
}

function AdminNavigationGroup({ group }: { group: AdminNavGroup }) {
    return (
        <div className="self-stretch flex flex-col justify-start items-start gap-2.5">
            <div className="size- py-2 inline-flex justify-start items-center gap-1 overflow-hidden">
                <div className="size- flex justify-start items-center gap-2">
                    <div className="size- inline-flex flex-col justify-center items-start overflow-hidden">
                        <div className="self-stretch justify-start text-stone-300 text-xs font-normal leading-4">
                            {group.label}
                        </div>
                    </div>
                </div>
            </div>
            <div className="size- flex flex-col justify-start items-start gap-4">
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
        <Button
            type="button"
            data-state={isSelected ? "Selected" : "Default"}
            variant={isSelected ? "lightGradWhiteText" : "whiteBtnBlackText"}
            value={item.label}
            leftIcon={
                <AdminNavigationIcon icon={item.icon} isSelected={isSelected} />
            }
            rightIcon={null}
            className={cn(
                "overflow-hidden",
                isSelected ? "rounded-[10px]" : "rounded-sm"
            )}
            style={{
                width: "9rem",
                padding: "0.5rem 1rem",
                borderRadius: isSelected ? "10px" : "0.125rem",
                gap: "0.3rem",
                justifyContent: "flex-start",
                fontSize: "1rem",
                lineHeight: "1.75rem",
                letterSpacing: "0",
            }}
        />
    );
}

function AdminNavigationIcon({
    icon,
    isSelected,
}: {
    icon: string;
    isSelected: boolean;
}) {
    return (
        <div className="size-5 relative overflow-hidden">
            <Image
                src={icon}
                alt=""
                width={16}
                height={16}
                aria-hidden="true"
                className={cn(isSelected ? "brightness-0 invert" : "")}
            />
        </div>
    );
}

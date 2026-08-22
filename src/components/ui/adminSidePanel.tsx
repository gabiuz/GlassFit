"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";

type AdminNavItem = {
  label: string;
  icon: string;
  href: string;
};

type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

const adminNavGroups: AdminNavGroup[] = [
  {
    label: "GENERAL",
    items: [
      { label: "Dashboard", icon: "/admin/dashboard-icon.svg", href: "/admin" },
      { label: "Product", icon: "/admin/product-icon.svg", href: "/admin/products" },
      { label: "Booking", icon: "/admin/booking-icon.svg", href: "/admin/bookings" },
    ],
  },
  {
    label: "SUPPORT",
    items: [{ label: "Settings", icon: "/admin/settings-icon.svg", href: "/admin/settings" }],
  },
];

type AdminSidePanelProps = {
  isOpen?: boolean;
  onClose?: () => void;
};

export default function AdminSidePanel({ isOpen = false, onClose }: AdminSidePanelProps) {
  const pathname = usePathname();

  const isItemActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      <aside
        data-variant="Dashboard"
        className={cn(
          "w-[268px] shrink-0 bg-white border-r border-neutral-200 lg:border-white drop-shadow-[0px_0px_2.5px_rgba(0,0,0,0.25)] flex flex-col gap-6 lg:gap-8 items-start select-none",
          "pl-6 sm:pl-8 lg:pl-[90px] pr-6 lg:pr-[30px] pt-5 pb-[100px]",
          "fixed top-0 left-0 z-50 h-full overflow-y-auto transition-transform duration-300 ease-in-out",
          "lg:static lg:z-auto lg:h-auto lg:self-stretch lg:min-h-[calc(100vh-106px)] lg:overflow-visible",
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="w-full flex items-center justify-between lg:hidden pb-2 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <Image
              src="/Logo.svg"
              alt="Glassfit Logo"
              width={110}
              height={40}
              className="h-8 w-auto object-contain"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-600 hover:text-black hover:bg-neutral-100 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {adminNavGroups.map((group) => (
          <AdminNavigationGroup
            key={group.label}
            group={group}
            isItemActive={isItemActive}
            onItemClick={onClose}
          />
        ))}
      </aside>
    </>
  );
}

function AdminNavigationGroup({
  group,
  isItemActive,
  onItemClick,
}: {
  group: AdminNavGroup;
  isItemActive: (href: string) => boolean;
  onItemClick?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 items-start w-full">
      <div className="py-2 flex items-center">
        <span className="text-[#c3c3c3] text-xs font-normal leading-[1.4] tracking-[-0.228px]">
          {group.label}
        </span>
      </div>
      <div className="flex flex-col gap-3 lg:gap-4 items-start w-full">
        {group.items.map((item) => (
          <AdminNavigationItem
            key={item.label}
            item={item}
            isSelected={isItemActive(item.href)}
            onClick={onItemClick}
          />
        ))}
      </div>
    </div>
  );
}

function AdminNavigationItem({
  item,
  isSelected,
  onClick,
}: {
  item: AdminNavItem;
  isSelected: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      data-state={isSelected ? "Selected" : "Default"}
      className={cn(
        "w-[160px] lg:w-[148px] px-4 py-2 flex items-center gap-2 cursor-pointer transition-all",
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
          "text-base lg:text-lg font-normal leading-[1.5] tracking-[-0.342px] whitespace-nowrap",
          isSelected ? "text-white" : "text-[#0f1422]"
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}


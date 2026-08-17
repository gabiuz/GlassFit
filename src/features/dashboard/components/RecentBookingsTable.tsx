"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { BookingRequest, BookingStatus } from "../data";

type RecentBookingsTableProps = {
  bookings: BookingRequest[];
};

const statusStyles: Record<BookingStatus, string> = {
  Confirmed: "bg-[#05b64b]",
  Pending: "bg-[#ffc876]",
  Cancelled: "bg-[#e74242]",
};

const BOOKINGS_PER_PAGE = 5;

export function RecentBookingsTable({ bookings }: RecentBookingsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(bookings.length / BOOKINGS_PER_PAGE));
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;
  const visibleBookings = useMemo(() => {
    const startIndex = (currentPage - 1) * BOOKINGS_PER_PAGE;
    return bookings.slice(startIndex, startIndex + BOOKINGS_PER_PAGE);
  }, [bookings, currentPage]);

  const goToPreviousPage = () => {
    setCurrentPage((page) => Math.max(1, page - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((page) => Math.min(totalPages, page + 1));
  };

  return (
    <div className="p-[30px] bg-white rounded-[20px] flex flex-col items-start gap-5 shrink-0 select-none">
      <div className="w-full flex items-center justify-between gap-[124px]">
        <h2 className="flex-1 text-[#07b6d3] text-2xl font-medium leading-[1.2] tracking-[-0.456px] whitespace-nowrap">
          Recent Booking Request
        </h2>
        <button
          type="button"
          className="text-[#c3c3c3] text-base font-normal leading-[1.4] tracking-[-0.304px] whitespace-nowrap hover:text-black transition-colors cursor-pointer"
        >
          View All
        </button>
      </div>

      <div className="w-[489px] flex flex-col items-start gap-2.5">
        <BookingTableHeader />
        <div className="w-[489px] h-0 border-b border-[#e5e5e5]" />
        {visibleBookings.map((booking) => (
          <BookingTableRow key={booking.id} booking={booking} />
        ))}
      </div>

      <div className="self-stretch flex justify-end items-center gap-2 text-xs leading-4">
        <button
          type="button"
          onClick={goToPreviousPage}
          disabled={!canGoPrevious}
          className="px-2.5 py-1 rounded-[10px] bg-[#F5F5F5] text-gray-900 disabled:text-stone-300 disabled:cursor-not-allowed cursor-pointer hover:bg-neutral-200 transition-colors"
        >
          Prev
        </button>
        <span className="text-stone-400">
          {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          onClick={goToNextPage}
          disabled={!canGoNext}
          className="px-2.5 py-1 rounded-[10px] bg-[#F5F5F5] text-gray-900 disabled:text-stone-300 disabled:cursor-not-allowed cursor-pointer hover:bg-neutral-200 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function BookingTableHeader() {
  return (
    <div className="w-full flex items-center gap-[50px]">
      <HeaderCell>Booking ID</HeaderCell>
      <HeaderCell>Customer</HeaderCell>
      <HeaderCell className="w-[90px] shrink-0">Product Name</HeaderCell>
      <HeaderCell>Status</HeaderCell>
    </div>
  );
}

function BookingTableRow({ booking }: { booking: BookingRequest }) {
  return (
    <div className="w-full flex items-center gap-[50px]">
      <TableCell>{booking.id}</TableCell>
      <TableCell>{booking.customer}</TableCell>
      <TableCell className="w-[90px] shrink-0 text-center">{booking.productName}</TableCell>
      <TableCell>
        <div
          data-status={booking.status}
          className={cn(
            "px-2.5 py-[5px] rounded-[20px] flex items-center justify-center shrink-0",
            statusStyles[booking.status]
          )}
        >
          <span className="text-white text-xs font-normal leading-[1.4] tracking-[-0.228px] whitespace-nowrap">
            {booking.status}
          </span>
        </div>
      </TableCell>
    </div>
  );
}

function HeaderCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex-1 min-w-0 p-[5px] flex items-center justify-center", className)}>
      <span className="text-black text-xs font-medium leading-[1.4] tracking-[-0.228px] whitespace-nowrap">
        {children}
      </span>
    </div>
  );
}

function TableCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex-1 min-w-0 p-[5px] flex items-center justify-center", className)}>
      {typeof children === "string" ? (
        <span className="text-black text-xs font-normal leading-[1.4] tracking-[-0.228px] whitespace-nowrap">
          {children}
        </span>
      ) : (
        children
      )}
    </div>
  );
}

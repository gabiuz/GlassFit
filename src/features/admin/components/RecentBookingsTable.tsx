"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
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
    <div className="p-5 sm:p-6 lg:p-[30px] bg-white rounded-[20px] flex flex-col items-start gap-4 sm:gap-5 w-full select-none shadow-xs">
      <div className="w-full flex items-center justify-between gap-4">
        <h2 className="text-[#07b6d3] text-xl sm:text-2xl font-medium leading-tight tracking-tight whitespace-nowrap">
          Recent Booking Request
        </h2>
        <Link
          href="/admin/bookings"
          className="text-[#c3c3c3] text-sm sm:text-base font-normal leading-[1.4] tracking-tight whitespace-nowrap hover:text-black transition-colors"
        >
          View All
        </Link>
      </div>

      <div className="w-full overflow-x-auto pb-1">
        <div className="w-full min-w-[380px] sm:min-w-0 flex flex-col items-start gap-2.5">
          <BookingTableHeader />
          <div className="w-full h-0 border-b border-[#e5e5e5]" />
          {visibleBookings.map((booking) => (
            <BookingTableRow key={booking.id} booking={booking} />
          ))}
        </div>
      </div>

      <div className="self-stretch flex justify-end items-center gap-2 text-xs leading-4 pt-1">
        <button
          type="button"
          onClick={goToPreviousPage}
          disabled={!canGoPrevious}
          className="px-2.5 py-1 rounded-[10px] bg-[#F5F5F5] text-gray-900 disabled:text-stone-300 disabled:cursor-not-allowed cursor-pointer hover:bg-neutral-200 transition-colors"
        >
          Prev
        </button>
        <span className="text-stone-400 font-medium">
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
    <div className="w-full grid grid-cols-[70px_1fr_1fr_80px] sm:grid-cols-[80px_1fr_1fr_90px] items-center gap-2 sm:gap-3">
      <HeaderCell align="start">Booking ID</HeaderCell>
      <HeaderCell align="start">Customer</HeaderCell>
      <HeaderCell align="start">Product Name</HeaderCell>
      <HeaderCell align="center">Status</HeaderCell>
    </div>
  );
}

function BookingTableRow({ booking }: { booking: BookingRequest }) {
  return (
    <div className="w-full grid grid-cols-[70px_1fr_1fr_80px] sm:grid-cols-[80px_1fr_1fr_90px] items-center gap-2 sm:gap-3 py-1">
      <TableCell align="start" className="font-medium text-neutral-600 truncate">{booking.id}</TableCell>
      <TableCell align="start" className="font-medium text-[#0f1422] truncate">{booking.customer}</TableCell>
      <TableCell align="start" className="text-neutral-700 truncate">{booking.productName}</TableCell>
      <TableCell align="center">
        <div
          data-status={booking.status}
          className={cn(
            "px-2 sm:px-2.5 py-[3px] sm:py-[5px] rounded-[20px] flex items-center justify-center shrink-0 w-fit mx-auto",
            statusStyles[booking.status]
          )}
        >
          <span className="text-white text-[11px] sm:text-xs font-normal leading-tight tracking-tight whitespace-nowrap">
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
  align = "start",
}: {
  children: ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  return (
    <div className={cn("min-w-0 p-[3px] sm:p-[5px] flex items-center", align === "center" ? "justify-center" : align === "end" ? "justify-end" : "justify-start", className)}>
      <span className="text-black text-xs font-medium leading-[1.4] tracking-tight whitespace-nowrap">
        {children}
      </span>
    </div>
  );
}

function TableCell({
  children,
  className,
  align = "start",
}: {
  children: ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  return (
    <div className={cn("min-w-0 p-[3px] sm:p-[5px] flex items-center", align === "center" ? "justify-center" : align === "end" ? "justify-end" : "justify-start", className)}>
      {typeof children === "string" ? (
        <span className="text-black text-xs sm:text-sm font-normal leading-[1.4] tracking-tight truncate">
          {children}
        </span>
      ) : (
        children
      )}
    </div>
  );
}


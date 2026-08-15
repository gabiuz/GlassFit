"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { BookingRequest, BookingStatus } from "../data";

type RecentBookingsTableProps = {
  bookings: BookingRequest[];
};

const statusStyles: Record<BookingStatus, string> = {
  Confirmed: "bg-green-600",
  Pending: "bg-orange-300",
  Cancelled: "bg-red-500",
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
    <div className="size-138 p-7 bg-white rounded-[20px] inline-flex flex-col justify-start items-start gap-5">
      <div className="self-stretch inline-flex justify-start items-center gap-32">
        <div className="flex-1 justify-start text-cyan-500 text-2xl font-medium leading-7">
          Recent Booking Request
        </div>
        <button
          type="button"
          className="justify-start text-stone-300 text-base font-normal leading-6"
        >
          View All
        </button>
      </div>
      <div className="w-124 flex flex-col justify-start items-start gap-2.5">
        <BookingTableHeader />
        <div className="w-124 h-0 outline-1 outline-stone-300"></div>
        {visibleBookings.map((booking) => (
          <BookingTableRow key={booking.id} booking={booking} />
        ))}
      </div>
      <div className="self-stretch flex justify-end items-center gap-2 text-xs leading-4">
        <button
          type="button"
          onClick={goToPreviousPage}
          disabled={!canGoPrevious}
          className="px-2.5 py-1 rounded-[10px] bg-[#F5F5F5] text-gray-900 disabled:text-stone-300 disabled:cursor-not-allowed"
        >
          Prev
        </button>
        <span className="text-stone-300">
          {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          onClick={goToNextPage}
          disabled={!canGoNext}
          className="px-2.5 py-1 rounded-[10px] bg-[#F5F5F5] text-gray-900 disabled:text-stone-300 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function BookingTableHeader() {
  return (
    <div className="self-stretch inline-flex justify-start items-center gap-12">
      <HeaderCell>Booking ID</HeaderCell>
      <HeaderCell>Customer</HeaderCell>
      <HeaderCell className="w-full">Product Name</HeaderCell>
      <HeaderCell>Status</HeaderCell>
    </div>
  );
}

function BookingTableRow({ booking }: { booking: BookingRequest }) {
  return (
    <div className="self-stretch inline-flex justify-start items-center gap-12">
      <TableCell>{booking.id}</TableCell>
      <TableCell>{booking.customer}</TableCell>
      <TableCell className="w-24">{booking.productName}</TableCell>
      <TableCell>
        <div
          data-status={booking.status}
          className={cn(
            "size- px-2.5 py-[5px] rounded-[20px] flex justify-center items-center gap-2.5",
            statusStyles[booking.status]
          )}
        >
          <div className="justify-start text-white text-xs font-normal leading-4">
            {booking.status}
          </div>
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
    <div className={cn("flex-1 p-[5px] flex justify-center items-center gap-2.5", className)}>
      <div className="justify-start text-black text-xs font-medium leading-4">
        {children}
      </div>
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
    <div className={cn("flex-1 p-[5px] flex justify-center items-center gap-2.5", className)}>
      {typeof children === "string" ? (
        <div className="justify-start text-black text-xs font-light leading-4">
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

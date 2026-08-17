"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { SearchBar } from "@/components/shared/SearchBar";
import {
  initialAdminBookings,
  type AdminBookingItem,
  type BookingStatus,
} from "./bookingData";

const statusBg: Record<BookingStatus, string> = {
  Confirmed: "bg-[#05b64b]",
  Pending: "bg-[#ffc876]",
  Reviewing: "bg-[#ffc876]",
  Cancelled: "bg-[#c50000]",
};

const filterTabs: Array<{ label: string; value: BookingStatus | "All" }> = [
  { label: "All", value: "All" },
  { label: "Pending", value: "Pending" },
  { label: "Reviewing", value: "Reviewing" },
  { label: "Confirmed", value: "Confirmed" },
  { label: "Cancelled", value: "Cancelled" },
];

export function BookingsContent() {
  const [bookings, setBookings] = useState<AdminBookingItem[]>(initialAdminBookings);
  const [selectedBookingId, setSelectedBookingId] = useState<string>(
    initialAdminBookings[0]?.id || ""
  );
  const [activeTab, setActiveTab] = useState<BookingStatus | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");

  const counts = useMemo(() => {
    return {
      All: bookings.length,
      Pending: bookings.filter((b) => b.status === "Pending").length,
      Reviewing: bookings.filter((b) => b.status === "Reviewing").length,
      Confirmed: bookings.filter((b) => b.status === "Confirmed").length,
      Cancelled: bookings.filter((b) => b.status === "Cancelled").length,
    };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchesTab = activeTab === "All" || b.status === activeTab;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        b.referenceNo.toLowerCase().includes(q) ||
        b.customer.name.toLowerCase().includes(q) ||
        b.customer.email.toLowerCase().includes(q) ||
        b.productSummary.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }, [bookings, activeTab, searchQuery]);

  const selectedBooking = useMemo(() => {
    return (
      bookings.find((b) => b.id === selectedBookingId) ||
      filteredBookings[0] ||
      bookings[0]
    );
  }, [bookings, selectedBookingId, filteredBookings]);

  const [currentStatus, setCurrentStatus] = useState<BookingStatus>(
    selectedBooking?.status || "Pending"
  );

  const handleSelectBooking = (booking: AdminBookingItem) => {
    setSelectedBookingId(booking.id);
    setCurrentStatus(booking.status);
  };

  const handleStatusChange = (newStatus: BookingStatus) => {
    setCurrentStatus(newStatus);
  };

  const handleSaveChanges = () => {
    if (!selectedBooking) return;
    setBookings((prev) =>
      prev.map((b) =>
        b.id === selectedBooking.id ? { ...b, status: currentStatus } : b
      )
    );
  };

  const handleDiscardChanges = () => {
    if (selectedBooking) {
      setCurrentStatus(selectedBooking.status);
    }
  };

  return (
    <div className="flex flex-col items-start gap-[42px] w-full max-w-[1106px] pt-4 pb-12 select-none">
      {/* Top Header */}
      <div className="w-full h-[72px] flex items-center justify-between gap-[67px]">
        <div className="flex flex-col gap-1.5 items-start shrink-0 whitespace-nowrap">
          <h1 className="text-black text-[32px] font-medium leading-[1.2] tracking-[-0.608px]">
            Booking Request
          </h1>
          <p className="text-black text-xl font-normal leading-[1.4] tracking-[-0.38px]">
            Review and process customer booking consultations
          </p>
        </div>

        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search booking"
          inputClassName="w-[340px]"
        />
      </div>

      {/* Filter Tabs Row */}
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-5">
          {filterTabs.map((tab) => {
            const isActive = activeTab === tab.value;
            const count = counts[tab.value];
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "px-5 py-2.5 rounded-[25px] flex items-center gap-[15px] cursor-pointer transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-[#07b6d3] text-white"
                    : "bg-[#c3c3c3] text-white hover:bg-stone-400"
                )}
              >
                <span className="text-base font-normal leading-[1.4] tracking-[-0.304px]">
                  {tab.label}
                </span>
                <span className="bg-white rounded-[10px] px-[5px] py-[2px] text-xs text-[#0f1422] font-normal leading-[1.4] tracking-[-0.228px] text-center min-w-[17px]">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2-Column Split: Booking Cards List (Left) & Booking Details Panel (Right) */}
      <div className="w-full flex items-start gap-[30px]">
        {/* Left Column: Booking Cards List */}
        <div className="w-[593px] shrink-0 flex flex-col gap-[30px]">
          {filteredBookings.length === 0 ? (
            <div className="bg-white rounded-[20px] p-[30px] flex items-center justify-center text-[#c3c3c3] text-base">
              No bookings found
            </div>
          ) : (
            filteredBookings.map((booking) => {
              const isSelected = selectedBooking?.id === booking.id;
              return (
                <div
                  key={booking.id}
                  onClick={() => handleSelectBooking(booking)}
                  className={cn(
                    "bg-white p-[30px] rounded-[20px] flex gap-[30px] items-start w-full cursor-pointer transition-all",
                    isSelected ? "border-2 border-[#07b6d3]" : "border-2 border-transparent hover:border-neutral-200"
                  )}
                >
                  <div className="flex flex-col gap-[30px] items-start flex-1 min-w-0">
                    <p className="text-[#c3c3c3] text-base font-normal leading-[1.4] tracking-[-0.304px]">
                      {booking.referenceNo}
                    </p>
                    <div className="flex flex-col gap-[5px] items-start w-full">
                      <p className="text-[#07b6d3] text-xl font-medium leading-[1.4] tracking-[-0.38px]">
                        {booking.customer.name}
                      </p>
                      <p className="text-[#0f1422] text-sm font-normal leading-[1.4] tracking-[-0.266px] truncate w-full">
                        {booking.productSummary}
                      </p>
                      <p className="text-[#c3c3c3] text-sm font-normal leading-[1.4] tracking-[-0.266px]">
                        {booking.date}
                      </p>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "px-2.5 py-[5px] rounded-[20px] flex items-center justify-center shrink-0",
                      statusBg[booking.status] || "bg-[#ffc876]"
                    )}
                  >
                    <span className="text-white text-xs font-normal leading-[1.4] tracking-[-0.228px] whitespace-nowrap">
                      {booking.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Booking Details Panel */}
        {selectedBooking && (
          <div className="flex-1 bg-white rounded-[20px] p-[30px] flex flex-col gap-[20px] items-end justify-end">
            <div className="flex flex-col gap-[20px] items-start w-full">
              {/* Header: Reference ID & Timestamp */}
              <div className="flex items-center justify-between gap-2.5 w-full">
                <p className="text-[#0f1422] text-2xl font-medium leading-[1.2] tracking-[-0.456px]">
                  {selectedBooking.referenceNo}
                </p>
                <p className="text-[#c3c3c3] text-xs font-normal leading-[1.4] tracking-[-0.228px] text-right">
                  {selectedBooking.receivedDate}
                </p>
              </div>

              {/* Update Status Card */}
              <div className="bg-[#f5f5f5] p-5 rounded-[20px] flex items-center justify-between w-full">
                <p className="text-[#07b6d3] text-base font-medium leading-[1.4] tracking-[-0.304px]">
                  Update Status
                </p>
                <div className="relative">
                  <select
                    value={currentStatus}
                    onChange={(e) =>
                      handleStatusChange(e.target.value as BookingStatus)
                    }
                    className={cn(
                      "appearance-none text-white text-sm font-normal leading-[1.4] tracking-[-0.266px] pl-5 pr-9 py-1.5 rounded-[25px] cursor-pointer outline-none",
                      statusBg[currentStatus] || "bg-[#ffc876]"
                    )}
                  >
                    <option value="Pending" className="text-black bg-white">
                      Pending
                    </option>
                    <option value="Reviewing" className="text-black bg-white">
                      Reviewing
                    </option>
                    <option value="Confirmed" className="text-black bg-white">
                      Confirmed
                    </option>
                    <option value="Cancelled" className="text-black bg-white">
                      Cancelled
                    </option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M4 6L8 10L12 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="w-full border-t border-[#e5e5e5]" />

              {/* Customer Details Box */}
              <div className="bg-[#f5f5f5] p-5 rounded-[20px] flex flex-col gap-2.5 w-full">
                <p className="text-[#07b6d3] text-xl font-medium leading-[1.4] tracking-[-0.38px]">
                  Customer Details
                </p>
                <div className="grid grid-cols-3 gap-x-5 gap-y-1 text-sm leading-[1.4] tracking-[-0.266px]">
                  <span className="text-[#c3c3c3]">Name</span>
                  <span className="text-[#c3c3c3]">Email</span>
                  <span className="text-[#c3c3c3]">Phone Number</span>
                  <span className="text-[#0f1422] font-normal truncate">
                    {selectedBooking.customer.name}
                  </span>
                  <span className="text-[#0f1422] font-normal truncate">
                    {selectedBooking.customer.email}
                  </span>
                  <span className="text-[#0f1422] font-normal truncate">
                    {selectedBooking.customer.phone}
                  </span>
                </div>
              </div>

              {/* Customer Quotation PDF Box */}
              <div className="bg-[#f5f5f5] p-5 rounded-[20px] flex flex-col gap-5 w-full">
                <div className="flex flex-col gap-2.5 items-start">
                  <p className="text-[#07b6d3] text-xl font-medium leading-[1.4] tracking-[-0.38px]">
                    Customer Quotation PDF
                  </p>
                  <p className="text-[#c3c3c3] text-xs font-normal leading-[1.4] tracking-[-0.228px]">
                    The PDF the customer downloaded and shared
                  </p>
                </div>

                <div className="flex gap-5 items-start w-full">
                  {/* PDF Icon Card */}
                  <div className="bg-white p-5 rounded-[20px] size-[103px] flex items-center justify-center shrink-0">
                    <PdfIcon />
                  </div>

                  {/* PDF Details & Action Buttons */}
                  <div className="flex flex-col gap-6 items-start flex-1 min-w-0">
                    <div className="flex flex-col gap-1 items-start w-full">
                      <p className="text-[#0f1422] text-sm font-medium leading-[1.4] tracking-[-0.266px] truncate w-full">
                        {selectedBooking.quotation.filename}
                      </p>
                      <p className="text-[#c3c3c3] text-xs font-normal leading-[1.4] tracking-[-0.228px]">
                        {selectedBooking.quotation.generatedDate} · {selectedBooking.quotation.size}
                      </p>
                    </div>

                    <div className="flex gap-2.5 items-start">
                      <button
                        type="button"
                        className="bg-[#0f1422] text-white text-xs font-normal leading-[1.4] tracking-[-0.228px] px-[15px] py-[5px] rounded-[10px] cursor-pointer hover:bg-black transition-colors whitespace-nowrap"
                      >
                        View PDF
                      </button>
                      <button
                        type="button"
                        className="bg-[#07b6d3] text-white text-xs font-normal leading-[1.4] tracking-[-0.228px] px-[15px] py-[5px] rounded-[10px] cursor-pointer hover:bg-cyan-600 transition-colors whitespace-nowrap"
                      >
                        Download PDF
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="w-full border-t border-[#e5e5e5]" />
            </div>

            {/* Bottom Actions: Discard / Save Changes */}
            <div className="flex gap-2.5 items-center justify-end w-full pt-2">
              <button
                type="button"
                onClick={handleDiscardChanges}
                className="bg-[#c50000] text-white text-xs font-normal leading-[1.4] tracking-[-0.228px] px-[15px] py-[5px] rounded-[10px] cursor-pointer hover:bg-red-700 transition-colors"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSaveChanges}
                className="bg-[#05b64b] text-white text-xs font-normal leading-[1.4] tracking-[-0.228px] px-[15px] py-[5px] rounded-[10px] cursor-pointer hover:bg-emerald-600 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PdfIcon() {
  return (
    <svg
      width="63"
      height="63"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="8" y="4" width="48" height="56" rx="8" fill="#FEE2E2" />
      <path
        d="M38 4L56 22H42C39.7909 22 38 20.2091 38 18V4Z"
        fill="#F87171"
      />
      <rect x="16" y="32" width="32" height="18" rx="4" fill="#EF4444" />
      <text
        x="32"
        y="45"
        fill="white"
        fontSize="12"
        fontWeight="bold"
        textAnchor="middle"
        fontFamily="sans-serif"
      >
        PDF
      </text>
    </svg>
  );
}

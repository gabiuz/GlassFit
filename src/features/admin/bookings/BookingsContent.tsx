"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { SearchBar } from "@/components/shared/SearchBar";
import {
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

import { updateBookingRequestStatus } from "@/lib/booking/bookingActions";

export function BookingsContent({ initialBookings }: { initialBookings: AdminBookingItem[] }) {
  const [bookings, setBookings] = useState<AdminBookingItem[]>(initialBookings);
  const [selectedBookingId, setSelectedBookingId] = useState<string>(
    initialBookings[0]?.id || ""
  );
  const [activeTab, setActiveTab] = useState<BookingStatus | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

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

  const handleSaveChanges = async () => {
    if (!selectedBooking) return;
    setIsSaving(true);
    try {
      // Map UI Reviewing/Confirmed to DB status values
      let dbStatus: "Pending" | "Ongoing" | "Done" | "Cancelled" = "Pending";
      if (currentStatus === "Reviewing") dbStatus = "Ongoing";
      else if (currentStatus === "Confirmed") dbStatus = "Done";
      else if (currentStatus === "Cancelled") dbStatus = "Cancelled";

      await updateBookingRequestStatus({
        bookingRequestId: selectedBooking.id,
        status: dbStatus,
      });

      setBookings((prev) =>
        prev.map((b) =>
          b.id === selectedBooking.id ? { ...b, status: currentStatus } : b
        )
      );

      setFeedbackToast(`Status updated to ${currentStatus} successfully`);
      setTimeout(() => setFeedbackToast(null), 3000);
    } catch (err: unknown) {
      console.error("Failed to update status:", err);
      setFeedbackToast("Failed to save changes. Please try again.");
      setTimeout(() => setFeedbackToast(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    if (selectedBooking) {
      setCurrentStatus(selectedBooking.status);
    }
  };

  return (
    <div className="flex flex-col items-start gap-6 sm:gap-8 w-full max-w-[1240px] pb-12 select-none">
      <div className="w-full flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6">
        <div className="flex flex-col gap-1 items-start min-w-0">
          <h1 className="text-black text-2xl sm:text-3xl lg:text-[32px] font-medium leading-tight tracking-tight">
            Booking Request
          </h1>
          <p className="text-neutral-700 text-sm sm:text-base lg:text-lg font-normal leading-snug">
            Review and process customer booking consultations
          </p>
        </div>

        <div className="w-full md:w-auto">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search booking"
            inputClassName="w-full md:w-[320px] lg:w-[340px]"
          />
        </div>
      </div>

      <div className="w-full overflow-x-auto pb-1 -mx-1 px-1">
        <div className="flex items-center gap-2 sm:gap-3 min-w-max">
          {filterTabs.map((tab) => {
            const isActive = activeTab === tab.value;
            const count = counts[tab.value];
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "px-4 sm:px-5 py-2 sm:py-2.5 rounded-[25px] flex items-center gap-2.5 sm:gap-3 cursor-pointer transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-[#07b6d3] text-white shadow-xs"
                    : "bg-[#c3c3c3] text-white hover:bg-stone-400"
                )}
              >
                <span className="text-sm sm:text-base font-normal leading-snug">
                  {tab.label}
                </span>
                <span className="bg-white rounded-[10px] px-2 sm:px-2.5 py-[2px] text-xs text-[#0f1422] font-semibold leading-tight text-center min-w-[17px]">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full flex flex-col xl:flex-row items-start gap-6">
        <div className="w-full xl:w-[420px] 2xl:w-[480px] shrink-0 flex flex-col gap-4">
          {filteredBookings.length === 0 ? (
            <div className="bg-white rounded-[20px] p-6 flex items-center justify-center text-[#c3c3c3] text-base">
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
                    "bg-white p-4 sm:p-5 rounded-[20px] flex gap-4 items-start w-full cursor-pointer transition-all shadow-xs",
                    isSelected ? "border-2 border-[#07b6d3]" : "border-2 border-transparent hover:border-neutral-200"
                  )}
                >
                  <div className="flex flex-col gap-3 items-start flex-1 min-w-0">
                    <p className="text-[#c3c3c3] text-xs sm:text-sm font-normal leading-snug">
                      {booking.referenceNo}
                    </p>
                    <div className="flex flex-col gap-1 items-start w-full min-w-0">
                      <p className="text-[#07b6d3] text-base sm:text-lg font-medium leading-snug truncate w-full">
                        {booking.customer.name}
                      </p>
                      <p className="text-[#0f1422] text-xs sm:text-sm font-normal leading-snug truncate w-full">
                        {booking.productSummary}
                      </p>
                      <p className="text-[#c3c3c3] text-xs sm:text-sm font-normal leading-snug">
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
                    <span className="text-white text-xs font-normal leading-tight whitespace-nowrap">
                      {booking.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {selectedBooking && (
          <div className="flex-1 w-full bg-white rounded-[20px] p-5 sm:p-6 lg:p-[30px] flex flex-col gap-5 shadow-xs">
            <div className="flex flex-col gap-5 items-start w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2.5 w-full">
                <p className="text-[#0f1422] text-xl sm:text-2xl font-medium leading-tight">
                  {selectedBooking.referenceNo}
                </p>
                <p className="text-[#c3c3c3] text-xs font-normal leading-snug">
                  {selectedBooking.receivedDate}
                </p>
              </div>

              <div className="bg-[#f5f5f5] p-4 sm:p-5 rounded-[20px] flex items-center justify-between w-full">
                <p className="text-[#07b6d3] text-sm sm:text-base font-medium leading-snug">
                  Update Status
                </p>
                <div className="relative">
                  <select
                    value={currentStatus}
                    onChange={(e) =>
                      handleStatusChange(e.target.value as BookingStatus)
                    }
                    className={cn(
                      "appearance-none text-white text-xs sm:text-sm font-medium pl-4 pr-8 py-1.5 rounded-[25px] cursor-pointer outline-none shadow-xs",
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
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white">
                    <svg
                      width="14"
                      height="14"
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

              <div className="w-full border-t border-[#e5e5e5]" />

              <div className="bg-[#f5f5f5] p-4 sm:p-5 rounded-[20px] flex flex-col gap-3 w-full">
                <p className="text-[#07b6d3] text-lg sm:text-xl font-medium leading-snug">
                  Customer Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm leading-snug">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[#c3c3c3] text-xs">Name</span>
                    <span className="text-[#0f1422] font-medium truncate">
                      {selectedBooking.customer.name}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[#c3c3c3] text-xs">Email</span>
                    <span className="text-[#0f1422] font-medium truncate" title={selectedBooking.customer.email}>
                      {selectedBooking.customer.email}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[#c3c3c3] text-xs">Phone Number</span>
                    <span className="text-[#0f1422] font-medium truncate">
                      {selectedBooking.customer.phone}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-[#f5f5f5] p-4 sm:p-5 rounded-[20px] flex flex-col gap-4 w-full">
                <div className="flex flex-col gap-1 items-start">
                  <p className="text-[#07b6d3] text-lg sm:text-xl font-medium leading-snug">
                    Customer Quotation PDF
                  </p>
                  <p className="text-[#c3c3c3] text-xs font-normal leading-snug">
                    The PDF the customer downloaded and shared
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full">
                  <div className="bg-white p-3 sm:p-4 rounded-[16px] size-[80px] sm:size-[90px] flex items-center justify-center shrink-0 shadow-xs">
                    <Image
                      src="/admin/pdf-file.svg"
                      alt="PDF file"
                      width={50}
                      height={50}
                      className="w-10 sm:w-12 h-auto"
                    />
                  </div>

                  <div className="flex flex-col gap-3 items-start flex-1 min-w-0 w-full">
                    <div className="flex flex-col gap-0.5 items-start w-full">
                      <p className="text-[#0f1422] text-sm font-medium leading-snug truncate w-full">
                        {selectedBooking.quotation.filename}
                      </p>
                      <p className="text-[#c3c3c3] text-xs font-normal leading-snug">
                        {selectedBooking.quotation.generatedDate} · {selectedBooking.quotation.size}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2.5 items-start">
                      <button
                        type="button"
                        className="bg-[#0f1422] text-white text-xs font-normal px-3.5 py-1.5 rounded-[10px] cursor-pointer hover:bg-black transition-colors whitespace-nowrap"
                      >
                        View PDF
                      </button>
                      <button
                        type="button"
                        className="bg-[#07b6d3] text-white text-xs font-normal px-3.5 py-1.5 rounded-[10px] cursor-pointer hover:bg-cyan-600 transition-colors whitespace-nowrap"
                      >
                        Download PDF
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full border-t border-[#e5e5e5]" />
            </div>

            <div className="flex gap-2.5 items-center justify-end w-full pt-1">
              <button
                type="button"
                onClick={handleDiscardChanges}
                disabled={isSaving}
                className="bg-[#c50000] text-white text-xs font-medium px-4 py-2 rounded-[10px] cursor-pointer hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="bg-[#05b64b] text-white text-xs font-medium px-4 py-2 rounded-[10px] cursor-pointer hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSaving && (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>{isSaving ? "Saving..." : "Save Changes"}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating feedback toast */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0f1422] text-white py-3 px-5 rounded-[12px] shadow-xl flex items-center gap-3 border border-neutral-800 transition-all duration-300">
          <div className="bg-[#05b64b] flex items-center justify-center w-5 h-5 rounded-full shrink-0">
            <Image
              src="/send-booking/check.svg"
              alt="Success"
              width={10}
              height={10}
              className="object-contain"
            />
          </div>
          <span className="text-sm font-normal tracking-tight">{feedbackToast}</span>
        </div>
      )}
    </div>
  );
}
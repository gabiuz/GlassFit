import type { AdminBookingItem, BookingStatus } from "./bookingData";

export interface BookingState {
  bookings: AdminBookingItem[];
  selectedBookingId: string;
  currentStatus: BookingStatus;
  loadError: string | null;
}

export type BookingStateAction =
  | { type: "select"; bookingId: string }
  | { type: "edit-status"; status: BookingStatus }
  | { type: "discard-status" }
  | { type: "status-saved"; bookingId: string; status: BookingStatus }
  | { type: "server-refresh"; bookings: AdminBookingItem[]; loadError: string | null };

export function createBookingState(
  bookings: AdminBookingItem[],
  loadError: string | null = null
): BookingState {
  const selected = bookings[0];
  return {
    bookings,
    selectedBookingId: selected?.id ?? "",
    currentStatus: selected?.status ?? "Pending",
    loadError,
  };
}

export function reconcileBookingState(
  state: BookingState,
  bookings: AdminBookingItem[],
  loadError: string | null
): BookingState {
  if (loadError) return { ...state, loadError };

  const selected =
    bookings.find((booking) => booking.id === state.selectedBookingId) ?? bookings[0];
  return {
    bookings,
    selectedBookingId: selected?.id ?? "",
    currentStatus: selected?.status ?? "Pending",
    loadError: null,
  };
}

export function bookingStateReducer(
  state: BookingState,
  action: BookingStateAction
): BookingState {
  switch (action.type) {
    case "select": {
      const selected = state.bookings.find((booking) => booking.id === action.bookingId);
      return selected
        ? { ...state, selectedBookingId: selected.id, currentStatus: selected.status }
        : state;
    }
    case "edit-status":
      return { ...state, currentStatus: action.status };
    case "discard-status": {
      const selected = state.bookings.find(
        (booking) => booking.id === state.selectedBookingId
      );
      return { ...state, currentStatus: selected?.status ?? "Pending" };
    }
    case "status-saved":
      return {
        ...state,
        bookings: state.bookings.map((booking) =>
          booking.id === action.bookingId
            ? { ...booking, status: action.status }
            : booking
        ),
        currentStatus: action.status,
      };
    case "server-refresh":
      return reconcileBookingState(state, action.bookings, action.loadError);
  }
}

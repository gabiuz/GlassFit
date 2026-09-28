/**
 * GlassFit My Requests State Management & Reducer (IMP-MS19)
 *
 * Traceability: PRD-F12, PRD-F17, SDD-C10, DSD-UI12, QAD-TC32
 * Compliance: BAN-TYPE-05 (Zero any), BAN-PUNCT-01 (Zero em-dashes)
 */

import {
  type ClientRequestItem,
  type RequestFilter,
  type RequestUpdate,
  CANONICAL_REQUEST_FIXTURES,
} from "./requestData";

export interface RequestState {
  requests: ClientRequestItem[];
  selectedRequestId: string;
  activeFilter: RequestFilter;
  expandedTimelineRequestId: string | null;
}

export type RequestAction =
  | { type: "select"; requestId: string }
  | { type: "set-filter"; filter: RequestFilter }
  | { type: "toggle-timeline"; requestId: string }
  | { type: "sync-requests"; requests: ClientRequestItem[] };

/**
 * Filters request items according to canonical filter rules.
 */
export function filterRequests(
  requests: ClientRequestItem[],
  filter: RequestFilter
): ClientRequestItem[] {
  switch (filter) {
    case "All":
      return requests;
    case "Active":
      return requests.filter(
        (item) => item.status === "Pending" || item.status === "Ongoing"
      );
    case "Completed":
      return requests.filter((item) => item.status === "Done");
    case "Cancelled":
      return requests.filter((item) => item.status === "Cancelled");
    default:
      return requests;
  }
}

/**
 * Returns deterministic record counts for each filter tab.
 */
export function getFilterCounts(
  requests: ClientRequestItem[]
): Record<RequestFilter, number> {
  return {
    All: requests.length,
    Active: requests.filter(
      (item) => item.status === "Pending" || item.status === "Ongoing"
    ).length,
    Completed: requests.filter((item) => item.status === "Done").length,
    Cancelled: requests.filter((item) => item.status === "Cancelled").length,
  };
}

/**
 * Selects the active request record, or null when no row is selected.
 */
export function getSelectedRequest(state: RequestState): ClientRequestItem | null {
  if (!state.selectedRequestId) {
    return null;
  }
  return state.requests.find((item) => item.id === state.selectedRequestId) ?? null;
}

/**
 * Sorts request updates newest first using occurredAt without mutating input array.
 */
export function getSortedTimelineUpdates(updates: RequestUpdate[]): RequestUpdate[] {
  return [...updates].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );
}

/**
 * Creates the initial request state satisfying all Section 5 invariants.
 */
export function createInitialRequestState(
  requests: ClientRequestItem[] = CANONICAL_REQUEST_FIXTURES
): RequestState {
  const initialSelection = requests.length > 0 ? requests[0].id : "";
  return {
    requests,
    selectedRequestId: initialSelection,
    activeFilter: "All",
    expandedTimelineRequestId: null,
  };
}

/**
 * Pure reducer managing request selection, filter changes, and timeline expansion.
 */
export function requestReducer(
  state: RequestState,
  action: RequestAction
): RequestState {
  switch (action.type) {
    case "select": {
      if (state.selectedRequestId === action.requestId) {
        return state;
      }
      return {
        ...state,
        selectedRequestId: action.requestId,
        expandedTimelineRequestId: null,
      };
    }
    case "set-filter": {
      const visibleRequests = filterRequests(state.requests, action.filter);
      const isCurrentSelectionVisible = visibleRequests.some(
        (item) => item.id === state.selectedRequestId
      );

      let nextSelectedId = state.selectedRequestId;
      if (!isCurrentSelectionVisible) {
        nextSelectedId = visibleRequests.length > 0 ? visibleRequests[0].id : "";
      }

      const selectionChanged = nextSelectedId !== state.selectedRequestId;

      return {
        ...state,
        activeFilter: action.filter,
        selectedRequestId: nextSelectedId,
        expandedTimelineRequestId: selectionChanged
          ? null
          : state.expandedTimelineRequestId,
      };
    }
    case "toggle-timeline": {
      const isCurrentlyExpanded =
        state.expandedTimelineRequestId === action.requestId;
      return {
        ...state,
        expandedTimelineRequestId: isCurrentlyExpanded ? null : action.requestId,
      };
    }
    case "sync-requests": {
      const visibleRequests = filterRequests(action.requests, state.activeFilter);
      const isCurrentSelectionVisible = visibleRequests.some(
        (item) => item.id === state.selectedRequestId
      );

      let nextSelectedId = state.selectedRequestId;
      if (!isCurrentSelectionVisible) {
        nextSelectedId = visibleRequests.length > 0 ? visibleRequests[0].id : "";
      }

      const selectionChanged = nextSelectedId !== state.selectedRequestId;

      return {
        ...state,
        requests: action.requests,
        selectedRequestId: nextSelectedId,
        expandedTimelineRequestId: selectionChanged
          ? null
          : state.expandedTimelineRequestId,
      };
    }
    default:
      return state;
  }
}

"use client";

import { useState } from "react";
import { approveStaffEmailChange, rejectStaffEmailChange } from "./settingsActions";

export function EmailChangeReviewActions({ token, disabled }: { token: string; disabled: boolean }) {
    const [pending, setPending] = useState<"approve" | "reject" | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const decide = async (decision: "approve" | "reject") => {
        setPending(decision);
        setMessage(null);
        setError(null);
        const result = decision === "approve" ? await approveStaffEmailChange(token) : await rejectStaffEmailChange(token);
        setPending(null);
        if (result.ok) setMessage(result.message);
        else setError(result.error);
    };

    return (
        <div className="flex flex-col gap-3">
            {message && <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</p>}
            {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="flex flex-wrap gap-3">
                <button type="button" disabled={disabled || pending !== null} onClick={() => decide("approve")}
                    className="rounded-[10px] bg-[#07b6d3] px-5 py-2.5 text-sm text-white disabled:opacity-50">
                    {pending === "approve" ? "Approving..." : "Approve"}
                </button>
                <button type="button" disabled={disabled || pending !== null} onClick={() => decide("reject")}
                    className="rounded-[10px] border border-red-300 bg-white px-5 py-2.5 text-sm text-red-700 disabled:opacity-50">
                    {pending === "reject" ? "Rejecting..." : "Reject"}
                </button>
            </div>
        </div>
    );
}

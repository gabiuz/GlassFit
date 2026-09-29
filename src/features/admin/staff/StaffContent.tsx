"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { StaffStatusBadge } from "./StaffStatusBadge";
import { StaffActionsMenu } from "./StaffActionsMenu";
import { InviteStaffDialog } from "./InviteStaffDialog";
import type { StaffActionResult } from "@/app/admin/(protected)/staff/actions";

type StaffMember = {
    profile_id: string;
    full_name: string | null;
    email: string;
    status: string;
    created_at: string;
    // Supabase returns FK joins as arrays; we always expect 0 or 1 role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admin_roles: any;
};

type StaffContentProps = {
    initialStaff: StaffMember[];
};

export function StaffContent({ initialStaff }: StaffContentProps) {
    const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

    const showToast = (result: StaffActionResult) => {
        if (result.success) {
            setToast({ type: "success", message: result.message });
        } else {
            setToast({ type: "error", message: result.error });
        }
        setTimeout(() => setToast(null), 4000);
    };

    return (
        <div className="flex flex-col gap-6 sm:gap-8 w-full max-w-[1240px] pb-12">
            {/* Header */}
            <div className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-black text-2xl sm:text-3xl lg:text-[32px] font-medium leading-tight tracking-tight">
                    Staff Accounts
                </h1>
                <button
                    id="invite-staff-btn"
                    type="button"
                    onClick={() => setIsInviteOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-[#07b6d3] text-white text-sm font-normal hover:bg-[#06a4be] transition-colors self-start sm:self-auto"
                >
                    <UserPlus className="w-4 h-4" />
                    Invite Staff
                </button>
            </div>

            {/* Toast Notification */}
            {toast && (
                <div
                    role="status"
                    className={`fixed top-6 right-6 z-[100] px-5 py-3.5 rounded-[10px] shadow-lg text-sm font-normal transition-all ${
                        toast.type === "success"
                            ? "bg-[#05b64b] text-white"
                            : "bg-[#e74242] text-white"
                    }`}
                >
                    {toast.message}
                </div>
            )}

            {/* Staff Table */}
            <div className="bg-white rounded-[20px] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                        <thead>
                            <tr className="border-b border-[#e5e5e5]">
                                <th className="text-left px-6 py-4 text-xs font-medium text-black tracking-tight">
                                    Name
                                </th>
                                <th className="text-left px-6 py-4 text-xs font-medium text-black tracking-tight">
                                    Email
                                </th>
                                <th className="text-left px-6 py-4 text-xs font-medium text-black tracking-tight">
                                    Role
                                </th>
                                <th className="text-left px-6 py-4 text-xs font-medium text-black tracking-tight">
                                    Status
                                </th>
                                <th className="text-left px-6 py-4 text-xs font-medium text-black tracking-tight">
                                    Created
                                </th>
                                <th className="text-right px-6 py-4 text-xs font-medium text-black tracking-tight">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {staff.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={6}
                                        className="px-6 py-12 text-center text-sm text-[#c3c3c3]"
                                    >
                                        No Admin accounts found. Invite a Staff member to get started.
                                    </td>
                                </tr>
                            ) : (
                                staff.map((member) => (
                                    <StaffTableRow
                                        key={member.profile_id}
                                        member={member}
                                        onActionResult={showToast}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Invite Dialog */}
            <InviteStaffDialog
                isOpen={isInviteOpen}
                onClose={() => setIsInviteOpen(false)}
                onResult={(result) => {
                    showToast(result);
                    // Refresh list after successful invite — page revalidation via server
                    if (result.success) {
                        window.location.reload();
                    }
                }}
            />
        </div>
    );
}

function StaffTableRow({
    member,
    onActionResult,
}: {
    member: StaffMember;
    onActionResult: (result: StaffActionResult) => void;
}) {
    const roleName = member.admin_roles?.role_name ?? "—";
    const isOwner = roleName.toLowerCase() === "owner";

    const createdDate = new Date(member.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });

    return (
        <tr className="border-b border-[#e5e5e5] last:border-0 hover:bg-neutral-50/50 transition-colors">
            <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                    <div className="size-8 rounded-full bg-gradient-to-r from-[#097283] to-[#45c9e3] flex items-center justify-center shrink-0">
                        <span className="text-white text-xs font-medium">
                            {(member.full_name ?? member.email)[0]?.toUpperCase() ?? "?"}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-[#0f1422] leading-tight">
                            {member.full_name ?? "—"}
                        </span>
                        {isOwner && (
                            <span className="text-[10px] text-[#07b6d3] font-medium">Owner</span>
                        )}
                    </div>
                </div>
            </td>
            <td className="px-6 py-4">
                <span className="text-sm text-[#0f1422] truncate max-w-[200px] block">
                    {member.email}
                </span>
            </td>
            <td className="px-6 py-4">
                <span
                    className={`text-sm font-medium ${
                        isOwner ? "text-[#07b6d3]" : "text-[#0f1422]"
                    }`}
                >
                    {roleName}
                </span>
            </td>
            <td className="px-6 py-4">
                <StaffStatusBadge status={member.status} />
            </td>
            <td className="px-6 py-4">
                <span className="text-sm text-[#c3c3c3]">{createdDate}</span>
            </td>
            <td className="px-6 py-4 text-right">
                <StaffActionsMenu
                    profileId={member.profile_id}
                    email={member.email}
                    status={member.status}
                    onResult={onActionResult}
                />
            </td>
        </tr>
    );
}

import { requireAdmin } from "@/lib/auth/admin";
import { getStaffEmailChangeRequest } from "@/features/admin/settings/settingsActions";
import { EmailChangeReviewActions } from "@/features/admin/settings/EmailChangeReviewActions";

export const metadata = { title: "Review Email Change | GlassFit Admin" };

export default async function StaffEmailChangeReviewPage({ params }: { params: Promise<{ token: string }> }) {
    const context = await requireAdmin();
    const { token } = await params;
    const privileged = context.role.roleName === "Owner" || context.role.roleName === "Manager";
    const result = privileged ? await getStaffEmailChangeRequest(token) : { ok: false as const, error: "Owner or Manager access is required." };

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-12">
            <div>
                <h1 className="text-3xl font-medium tracking-tight text-[#0f1422]">Review email change</h1>
                <p className="mt-2 text-neutral-600">Opening this page does not change the Staff account.</p>
            </div>
            {!result.ok || !result.data ? (
                <div className="rounded-[20px] border border-red-200 bg-white p-6 text-red-700">{result.ok ? "Request not found." : result.error}</div>
            ) : (
                <div className="flex flex-col gap-5 rounded-[20px] bg-white p-6 sm:p-[30px]">
                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                        <p><span className="font-medium">Staff member:</span><br />{result.data.staffName}</p>
                        <p><span className="font-medium">Status:</span><br />{result.data.status}</p>
                        <p><span className="font-medium">Current email:</span><br />{result.data.previousEmail}</p>
                        <p><span className="font-medium">Proposed email:</span><br />{result.data.proposedEmail}</p>
                        <p><span className="font-medium">Requested:</span><br />{new Date(result.data.requestedAt).toLocaleString()}</p>
                        <p><span className="font-medium">Expires:</span><br />{result.data.expiresAt ? new Date(result.data.expiresAt).toLocaleString() : "Not applicable"}</p>
                    </div>
                    <EmailChangeReviewActions token={token} disabled={result.data.status !== "PendingApproval"} />
                </div>
            )}
        </div>
    );
}

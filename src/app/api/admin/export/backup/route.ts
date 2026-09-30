/**
 * GlassFit Comprehensive Enterprise System Backup Snapshot Streaming Route (IMP-MS32)
 *
 * Traceability: PRD-F14, SDD-C9, SDD-C10, ERD-E1 through ERD-E18, BAN-AUTH-04, QAD-TC14, QAD-TC47
 */

import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/auth/admin";
import { compileSystemBackup } from "@/lib/export/systemBackupService";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const authResult = await checkAdminAuth();
        if (!authResult.ok) {
            return NextResponse.json(
                { error: "Unauthorized: Active administrator session required." },
                { status: 401 }
            );
        }

        const { context } = authResult;
        const isOwner = context.role.roleName.toLowerCase() === "owner";

        if (!isOwner) {
            return NextResponse.json(
                { error: "Forbidden: Only an Owner administrator may download system backups." },
                { status: 403 }
            );
        }

        const backupEnvelope = await compileSystemBackup(context.userId);

        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        const hh = String(now.getHours()).padStart(2, "0");
        const min = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");
        const timestampStr = `${yyyy}-${mm}-${dd}-${hh}${min}${ss}`;
        const filename = `glassfit-backup-${timestampStr}.json`;

        const jsonContent = JSON.stringify(backupEnvelope, null, 2);

        return new Response(jsonContent, {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store, max-age=0",
            },
        });
    } catch (error) {
        console.error("[GET /api/admin/export/backup] Error:", error);
        return NextResponse.json(
            { error: "Failed to compile system backup snapshot." },
            { status: 500 }
        );
    }
}

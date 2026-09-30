/**
 * GlassFit Consultation Booking Records Export Streaming Route (IMP-MS32)
 *
 * Traceability: PRD-F14, PRD-F10, PRD-F12, PRD-F13; SDD-C9, SDD-C10; QAD-TC47
 */

import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/auth/admin";
import { generateBookingsCsv, generateBookingsExcel } from "@/lib/export/bookingExportService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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
        const hasPermission = isOwner || context.role.permissions.manageBookings;

        if (!hasPermission) {
            return NextResponse.json(
                { error: "Forbidden: Insufficient permissions to export booking records." },
                { status: 403 }
            );
        }

        const searchParams = request.nextUrl.searchParams;
        const format = searchParams.get("format")?.toLowerCase();
        const isCsv = format === "csv";

        const today = new Date().toISOString().split("T")[0];

        if (isCsv) {
            const csvContent = await generateBookingsCsv({
                operatorName: context.fullName,
                operatorRole: context.role.roleName,
            });

            const filename = `glassfit-bookings-${today}.csv`;
            return new Response(csvContent, {
                status: 200,
                headers: {
                    "Content-Type": "text/csv; charset=utf-8",
                    "Content-Disposition": `attachment; filename="${filename}"`,
                    "Cache-Control": "no-store, max-age=0",
                },
            });
        }

        const excelContent = await generateBookingsExcel({
            operatorName: context.fullName,
            operatorRole: context.role.roleName,
        });

        const filename = `glassfit-bookings-${today}.xls`;
        return new Response(excelContent, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.ms-excel; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store, max-age=0",
            },
        });
    } catch (error) {
        console.error("[GET /api/admin/export/bookings] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate booking records export." },
            { status: 500 }
        );
    }
}


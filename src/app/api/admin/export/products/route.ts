/**
 * GlassFit Master Product Catalog Export Streaming Route (IMP-MS32)
 *
 * Traceability: PRD-F14, SDD-C9, SDD-C10, ERD-E3, QAD-TC47
 */

import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/auth/admin";
import { generateProductsCsv, generateProductsExcel } from "@/lib/export/productExportService";

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
        const hasPermission = isOwner || context.role.permissions.manageProducts;

        if (!hasPermission) {
            return NextResponse.json(
                { error: "Forbidden: Insufficient permissions to export product catalog." },
                { status: 403 }
            );
        }

        const searchParams = request.nextUrl.searchParams;
        const format = searchParams.get("format")?.toLowerCase();
        const isCsv = format === "csv";

        const today = new Date().toISOString().split("T")[0];

        if (isCsv) {
            const csvContent = await generateProductsCsv({
                operatorName: context.fullName,
                operatorRole: context.role.roleName,
            });

            const filename = `glassfit-products-${today}.csv`;
            return new Response(csvContent, {
                status: 200,
                headers: {
                    "Content-Type": "text/csv; charset=utf-8",
                    "Content-Disposition": `attachment; filename="${filename}"`,
                    "Cache-Control": "no-store, max-age=0",
                },
            });
        }

        const excelContent = await generateProductsExcel({
            operatorName: context.fullName,
            operatorRole: context.role.roleName,
        });

        const filename = `glassfit-products-${today}.xls`;
        return new Response(excelContent, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.ms-excel; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store, max-age=0",
            },
        });
    } catch (error) {
        console.error("[GET /api/admin/export/products] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate product catalog export." },
            { status: 500 }
        );
    }
}


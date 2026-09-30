/**
 * GlassFit Master Product Catalog Business Intelligence Export Service (IMP-MS32)
 *
 * Traceability: PRD-F14, SDD-C9, SDD-C10, ERD-E3, ERD-E4, ERD-E6, ERD-E17, QAD-TC47
 */

import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
    UTF8_BOM,
    formatCsvRow,
    formatCsvComment,
    formatPstTimestamp,
    formatPhpCurrency,
    generateMultiSegmentBar,
} from "./csvFormatter";


export interface ProductExportOptions {
    operatorName: string;
    operatorRole: string;
}

interface RawParameter {
    parameter_key: string;
    parameter_name: string;
    minimum_value: number | null;
    maximum_value: number | null;
    default_value: unknown;
}

interface RawComponent {
    component_id: string;
    component_name: string;
    component_type: string;
    status: string;
}

interface RawTemplate {
    template_id: string;
    template_name: string;
    product_parameters?: RawParameter[] | null;
    product_components?: RawComponent[] | null;
}

interface RawProduct {
    product_id: string;
    product_name: string;
    product_type: string;
    status: string;
    base_price: number;
    updated_at: string;
    product_templates?: RawTemplate | RawTemplate[] | null;
}

/**
 * Compiles the GlassFit Master Product Catalog and Inventory Specifications CSV.
 */
export async function generateProductsCsv(options: ProductExportOptions): Promise<string> {
    const supabase = createSupabaseServiceClient();

    // 1. Fetch products with templates, parameters, and components
    const { data: rawProducts, error: productError } = await supabase
        .from("products")
        .select(`
            product_id,
            product_name,
            product_type,
            status,
            base_price,
            updated_at,
            product_templates (
                template_id,
                template_name,
                product_parameters (
                    parameter_key,
                    parameter_name,
                    minimum_value,
                    maximum_value,
                    default_value
                ),
                product_components (
                    component_id,
                    component_name,
                    component_type,
                    status
                )
            )
        `)
        .order("product_name", { ascending: true });

    if (productError) {
        throw new Error(`Failed to query product records: ${productError.message}`);
    }

    // 2. Fetch raw materials count
    const { count: rawMaterialsCount, error: materialError } = await supabase
        .from("raw_materials")
        .select("*", { count: "exact", head: true });

    if (materialError) {
        console.warn("[generateProductsCsv] Warning fetching raw materials count:", materialError.message);
    }

    const products = (rawProducts ?? []) as unknown as RawProduct[];

    // Compute Catalog KPI Summary
    const totalProducts = products.length;
    let activeProducts = 0;
    let draftProducts = 0;
    let totalPriceSum = 0;
    let totalMappedComponents = 0;

    interface ProcessedProductRow {
        productId: string;
        productName: string;
        category: string;
        status: string;
        basePrice: string;
        minWidth: string;
        maxWidth: string;
        minHeight: string;
        maxHeight: string;
        defaultFinish: string;
        defaultGlazing: string;
        mappedComponents: number;
        removableSillSupported: string;
        lastUpdatedPst: string;
    }

    const processedRows: ProcessedProductRow[] = [];

    for (const p of products) {
        const isActive = p.status === "Active";
        if (isActive) activeProducts++;
        else draftProducts++;

        const priceNum = Number(p.base_price ?? 0);
        totalPriceSum += priceNum;

        const template = Array.isArray(p.product_templates)
            ? p.product_templates[0]
            : p.product_templates;

        const parameters = template?.product_parameters ?? [];
        const components = template?.product_components ?? [];
        totalMappedComponents += components.length;

        let minWidth = "N/A";
        let maxWidth = "N/A";
        let minHeight = "N/A";
        let maxHeight = "N/A";
        let defaultFinish = "Standard";
        let defaultGlazing = "Standard Glass";
        let removableSill = "No";

        for (const param of parameters) {
            const key = param.parameter_key.toLowerCase();
            if (key === "width" || key.includes("width")) {
                if (param.minimum_value !== null) minWidth = String(Math.round(param.minimum_value));
                if (param.maximum_value !== null) maxWidth = String(Math.round(param.maximum_value));
            }
            if (key === "height" || key.includes("height")) {
                if (param.minimum_value !== null) minHeight = String(Math.round(param.minimum_value));
                if (param.maximum_value !== null) maxHeight = String(Math.round(param.maximum_value));
            }
            if (key === "finish" || key.includes("finish") || key.includes("aluminum")) {
                if (typeof param.default_value === "string") {
                    defaultFinish = param.default_value;
                } else if (param.default_value && typeof param.default_value === "object") {
                    const dv = param.default_value as Record<string, unknown>;
                    defaultFinish = String(dv.name || dv.value || dv.label || "Standard Finish");
                }
            }
            if (key === "glass" || key.includes("glass") || key.includes("glazing")) {
                if (typeof param.default_value === "string") {
                    defaultGlazing = param.default_value;
                } else if (param.default_value && typeof param.default_value === "object") {
                    const dv = param.default_value as Record<string, unknown>;
                    defaultGlazing = String(dv.name || dv.value || dv.label || "Standard Glass");
                }
            }
            if (key.includes("sill") || key.includes("removable_sill") || key.includes("flush")) {
                removableSill = "Yes";
            }
        }

        // Fallbacks for standard architectural window types if not explicitly in parameters
        if (p.product_type === "Window" && removableSill === "No" && p.product_name.toLowerCase().includes("sliding")) {
            removableSill = "Yes";
        }

        processedRows.push({
            productId: p.product_id,
            productName: p.product_name,
            category: p.product_type,
            status: p.status,
            basePrice: priceNum.toFixed(2),
            minWidth: minWidth !== "N/A" ? minWidth : "600",
            maxWidth: maxWidth !== "N/A" ? maxWidth : "3600",
            minHeight: minHeight !== "N/A" ? minHeight : "600",
            maxHeight: maxHeight !== "N/A" ? maxHeight : "2400",
            defaultFinish,
            defaultGlazing,
            mappedComponents: components.length,
            removableSillSupported: removableSill,
            lastUpdatedPst: formatPstTimestamp(p.updated_at),
        });
    }

    const avgBasePrice = totalProducts > 0
        ? (totalPriceSum / totalProducts).toFixed(2)
        : "0.00";
    const totalMaterials = rawMaterialsCount ?? 0;
    const activePct = totalProducts > 0 ? ((activeProducts / totalProducts) * 100).toFixed(1) : "0.0";
    const draftPct = totalProducts > 0 ? ((draftProducts / totalProducts) * 100).toFixed(1) : "0.0";

    // Visual distribution bar for catalog health
    const catalogHealthBar = generateMultiSegmentBar([
        { count: activeProducts, char: "█" },
        { count: draftProducts, char: "░" },
    ], 24);

    const generatedPst = formatPstTimestamp(new Date());

    // Build CSV lines
    const lines: string[] = [
        UTF8_BOM + formatCsvComment("=============================================================================="),
        formatCsvComment("  GLASSFIT ARCHITECTURAL GLASS & ALUMINUM - MASTER CATALOG EXPORT             "),
        formatCsvComment("  Web-Based Client-Space Visualization & Fenestration Estimation System        "),
        formatCsvComment("=============================================================================="),
        formatCsvComment(`Report Title:   Product Master Catalog & Dimensional Inventory Specifications`),
        formatCsvComment(`Generated At:   ${generatedPst} PST (UTC+08:00)`),
        formatCsvComment(`Generated By:   ${options.operatorName} (${options.operatorRole})`),
        formatCsvComment(`System Platform: GlassFit Capstone Production Platform (PUP CCIS)`),
        formatCsvComment(`Scope:          Full Enterprise Product Catalog (${totalProducts} Configured Models)`),
        formatCsvComment("=============================================================================="),
        formatCsvComment(""),
        formatCsvComment("--- 1. EXECUTIVE VISUAL CATALOG HEALTH & INVENTORY CHARTS ---"),
        formatCsvComment("Chart Name,Visual Distribution Bar,Breakdown / Proportions"),
        formatCsvComment(`Catalog Publishing Health,[${catalogHealthBar}],Active / Live: ${activePct}% (█) | Draft: ${draftPct}% (░)`),
        formatCsvComment(""),
        formatCsvComment("--- 2. MASTER CATALOG KPI SNAPSHOT ---"),
        formatCsvComment("Metric Description,Raw Value,Formatted Value (PHP),Analysis / Notes"),
        formatCsvComment(`Total Configured Products,${totalProducts},${totalProducts} Models,Total fenestration product models defined`),
        formatCsvComment(`Active / Published Products,${activeProducts},${activeProducts} Live Models,Available for client visualization in catalog`),
        formatCsvComment(`Draft / Development Models,${draftProducts},${draftProducts} Draft Models,Under structural rule or component configuration`),
        formatCsvComment(`Mean Catalog Base Price,${avgBasePrice},${formatPhpCurrency(Number(avgBasePrice))},Average baseline fixture manufacturing cost`),
        formatCsvComment(`Total 3D Parametric Components,${totalMappedComponents},${totalMappedComponents} Meshes,Discrete 3D parts mapped to raw materials`),
        formatCsvComment(`Central Raw Material Profiles,${totalMaterials},${totalMaterials} Profiles,Active aluminum extrusion dies and glass stock rates`),
        formatCsvComment(""),
        formatCsvComment("--- 3. DETAILED PRODUCT CATALOG SPECIFICATIONS ---"),
        formatCsvRow([
            "Product ID",
            "Product Name",
            "Category",
            "Publishing Status",
            "Base Price (PHP)",
            "Min Width (mm)",
            "Max Width (mm)",
            "Min Height (mm)",
            "Max Height (mm)",
            "Default Aluminum Finish",
            "Default Glazing Specification",
            "Mapped 3D Components",
            "Removable Sill Supported",
            "Last Updated (PST)",
        ]),
    ];


    for (const r of processedRows) {
        lines.push(
            formatCsvRow([
                r.productId,
                r.productName,
                r.category,
                r.status,
                r.basePrice,
                r.minWidth,
                r.maxWidth,
                r.minHeight,
                r.maxHeight,
                r.defaultFinish,
                r.defaultGlazing,
                r.mappedComponents,
                r.removableSillSupported,
                r.lastUpdatedPst,
            ])
        );
    }

    return lines.join("\r\n");
}

/**
 * Compiles a rich, professionally styled Microsoft Excel workbook (SpreadsheetML)
 * for the master product catalog with GlassFit branding, auto-fitted column widths,
 * KPI summary cards, category distributions, and status badges.
 */
export async function generateProductsExcel(options: ProductExportOptions): Promise<string> {
    const supabase = createSupabaseServiceClient();

    const { data: rawProducts, error: productError } = await supabase
        .from("products")
        .select(`
            product_id,
            product_name,
            product_type,
            status,
            base_price,
            updated_at,
            product_templates (
                template_id,
                template_name,
                product_parameters (
                    parameter_key,
                    parameter_name,
                    minimum_value,
                    maximum_value,
                    default_value
                ),
                product_components (
                    component_id,
                    component_name,
                    component_type,
                    status
                )
            )
        `)
        .order("product_name", { ascending: true });

    if (productError) {
        throw new Error(`Failed to query product records: ${productError.message}`);
    }

    const { count: rawMaterialsCount } = await supabase
        .from("raw_materials")
        .select("*", { count: "exact", head: true });

    const products = (rawProducts ?? []) as unknown as RawProduct[];

    const totalProducts = products.length;
    let activeProducts = 0;
    let draftProducts = 0;
    let totalPriceSum = 0;
    let totalMappedComponents = 0;

    const categoryCounts: Record<string, number> = {};

    const { buildExcelWorkbook } = await import("./excelFormatter");
    type ExcelRow = import("./excelFormatter").ExcelRow;

    const catalogRows: ExcelRow[] = [];

    for (let i = 0; i < products.length; i++) {
        const p = products[i];
        const isActive = p.status === "Active";
        if (isActive) activeProducts++;
        else draftProducts++;

        const pType = p.product_type || "Other";
        categoryCounts[pType] = (categoryCounts[pType] || 0) + 1;

        const priceNum = Number(p.base_price ?? 0);
        totalPriceSum += priceNum;

        const template = Array.isArray(p.product_templates)
            ? p.product_templates[0]
            : p.product_templates;

        const parameters = template?.product_parameters ?? [];
        const components = template?.product_components ?? [];
        totalMappedComponents += components.length;

        let minWidth = "600";
        let maxWidth = "3600";
        let minHeight = "600";
        let maxHeight = "2400";
        let defaultFinish = "Standard Finish";
        let defaultGlazing = "Standard Glass";
        let removableSill = "No";

        for (const param of parameters) {
            const key = param.parameter_key.toLowerCase();
            if (key === "width" || key.includes("width")) {
                if (param.minimum_value !== null) minWidth = String(Math.round(param.minimum_value));
                if (param.maximum_value !== null) maxWidth = String(Math.round(param.maximum_value));
            }
            if (key === "height" || key.includes("height")) {
                if (param.minimum_value !== null) minHeight = String(Math.round(param.minimum_value));
                if (param.maximum_value !== null) maxHeight = String(Math.round(param.maximum_value));
            }
            if (key === "finish" || key.includes("finish") || key.includes("aluminum")) {
                if (typeof param.default_value === "string") {
                    defaultFinish = param.default_value;
                } else if (param.default_value && typeof param.default_value === "object") {
                    const dv = param.default_value as Record<string, unknown>;
                    defaultFinish = String(dv.name || dv.value || dv.label || "Standard Finish");
                }
            }
            if (key === "glass" || key.includes("glass") || key.includes("glazing")) {
                if (typeof param.default_value === "string") {
                    defaultGlazing = param.default_value;
                } else if (param.default_value && typeof param.default_value === "object") {
                    const dv = param.default_value as Record<string, unknown>;
                    defaultGlazing = String(dv.name || dv.value || dv.label || "Standard Glass");
                }
            }
            if (key.includes("sill") || key.includes("removable_sill") || key.includes("flush")) {
                removableSill = "Yes";
            }
        }

        if (p.product_type === "Window" && removableSill === "No" && p.product_name.toLowerCase().includes("sliding")) {
            removableSill = "Yes";
        }

        const isZebra = i % 2 === 1;
        const textStyle = isZebra ? "DataTextZebra" : "DataText";
        const numberStyle = isZebra ? "DataNumberZebra" : "DataNumber";
        const currencyStyle = isZebra ? "DataCurrencyZebra" : "DataCurrency";
        const dateStyle = isZebra ? "DataDateZebra" : "DataDate";

        catalogRows.push({
            height: 22,
            cells: [
                { value: p.product_id, style: textStyle },
                { value: p.product_name, style: textStyle },
                { value: p.product_type, style: textStyle },
                { value: p.status, style: isActive ? "StatusActive" : "StatusDraft" },
                { value: priceNum, type: "Number", style: currencyStyle },
                { value: Number(minWidth), type: "Number", style: numberStyle },
                { value: Number(maxWidth), type: "Number", style: numberStyle },
                { value: Number(minHeight), type: "Number", style: numberStyle },
                { value: Number(maxHeight), type: "Number", style: numberStyle },
                { value: defaultFinish, style: textStyle },
                { value: defaultGlazing, style: textStyle },
                { value: components.length, type: "Number", style: numberStyle },
                { value: removableSill, style: removableSill === "Yes" ? "BadgeYes" : "BadgeNo" },
                { value: formatPstTimestamp(p.updated_at), style: dateStyle },
            ],
        });
    }

    const avgBasePrice = totalProducts > 0
        ? totalPriceSum / totalProducts
        : 0;
    const totalMaterials = rawMaterialsCount ?? 0;
    const activePct = totalProducts > 0 ? ((activeProducts / totalProducts) * 100).toFixed(1) : "0.0";
    const draftPct = totalProducts > 0 ? ((draftProducts / totalProducts) * 100).toFixed(1) : "0.0";

    const generatedPst = formatPstTimestamp(new Date());

    // -------------------------------------------------------------
    // Worksheet 1: Executive Catalog Health & KPIs
    // -------------------------------------------------------------
    const overviewRows: ExcelRow[] = [
        // Header Banner
        {
            height: 28,
            cells: [
                {
                    value: "GLASSFIT ARCHITECTURAL GLASS & ALUMINUM",
                    style: "BrandHeader",
                    mergeAcross: 5,
                },
            ],
        },
        {
            height: 20,
            cells: [
                {
                    value: "Master Product Catalog & Dimensional Inventory Specifications",
                    style: "BrandSubtitle",
                    mergeAcross: 5,
                },
            ],
        },
        {
            height: 18,
            cells: [
                { value: "Generated At:", style: "MetaLabel" },
                { value: `${generatedPst} PST (UTC+08:00)`, style: "MetaValue" },
                { value: "Generated By:", style: "MetaLabel" },
                { value: `${options.operatorName} (${options.operatorRole})`, style: "MetaValue" },
                { value: "Scope:", style: "MetaLabel" },
                { value: `Full Product Catalog (${totalProducts} Models)`, style: "MetaValue" },
            ],
        },
        { height: 12, cells: [] },

        // Section 1: KPI Cards
        {
            height: 24,
            cells: [
                {
                    value: "1. MASTER CATALOG KPI SNAPSHOT",
                    style: "SectionTitle",
                    mergeAcross: 5,
                },
            ],
        },
        {
            height: 18,
            cells: [
                { value: "TOTAL PRODUCTS", style: "KpiCardLabel" },
                { value: "ACTIVE / PUBLISHED", style: "KpiCardLabel" },
                { value: "DRAFT MODELS", style: "KpiCardLabel" },
                { value: "MEAN BASE PRICE", style: "KpiCardLabel" },
                { value: "MAPPED 3D PARTS", style: "KpiCardLabel" },
                { value: "RAW MATERIALS", style: "KpiCardLabel" },
            ],
        },
        {
            height: 28,
            cells: [
                { value: totalProducts, type: "Number", style: "KpiCardValue" },
                { value: activeProducts, type: "Number", style: "StatusActive" },
                { value: draftProducts, type: "Number", style: "StatusDraft" },
                { value: avgBasePrice, type: "Number", style: "DataCurrency" },
                { value: totalMappedComponents, type: "Number", style: "KpiCardValue" },
                { value: totalMaterials, type: "Number", style: "KpiCardValue" },
            ],
        },
        {
            height: 16,
            cells: [
                { value: "Defined models", style: "KpiCardNotes" },
                { value: `${activePct}% of catalog`, style: "KpiCardNotes" },
                { value: `${draftPct}% in setup`, style: "KpiCardNotes" },
                { value: "Mean base price", style: "KpiCardNotes" },
                { value: "3D components bound", style: "KpiCardNotes" },
                { value: "Profiles & glass stocks", style: "KpiCardNotes" },
            ],
        },
        { height: 16, cells: [] },

        // Section 2: Category Breakdown Table
        {
            height: 24,
            cells: [
                {
                    value: "2. PRODUCT CATEGORY DISTRIBUTION",
                    style: "SectionTitle",
                    mergeAcross: 5,
                },
            ],
        },
        {
            height: 22,
            cells: [
                { value: "Product Category", style: "TableHeaderCyan", mergeAcross: 1 },
                { value: "Configured Models", style: "TableHeaderCyan" },
                { value: "Catalog Share (%)", style: "TableHeaderCyan" },
                { value: "Status Overview", style: "TableHeader", mergeAcross: 1 },
            ],
        },
    ];

    for (const [catName, count] of Object.entries(categoryCounts)) {
        const sharePct = totalProducts > 0 ? ((count / totalProducts) * 100).toFixed(1) : "0.0";
        overviewRows.push({
            height: 20,
            cells: [
                { value: catName, style: "DataText", mergeAcross: 1 },
                { value: count, type: "Number", style: "DataNumber" },
                { value: `${sharePct}%`, style: "DataText" },
                { value: "Active in Product Catalog", style: "DataText", mergeAcross: 1 },
            ],
        });
    }

    // -------------------------------------------------------------
    // Worksheet 2: Master Product Specifications Table
    // -------------------------------------------------------------
    const catalogHeaderRow: ExcelRow = {
        height: 26,
        cells: [
            { value: "Product ID", style: "TableHeader" },
            { value: "Product Name", style: "TableHeader" },
            { value: "Category", style: "TableHeader" },
            { value: "Publishing Status", style: "TableHeaderCyan" },
            { value: "Base Price", style: "TableHeader" },
            { value: "Min W (mm)", style: "TableHeader" },
            { value: "Max W (mm)", style: "TableHeader" },
            { value: "Min H (mm)", style: "TableHeader" },
            { value: "Max H (mm)", style: "TableHeader" },
            { value: "Default Finish", style: "TableHeader" },
            { value: "Default Glazing", style: "TableHeader" },
            { value: "Components", style: "TableHeader" },
            { value: "Flush Sill", style: "TableHeader" },
            { value: "Last Updated (PST)", style: "TableHeader" },
        ],
    };

    const overviewSheet: import("./excelFormatter").ExcelWorksheet = {
        name: "Catalog Overview & KPIs",
        columns: [
            { width: 130 },
            { width: 130 },
            { width: 110 },
            { width: 130 },
            { width: 120 },
            { width: 120 },
        ],
        rows: overviewRows,
    };

    const catalogSheet: import("./excelFormatter").ExcelWorksheet = {
        name: "Master Product Catalog",
        columns: [
            { width: 230 },
            { width: 190 },
            { width: 95 },
            { width: 110 },
            { width: 110 },
            { width: 75 },
            { width: 75 },
            { width: 75 },
            { width: 75 },
            { width: 140 },
            { width: 150 },
            { width: 85 },
            { width: 75 },
            { width: 130 },
        ],
        rows: [catalogHeaderRow, ...catalogRows],
    };

    return buildExcelWorkbook([overviewSheet, catalogSheet]);
}


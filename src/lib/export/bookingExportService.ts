/**
 * GlassFit Consultation Booking & Pipeline Business Intelligence Export Service (IMP-MS32)
 *
 * Traceability: PRD-F14, PRD-F10, PRD-F12, PRD-F13; SDD-C9, SDD-C10; ERD-E13, ERD-E15, ERD-E16; QAD-TC47
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


export interface BookingExportOptions {
    operatorName: string;
    operatorRole: string;
}

interface RawProfile {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    contact_number?: string | null;
}

interface RawQuotationItem {
    item_name?: string | null;
    quantity?: number | null;
    unit_price?: number | null;
    estimated_subtotal?: number | null;
    pricing_details?: Record<string, unknown> | null;
}

interface RawQuotationEstimate {
    quotation_id: string;
    quotation_number: string;
    total_estimated_amount: number;
    negotiated_amount: number | null;
    admin_labor_charge: number | null;
    quotation_items?: RawQuotationItem[] | null;
}

interface RawSignedBookingLink {
    link_id: string;
    token_hash: string;
    quotation?: RawQuotationEstimate | RawQuotationEstimate[] | null;
    quotation_estimates?: RawQuotationEstimate | RawQuotationEstimate[] | null;
}

interface RawBookingRequest {
    booking_request_id: string;
    selected_platform: string;
    status: string;
    created_at: string;
    customer?: RawProfile | RawProfile[] | null;
    profiles?: RawProfile | RawProfile[] | null;
    booking_link?: RawSignedBookingLink | RawSignedBookingLink[] | null;
    signed_booking_links?: RawSignedBookingLink | RawSignedBookingLink[] | null;
}

/**
 * Compiles the GlassFit-connected Booking Records and Business Intelligence CSV.
 */
export async function generateBookingsCsv(options: BookingExportOptions): Promise<string> {
    const supabase = createSupabaseServiceClient();

    const { data: rawBookings, error } = await supabase
        .from("booking_requests")
        .select(`
            booking_request_id,
            selected_platform,
            status,
            created_at,
            customer:profiles!booking_requests_profile_fk (
                first_name,
                last_name,
                email,
                contact_number
            ),
            booking_link:signed_booking_links!booking_requests_link_fk (
                link_id,
                token_hash,
                quotation:quotation_estimates!signed_booking_links_quotation_fk (
                    quotation_id,
                    quotation_number,
                    total_estimated_amount,
                    negotiated_amount,
                    admin_labor_charge,
                    quotation_items (
                        item_name,
                        quantity,
                        unit_price,
                        estimated_subtotal,
                        pricing_details
                    )
                )
            )
        `)
        .order("created_at", { ascending: false });

    if (error) {
        throw new Error(`Failed to query booking records: ${error.message}`);
    }

    const bookings = (rawBookings ?? []) as unknown as RawBookingRequest[];

    // Compute Executive KPI Snapshot
    const totalConsultations = bookings.length;
    let pendingCount = 0;
    let ongoingCount = 0;
    let doneCount = 0;
    let grossEstimatedValue = 0;
    let finalNegotiatedValue = 0;
    let messengerCount = 0;
    let viberCount = 0;
    let structuralWaiverCount = 0;
    let flushSillCount = 0;

    interface ProcessedBookingRow {
        refCode: string;
        quoteNumber: string;
        dateSubmittedPst: string;
        customerName: string;
        customerEmail: string;
        customerPhone: string;
        status: string;
        channel: string;
        estimatedAmount: string;
        effectiveTotal: string;
        adminLabor: string;
        itemsCount: number;
        configurationSummary: string;
        structuralWaiver: string;
        sillRemoved: string;
    }

    const processedRows: ProcessedBookingRow[] = [];

    for (let i = 0; i < bookings.length; i++) {
        const b = bookings[i];
        const status = b.status || "Pending";
        if (status === "Pending") pendingCount++;
        else if (status === "Ongoing") ongoingCount++;
        else if (status === "Done") doneCount++;

        const platform = b.selected_platform || "Messenger";
        if (platform === "Messenger") messengerCount++;
        else if (platform === "Viber") viberCount++;

        const rawProfile = b.customer ?? b.profiles;
        const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
        const customerName = profile
            ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Guest Customer"
            : "Guest Customer";
        const customerEmail = profile?.email || "N/A";
        const customerPhone = profile?.contact_number || "N/A";

        const rawLink = b.booking_link ?? b.signed_booking_links;
        const link = Array.isArray(rawLink) ? rawLink[0] : rawLink;
        const rawQuote = link?.quotation ?? link?.quotation_estimates;
        const quote = Array.isArray(rawQuote)
            ? rawQuote[0]
            : rawQuote;

        const estAmountNum = Number(quote?.total_estimated_amount ?? 0);
        const effAmountNum = quote?.negotiated_amount !== null && quote?.negotiated_amount !== undefined
            ? Number(quote.negotiated_amount)
            : estAmountNum;
        const laborAmountNum = Number(quote?.admin_labor_charge ?? 0);


        grossEstimatedValue += estAmountNum;
        finalNegotiatedValue += effAmountNum;

        const rawItems = Array.isArray(quote?.quotation_items) ? quote.quotation_items : [];

        // Parse items and waiver / sill info
        const summaries: string[] = [];
        let hasWaiver = false;
        let hasSillRemoved = false;

        for (const item of rawItems) {
            const details = item.pricing_details as Record<string, unknown> | null | undefined;
            if (details) {
                if (details.structural_waiver) hasWaiver = true;
                if (details.has_sill === false) hasSillRemoved = true;
            }
            if (item.item_name) {
                summaries.push(item.item_name);
            }
        }

        if (hasWaiver) structuralWaiverCount++;
        if (hasSillRemoved) flushSillCount++;

        const quoteNo = quote?.quotation_number || `Q-REF-${b.booking_request_id.slice(0, 8).toUpperCase()}`;
        const refIndex = bookings.length - i;
        const paddedIndex = String(refIndex).padStart(5, "0");
        const refCode = `BR-${paddedIndex}`;

        processedRows.push({
            refCode,
            quoteNumber: quoteNo,
            dateSubmittedPst: formatPstTimestamp(b.created_at),
            customerName,
            customerEmail,
            customerPhone,
            status,
            channel: platform,
            estimatedAmount: estAmountNum.toFixed(2),
            effectiveTotal: effAmountNum.toFixed(2),
            adminLabor: laborAmountNum.toFixed(2),
            itemsCount: rawItems.length > 0 ? rawItems.length : 1,
            configurationSummary: summaries.length > 0 ? summaries.join("; ") : "Custom Architectural Fixture",
            structuralWaiver: hasWaiver ? "Yes" : "No",
            sillRemoved: hasSillRemoved ? "Yes" : "No",
        });
    }

    const conversionRate = totalConsultations > 0
        ? ((doneCount / totalConsultations) * 100).toFixed(2)
        : "0.00";
    const pendingPct = totalConsultations > 0
        ? ((pendingCount / totalConsultations) * 100).toFixed(1)
        : "0.0";
    const ongoingPct = totalConsultations > 0
        ? ((ongoingCount / totalConsultations) * 100).toFixed(1)
        : "0.0";
    const donePct = totalConsultations > 0
        ? ((doneCount / totalConsultations) * 100).toFixed(1)
        : "0.0";

    const avgDealSize = totalConsultations > 0
        ? (finalNegotiatedValue / totalConsultations).toFixed(2)
        : "0.00";

    const messengerShare = totalConsultations > 0
        ? ((messengerCount / totalConsultations) * 100).toFixed(1)
        : "0.0";
    const viberShare = totalConsultations > 0
        ? ((viberCount / totalConsultations) * 100).toFixed(1)
        : "0.0";

    const primaryChannelText = messengerCount >= viberCount
        ? `Messenger (${messengerShare}%)`
        : `Viber (${viberShare}%)`;
    const channelNotes = `${messengerCount} via Messenger / ${viberCount} via Viber`;

    // Generate visual distribution progress bars
    const statusVisualBar = generateMultiSegmentBar([
        { count: doneCount, char: "█" },
        { count: ongoingCount, char: "▒" },
        { count: pendingCount, char: "░" },
    ], 24);

    const channelVisualBar = generateMultiSegmentBar([
        { count: messengerCount, char: "█" },
        { count: viberCount, char: "▒" },
    ], 24);

    const generatedPst = formatPstTimestamp(new Date());

    // Build CSV sections
    const lines: string[] = [
        UTF8_BOM + formatCsvComment("=============================================================================="),
        formatCsvComment("  GLASSFIT ARCHITECTURAL GLASS & ALUMINUM - BUSINESS INTELLIGENCE REPORT      "),
        formatCsvComment("  Web-Based Client-Space Visualization & Fenestration Estimation System        "),
        formatCsvComment("=============================================================================="),
        formatCsvComment(`Report Title:   Consultation Booking & Quotation Pipeline Analysis`),
        formatCsvComment(`Generated At:   ${generatedPst} PST (UTC+08:00)`),
        formatCsvComment(`Generated By:   ${options.operatorName} (${options.operatorRole})`),
        formatCsvComment(`System Platform: GlassFit Capstone Production Platform (PUP CCIS)`),
        formatCsvComment(`Scope:          All Historical Consultations (${totalConsultations} Total Records)`),
        formatCsvComment("=============================================================================="),
        formatCsvComment(""),
        formatCsvComment("--- 1. EXECUTIVE VISUAL TELEMETRY & PIPELINE CHARTS ---"),
        formatCsvComment("Chart Name,Visual Distribution Bar,Breakdown / Proportions"),
        formatCsvComment(`Pipeline Status Distribution,[${statusVisualBar}],Done: ${donePct}% (█) | Ongoing: ${ongoingPct}% (▒) | Pending: ${pendingPct}% (░)`),
        formatCsvComment(`Customer Intake Channels,[${channelVisualBar}],Messenger: ${messengerShare}% (█) | Viber: ${viberShare}% (▒)`),
        formatCsvComment(""),
        formatCsvComment("--- 2. EXECUTIVE KPI FINANCIAL & OPERATIONAL SNAPSHOT ---"),
        formatCsvComment("Metric Description,Raw Value,Formatted Value (PHP),Analysis / Context"),
        formatCsvComment(`Total Consultation Inquiries,${totalConsultations},${totalConsultations} Consultations,Total booking consultation requests received`),
        formatCsvComment(`Pending Triage Inquiries,${pendingCount},${pendingCount} Requests,Awaiting administrative inspection and confirmation`),
        formatCsvComment(`Ongoing Client Discussions,${ongoingCount},${ongoingCount} Consultations,In active estimation or measurement refinement`),
        formatCsvComment(`Completed / Finalized Bookings,${doneCount},${doneCount} Approved Deals,Successfully transitioned to finalized job order`),
        formatCsvComment(`Pipeline Conversion Rate,${conversionRate}%,${conversionRate}% Done,Percentage of total consultations completed`),
        formatCsvComment(`Gross Estimated Pipeline Value,${grossEstimatedValue.toFixed(2)},${formatPhpCurrency(grossEstimatedValue)},Aggregate initial estimation value`),
        formatCsvComment(`Final Negotiated Pipeline Value,${finalNegotiatedValue.toFixed(2)},${formatPhpCurrency(finalNegotiatedValue)},Effective realizable commercial pipeline value`),
        formatCsvComment(`Average Quotation Deal Size,${avgDealSize},${formatPhpCurrency(Number(avgDealSize))},Mean revenue per consultation project`),
        formatCsvComment(`Primary Customer Intake Channel,${primaryChannelText},N/A,${channelNotes}`),
        formatCsvComment(`Structural Waivers Acknowledged,${structuralWaiverCount},${structuralWaiverCount} Fixtures,High-aspect or wide-span window compliance waivers`),
        formatCsvComment(`Flush Sill-Less Configurations,${flushSillCount},${flushSillCount} Openings,Barrier-free patio and sliding configurations`),
        formatCsvComment(""),
        formatCsvComment("--- 3. DETAILED CONSULTATION & BOOKING TRANSACTIONS ---"),
        formatCsvRow([
            "Booking Reference",
            "Quotation Number",
            "Date Submitted (PST)",
            "Customer Full Name",
            "Customer Email",
            "Customer Contact Number",
            "Pipeline Status",
            "Intake Channel",
            "Estimated Amount (PHP)",
            "Effective Total (PHP)",
            "Admin Labor Charge (PHP)",
            "Item Count",
            "Product Configuration Summary",
            "Structural Waiver",
            "Flush Sill Removed",
        ]),
    ];

    for (const r of processedRows) {
        lines.push(
            formatCsvRow([
                r.refCode,
                r.quoteNumber,
                r.dateSubmittedPst,
                r.customerName,
                r.customerEmail,
                r.customerPhone,
                r.status,
                r.channel,
                r.estimatedAmount,
                r.effectiveTotal,
                r.adminLabor,
                r.itemsCount,
                r.configurationSummary,
                r.structuralWaiver,
                r.sillRemoved,
            ])
        );
    }

    return lines.join("\r\n");
}

/**
 * Compiles a rich, professionally styled Microsoft Excel workbook (SpreadsheetML)
 * matching the GlassFit design system with multiple tabs, KPI cards, currency formatting,
 * and status pill badges.
 */
export async function generateBookingsExcel(options: BookingExportOptions): Promise<string> {
    const supabase = createSupabaseServiceClient();

    const { data: rawBookings, error } = await supabase
        .from("booking_requests")
        .select(`
            booking_request_id,
            selected_platform,
            status,
            created_at,
            customer:profiles!booking_requests_profile_fk (
                first_name,
                last_name,
                email,
                contact_number
            ),
            booking_link:signed_booking_links!booking_requests_link_fk (
                link_id,
                token_hash,
                quotation:quotation_estimates!signed_booking_links_quotation_fk (
                    quotation_id,
                    quotation_number,
                    total_estimated_amount,
                    negotiated_amount,
                    admin_labor_charge,
                    quotation_items (
                        item_name,
                        quantity,
                        unit_price,
                        estimated_subtotal,
                        pricing_details
                    )
                )
            )
        `)
        .order("created_at", { ascending: false });

    if (error) {
        throw new Error(`Failed to query booking records: ${error.message}`);
    }

    const bookings = (rawBookings ?? []) as unknown as RawBookingRequest[];

    const totalConsultations = bookings.length;
    let pendingCount = 0;
    let ongoingCount = 0;
    let doneCount = 0;
    let grossEstimatedValue = 0;
    let finalNegotiatedValue = 0;
    let messengerCount = 0;
    let viberCount = 0;
    let structuralWaiverCount = 0;
    let flushSillCount = 0;

    const { buildExcelWorkbook } = await import("./excelFormatter");
    type ExcelRow = import("./excelFormatter").ExcelRow;

    const ledgerRows: ExcelRow[] = [];

    for (let i = 0; i < bookings.length; i++) {
        const b = bookings[i];
        const status = b.status || "Pending";
        if (status === "Pending") pendingCount++;
        else if (status === "Ongoing") ongoingCount++;
        else if (status === "Done") doneCount++;

        const platform = b.selected_platform || "Messenger";
        if (platform === "Messenger") messengerCount++;
        else if (platform === "Viber") viberCount++;

        const rawProfile = b.customer ?? b.profiles;
        const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
        const customerName = profile
            ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Guest Customer"
            : "Guest Customer";
        const customerEmail = profile?.email || "N/A";
        const customerPhone = profile?.contact_number || "N/A";

        const rawLink = b.booking_link ?? b.signed_booking_links;
        const link = Array.isArray(rawLink) ? rawLink[0] : rawLink;
        const rawQuote = link?.quotation ?? link?.quotation_estimates;
        const quote = Array.isArray(rawQuote)
            ? rawQuote[0]
            : rawQuote;

        const estAmountNum = Number(quote?.total_estimated_amount ?? 0);
        const effAmountNum = quote?.negotiated_amount !== null && quote?.negotiated_amount !== undefined
            ? Number(quote.negotiated_amount)
            : estAmountNum;
        const laborAmountNum = Number(quote?.admin_labor_charge ?? 0);

        grossEstimatedValue += estAmountNum;
        finalNegotiatedValue += effAmountNum;

        const rawItems = Array.isArray(quote?.quotation_items) ? quote.quotation_items : [];

        const summaries: string[] = [];
        let hasWaiver = false;
        let hasSillRemoved = false;

        for (const item of rawItems) {
            const details = item.pricing_details as Record<string, unknown> | null | undefined;
            if (details) {
                if (details.structural_waiver) hasWaiver = true;
                if (details.has_sill === false) hasSillRemoved = true;
            }
            if (item.item_name) {
                summaries.push(item.item_name);
            }
        }

        if (hasWaiver) structuralWaiverCount++;
        if (hasSillRemoved) flushSillCount++;

        const quoteNo = quote?.quotation_number || `Q-REF-${b.booking_request_id.slice(0, 8).toUpperCase()}`;
        const refIndex = bookings.length - i;
        const paddedIndex = String(refIndex).padStart(5, "0");
        const refCode = `BR-${paddedIndex}`;

        const isZebra = i % 2 === 1;
        const textStyle = isZebra ? "DataTextZebra" : "DataText";
        const numberStyle = isZebra ? "DataNumberZebra" : "DataNumber";
        const currencyStyle = isZebra ? "DataCurrencyZebra" : "DataCurrency";
        const dateStyle = isZebra ? "DataDateZebra" : "DataDate";

        let statusStyle: import("./excelFormatter").ExcelCellStyle = "StatusPending";
        if (status === "Done") statusStyle = "StatusDone";
        else if (status === "Ongoing") statusStyle = "StatusOngoing";

        ledgerRows.push({
            height: 22,
            cells: [
                { value: refCode, style: textStyle },
                { value: quoteNo, style: textStyle },
                { value: formatPstTimestamp(b.created_at), style: dateStyle },
                { value: customerName, style: textStyle },
                { value: customerEmail, style: textStyle },
                { value: customerPhone, style: textStyle },
                { value: status, style: statusStyle },
                { value: platform, style: textStyle },
                { value: estAmountNum, type: "Number", style: currencyStyle },
                { value: effAmountNum, type: "Number", style: currencyStyle },
                { value: laborAmountNum, type: "Number", style: currencyStyle },
                { value: rawItems.length > 0 ? rawItems.length : 1, type: "Number", style: numberStyle },
                { value: summaries.length > 0 ? summaries.join("; ") : "Custom Architectural Fixture", style: textStyle },
                { value: hasWaiver ? "Yes" : "No", style: hasWaiver ? "BadgeYes" : "BadgeNo" },
                { value: hasSillRemoved ? "Yes" : "No", style: hasSillRemoved ? "BadgeYes" : "BadgeNo" },
            ],
        });
    }

    const conversionRate = totalConsultations > 0
        ? ((doneCount / totalConsultations) * 100).toFixed(1)
        : "0.0";
    const avgDealSize = totalConsultations > 0
        ? finalNegotiatedValue / totalConsultations
        : 0;

    const messengerShare = totalConsultations > 0
        ? ((messengerCount / totalConsultations) * 100).toFixed(1)
        : "0.0";
    const viberShare = totalConsultations > 0
        ? ((viberCount / totalConsultations) * 100).toFixed(1)
        : "0.0";

    const generatedPst = formatPstTimestamp(new Date());

    // -------------------------------------------------------------
    // Worksheet 1: Executive Dashboard & KPI Summary
    // -------------------------------------------------------------
    const dashboardRows: ExcelRow[] = [
        // Brand Header Banner
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
                    value: "Executive Business Intelligence & Consultation Pipeline Analytics",
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
                { value: "Platform Scope:", style: "MetaLabel" },
                { value: `All Consultations (${totalConsultations} Total)`, style: "MetaValue" },
            ],
        },
        { height: 12, cells: [] },

        // Section 1: KPI Cards
        {
            height: 24,
            cells: [
                {
                    value: "1. EXECUTIVE KPI SUMMARY",
                    style: "SectionTitle",
                    mergeAcross: 5,
                },
            ],
        },
        {
            height: 18,
            cells: [
                { value: "FINAL REALIZED PIPELINE", style: "KpiCardLabel" },
                { value: "INITIAL ESTIMATED VALUE", style: "KpiCardLabel" },
                { value: "TOTAL CONSULTATIONS", style: "KpiCardLabel" },
                { value: "CONVERSION RATE", style: "KpiCardLabel" },
                { value: "AVERAGE DEAL SIZE", style: "KpiCardLabel" },
                { value: "WAIVERS / FLUSH SILL", style: "KpiCardLabel" },
            ],
        },
        {
            height: 28,
            cells: [
                { value: finalNegotiatedValue, type: "Number", style: "DataCurrency" },
                { value: grossEstimatedValue, type: "Number", style: "DataCurrency" },
                { value: totalConsultations, type: "Number", style: "KpiCardValue" },
                { value: `${conversionRate}%`, style: "KpiCardValue" },
                { value: avgDealSize, type: "Number", style: "DataCurrency" },
                { value: structuralWaiverCount + flushSillCount, type: "Number", style: "KpiCardValue" },
            ],
        },
        {
            height: 16,
            cells: [
                { value: "Realizable pipeline", style: "KpiCardNotes" },
                { value: "Baseline estimation", style: "KpiCardNotes" },
                { value: "Total logged inquiries", style: "KpiCardNotes" },
                { value: "Transitioned to Done", style: "KpiCardNotes" },
                { value: "Mean quotation value", style: "KpiCardNotes" },
                { value: "Custom engineering items", style: "KpiCardNotes" },
            ],
        },
        { height: 16, cells: [] },

        // Section 2: Pipeline Status & Channels
        {
            height: 24,
            cells: [
                {
                    value: "2. CONSULTATION PIPELINE & INTAKE CHANNEL BREAKDOWN",
                    style: "SectionTitle",
                    mergeAcross: 5,
                },
            ],
        },
        {
            height: 22,
            cells: [
                { value: "Pipeline Status", style: "TableHeaderCyan" },
                { value: "Inquiry Count", style: "TableHeaderCyan" },
                { value: "Share (%)", style: "TableHeaderCyan" },
                { value: "Intake Channel", style: "TableHeader" },
                { value: "Inquiries", style: "TableHeader" },
                { value: "Share (%)", style: "TableHeader" },
            ],
        },
        {
            height: 20,
            cells: [
                { value: "Completed / Approved", style: "StatusDone" },
                { value: doneCount, type: "Number", style: "DataNumber" },
                { value: totalConsultations > 0 ? `${((doneCount / totalConsultations) * 100).toFixed(1)}%` : "0%", style: "DataText" },
                { value: "Facebook Messenger", style: "DataText" },
                { value: messengerCount, type: "Number", style: "DataNumber" },
                { value: `${messengerShare}%`, style: "DataText" },
            ],
        },
        {
            height: 20,
            cells: [
                { value: "Ongoing Discussion", style: "StatusOngoing" },
                { value: ongoingCount, type: "Number", style: "DataNumber" },
                { value: totalConsultations > 0 ? `${((ongoingCount / totalConsultations) * 100).toFixed(1)}%` : "0%", style: "DataText" },
                { value: "Rakuten Viber", style: "DataText" },
                { value: viberCount, type: "Number", style: "DataNumber" },
                { value: `${viberShare}%`, style: "DataText" },
            ],
        },
        {
            height: 20,
            cells: [
                { value: "Pending Triage", style: "StatusPending" },
                { value: pendingCount, type: "Number", style: "DataNumber" },
                { value: totalConsultations > 0 ? `${((pendingCount / totalConsultations) * 100).toFixed(1)}%` : "0%", style: "DataText" },
                { value: "Total Inquiries", style: "MetaLabel" },
                { value: totalConsultations, type: "Number", style: "DataNumber" },
                { value: "100.0%", style: "DataText" },
            ],
        },
        { height: 16, cells: [] },

        // Section 3: Engineering Guardrails
        {
            height: 24,
            cells: [
                {
                    value: "3. STRUCTURAL COMPLIANCE & SPECIAL CONFIGURATIONS",
                    style: "SectionTitle",
                    mergeAcross: 5,
                },
            ],
        },
        {
            height: 20,
            cells: [
                { value: "Configuration Type", style: "TableHeader", mergeAcross: 2 },
                { value: "Count", style: "TableHeader" },
                { value: "Compliance Notes", style: "TableHeader", mergeAcross: 1 },
            ],
        },
        {
            height: 20,
            cells: [
                { value: "Structural Waivers Acknowledged", style: "DataText", mergeAcross: 2 },
                { value: structuralWaiverCount, type: "Number", style: "DataNumber" },
                { value: "High-aspect or wide-span window waivers acknowledged by client", style: "DataText", mergeAcross: 1 },
            ],
        },
        {
            height: 20,
            cells: [
                { value: "Flush Sill-Less Configurations", style: "DataText", mergeAcross: 2 },
                { value: flushSillCount, type: "Number", style: "DataNumber" },
                { value: "Barrier-free patio and door configurations with sill track removed", style: "DataText", mergeAcross: 1 },
            ],
        },
    ];

    // -------------------------------------------------------------
    // Worksheet 2: Detailed Consultation Ledger
    // -------------------------------------------------------------
    const ledgerHeaderRow: ExcelRow = {
        height: 26,
        cells: [
            { value: "Booking Ref", style: "TableHeader" },
            { value: "Quotation No.", style: "TableHeader" },
            { value: "Date Submitted (PST)", style: "TableHeader" },
            { value: "Customer Name", style: "TableHeader" },
            { value: "Customer Email", style: "TableHeader" },
            { value: "Contact Number", style: "TableHeader" },
            { value: "Pipeline Status", style: "TableHeaderCyan" },
            { value: "Intake Channel", style: "TableHeader" },
            { value: "Estimated Total", style: "TableHeader" },
            { value: "Effective Total", style: "TableHeader" },
            { value: "Labor Charge", style: "TableHeader" },
            { value: "Items", style: "TableHeader" },
            { value: "Product Configuration Details", style: "TableHeader" },
            { value: "Waiver", style: "TableHeader" },
            { value: "Flush Sill", style: "TableHeader" },
        ],
    };

    const dashboardSheet: import("./excelFormatter").ExcelWorksheet = {
        name: "Executive Dashboard",
        columns: [
            { width: 140 },
            { width: 120 },
            { width: 110 },
            { width: 140 },
            { width: 120 },
            { width: 130 },
        ],
        rows: dashboardRows,
    };

    const ledgerSheet: import("./excelFormatter").ExcelWorksheet = {
        name: "Consultation Ledger",
        columns: [
            { width: 90 },
            { width: 100 },
            { width: 130 },
            { width: 140 },
            { width: 160 },
            { width: 110 },
            { width: 95 },
            { width: 90 },
            { width: 110 },
            { width: 110 },
            { width: 90 },
            { width: 55 },
            { width: 260 },
            { width: 70 },
            { width: 70 },
        ],
        rows: [ledgerHeaderRow, ...ledgerRows],
    };

    return buildExcelWorkbook([dashboardSheet, ledgerSheet]);
}



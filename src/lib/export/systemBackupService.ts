/**
 * GlassFit Comprehensive Enterprise System Backup Snapshot Engine (IMP-MS32)
 *
 * Traceability: PRD-F14, SDD-C9, SDD-C10, ERD-E1 through ERD-E18, BAN-AUTH-04, QAD-TC14, QAD-TC47
 */

import { createHash } from "node:crypto";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export interface SystemBackupEnvelope {
    glassfit_backup_version: string;
    generated_at: string;
    authorizing_owner_id: string;
    checksum_sha256: string;
    record_counts: Record<string, number>;
    data: {
        preferences: unknown[];
        catalog: {
            products: unknown[];
            product_templates: unknown[];
            product_parameters: unknown[];
        };
        components: {
            product_components: unknown[];
            raw_materials: unknown[];
        };
        rules: {
            structural_rules: unknown[];
        };
        consultations: {
            booking_requests: unknown[];
            signed_booking_links: unknown[];
        };
        quotations: {
            quotation_estimates: unknown[];
            quotation_items: unknown[];
        };
        identity_audit: {
            profiles: unknown[];
            admin_email_change_events: unknown[];
        };
        asset_manifest: {
            final_images: string[];
            quotation_pdfs: string[];
            product_models: string[];
        };
    };
}

/**
 * Compiles a deterministic JSON system backup snapshot of the tenant dataset.
 * Automatically redacts private authentication tokens and records the backup audit event.
 */
export async function compileSystemBackup(authorizingOwnerId: string): Promise<SystemBackupEnvelope> {
    const supabase = createSupabaseServiceClient();

    // 1. Concurrently fetch all entity partitions
    const [
        preferencesRes,
        productsRes,
        templatesRes,
        parametersRes,
        componentsRes,
        materialsRes,
        rulesRes,
        bookingsRes,
        linksRes,
        quotesRes,
        itemsRes,
        profilesRes,
        emailEventsRes,
        snapshotsRes,
        assetsRes,
    ] = await Promise.all([
        supabase.from("system_preferences").select("*"),
        supabase.from("products").select("*"),
        supabase.from("product_templates").select("*"),
        supabase.from("product_parameters").select("*"),
        supabase.from("product_components").select("*"),
        supabase.from("raw_materials").select("*"),
        supabase.from("structural_rules").select("*"),
        supabase.from("booking_requests").select("*"),
        supabase.from("signed_booking_links").select("*"),
        supabase.from("quotation_estimates").select("*"),
        supabase.from("quotation_items").select("*"),
        supabase.from("profiles").select("profile_id, first_name, last_name, email, contact_number, account_type, status, created_at, updated_at"),
        supabase.from("admin_email_change_events").select("event_id, target_profile_id, requested_by_id, previous_email, proposed_email, status, delivery_status, requested_at, reviewed_at, updated_at"),
        supabase.from("visualization_snapshots").select("snapshot_id, final_image_r2_key"),
        supabase.from("product_assets").select("asset_id, asset_type, asset_url"),
    ]);

    // Check for critical query errors
    if (productsRes.error) throw new Error(`Failed to query products: ${productsRes.error.message}`);
    if (quotesRes.error) throw new Error(`Failed to query quotations: ${quotesRes.error.message}`);
    if (bookingsRes.error) throw new Error(`Failed to query bookings: ${bookingsRes.error.message}`);

    const preferences = preferencesRes.data ?? [];
    const products = productsRes.data ?? [];
    const templates = templatesRes.data ?? [];
    const parameters = parametersRes.data ?? [];
    const components = componentsRes.data ?? [];
    const materials = materialsRes.data ?? [];
    const rules = rulesRes.data ?? [];
    const bookings = bookingsRes.data ?? [];
    const links = linksRes.data ?? [];
    const quotes = quotesRes.data ?? [];
    const items = itemsRes.data ?? [];
    const profiles = profilesRes.data ?? [];
    const emailEvents = emailEventsRes.data ?? [];
    const snapshots = snapshotsRes.data ?? [];
    const assets = assetsRes.data ?? [];

    // Compile R2 asset manifest
    const finalImageKeys = Array.from(
        new Set(
            snapshots
                .map((s) => s.final_image_r2_key)
                .filter((k): k is string => typeof k === "string" && k.length > 0)
        )
    );

    const quotationPdfKeys = Array.from(
        new Set(
            quotes
                .map((q) => q.pdf_r2_object_key)
                .filter((k): k is string => typeof k === "string" && k.length > 0)
        )
    );

    const productModelKeys = Array.from(
        new Set(
            assets
                .map((a) => a.asset_url)
                .filter((k): k is string => typeof k === "string" && k.length > 0)
        )
    );

    const recordCounts: Record<string, number> = {
        products: products.length,
        product_templates: templates.length,
        product_parameters: parameters.length,
        product_components: components.length,
        raw_materials: materials.length,
        structural_rules: rules.length,
        booking_requests: bookings.length,
        signed_booking_links: links.length,
        quotation_estimates: quotes.length,
        quotation_items: items.length,
        profiles: profiles.length,
    };

    const dataPayload = {
        preferences,
        catalog: {
            products,
            product_templates: templates,
            product_parameters: parameters,
        },
        components: {
            product_components: components,
            raw_materials: materials,
        },
        rules: {
            structural_rules: rules,
        },
        consultations: {
            booking_requests: bookings,
            signed_booking_links: links,
        },
        quotations: {
            quotation_estimates: quotes,
            quotation_items: items,
        },
        identity_audit: {
            profiles,
            admin_email_change_events: emailEvents,
        },
        asset_manifest: {
            final_images: finalImageKeys,
            quotation_pdfs: quotationPdfKeys,
            product_models: productModelKeys,
        },
    };

    // Calculate SHA-256 checksum over serialized data payload
    const serializedPayload = JSON.stringify(dataPayload);
    const checksumSha256 = createHash("sha256").update(serializedPayload).digest("hex");

    // Atomically record system backup in database
    const { error: rpcError } = await supabase.rpc("record_system_backup", {
        p_admin_id: authorizingOwnerId,
    });

    if (rpcError) {
        console.warn("[compileSystemBackup] Warning recording system backup audit:", rpcError.message);
    }

    return {
        glassfit_backup_version: "1.0.0",
        generated_at: new Date().toISOString(),
        authorizing_owner_id: authorizingOwnerId,
        checksum_sha256: checksumSha256,
        record_counts: recordCounts,
        data: dataPayload,
    };
}

"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/admin";
import { S3Client, PutObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { revalidatePath } from "next/cache";
import { getR2AssetUrl } from "@/lib/r2";

// Assuming these environment variables are set in .env.local
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID || "",
        secretAccessKey: R2_SECRET_ACCESS_KEY || "",
    },
    forcePathStyle: true,
});

export type AssetType = 
    | "Thumbnail" 
    | "Catalog Image" 
    | "Catalog 3D Preview" 
    | "Whole Model"
    | "Component Model" 
    | "Texture" 
    | "Material Map" 
    | "Variation Preview" 
    | "Other";

export async function generatePresignedUrl(
    productId: string,
    assetType: AssetType,
    fileName: string,
    mimeType: string,
    componentId?: string
) {
    await requirePermission("manage_products");

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
        throw new Error("R2 environment variables are not configured.");
    }

    // Generate a secure UUID for the asset
    const assetId = crypto.randomUUID();
    
    // Extract extension
    const extMatch = fileName.match(/\.([^.]+)$/);
    const ext = extMatch ? `.${extMatch[1]}` : "";
    
    // Versioned key as recommended
    let objectKey = "";
    if (componentId) {
        objectKey = `products/${productId}/components/${componentId}/${assetId}${ext}`;
    } else {
        objectKey = `products/${productId}/catalog/${assetId}${ext}`;
    }

    const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: objectKey,
        ContentType: mimeType,
    });

    // URL expires in 15 minutes
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    return {
        uploadUrl,
        assetId,
        objectKey
    };
}

export async function confirmAssetUpload(
    productId: string,
    assetId: string,
    objectKey: string,
    assetType: AssetType,
    fileName: string,
    mimeType: string,
    byteSize: number,
    componentId?: string
) {
    const adminCtx = await requirePermission("manage_products");
    const supabase = await createSupabaseServerClient();

    // The index ensures only one primary asset per type exists
    // We must deactivate previous primary assets of the same type (and component if applicable)
    
    let deactivateQuery = supabase
        .from("product_assets")
        .update({ status: "Inactive", is_primary: false })
        .eq("product_id", productId)
        .eq("asset_type", assetType)
        .eq("status", "Active");

    if (componentId) {
        deactivateQuery = deactivateQuery.eq("component_id", componentId);
    } else {
        deactivateQuery = deactivateQuery.is("component_id", null);
    }

    await deactivateQuery;

    let templateId = null;
    if (componentId) {
        const { data: comp } = await supabase
            .from("product_components")
            .select("template_id")
            .eq("component_id", componentId)
            .single();
        if (comp) templateId = comp.template_id;
    }

    // Now insert the new active asset
    const { data, error } = await supabase
        .from("product_assets")
        .insert({
            asset_id: assetId,
            product_id: productId,
            template_id: templateId,
            component_id: componentId || null,
            created_by: adminCtx.profileId,
            updated_by: adminCtx.profileId,
            asset_type: assetType,
            r2_object_key: objectKey,
            file_name: fileName,
            mime_type: mimeType,
            byte_size: byteSize,
            is_primary: componentId ? false : true,
            status: "Active",
        })
        .select()
        .single();

    if (error) {
        console.error("Failed to confirm asset upload:", error);
        throw new Error(error.message);
    }

    if (componentId) {
        const publicUrl = getR2AssetUrl(objectKey);
        if (publicUrl) {
            await supabase
                .from("product_components")
                .update({ glb_file_url: publicUrl })
                .eq("component_id", componentId);
        }
    }

    revalidatePath(`/admin/products/${productId}/setup`);
    return data;
}

export interface MultiAssetUploadItem {
    assetId: string;
    objectKey: string;
    fileName: string;
    mimeType: string;
    byteSize: number;
    displayOrder: number;
    isPrimary: boolean;
}

export interface CatalogAssetRecord {
    asset_id: string;
    product_id: string;
    template_id?: string | null;
    component_id?: string | null;
    asset_type: AssetType;
    r2_object_key: string;
    file_name: string;
    mime_type: string;
    byte_size: number;
    display_order: number;
    is_primary: boolean;
    status: "Active" | "Inactive";
    created_by?: string;
    updated_by?: string;
    created_at?: string;
    updated_at?: string;
}

export async function confirmCatalogImageBatch(
    productId: string,
    newAssets: MultiAssetUploadItem[]
): Promise<CatalogAssetRecord[]> {
    const adminCtx = await requirePermission("manage_products");
    const supabase = await createSupabaseServerClient();

    // 1. Fetch existing active catalog images to calculate display orders
    const { data: existingAssets } = await supabase
        .from("product_assets")
        .select("asset_id, display_order, is_primary")
        .eq("product_id", productId)
        .eq("asset_type", "Catalog Image")
        .eq("status", "Active")
        .order("display_order", { ascending: true });

    const currentCount = existingAssets?.length || 0;
    const hasExistingPrimary = existingAssets?.some((a) => a.is_primary) || false;

    // 2. Prepare insert payloads with continuous display_order
    const insertPayloads = newAssets.map((item, index) => {
        const isFirstOverall = !hasExistingPrimary && index === 0;
        return {
            asset_id: item.assetId,
            product_id: productId,
            created_by: adminCtx.profileId,
            updated_by: adminCtx.profileId,
            asset_type: "Catalog Image" as const,
            r2_object_key: item.objectKey,
            file_name: item.fileName,
            mime_type: item.mimeType,
            byte_size: item.byteSize,
            display_order: currentCount + index + 1,
            is_primary: isFirstOverall ? true : item.isPrimary && !hasExistingPrimary,
            status: "Active" as const,
        };
    });

    const { data, error } = await supabase
        .from("product_assets")
        .insert(insertPayloads)
        .select();

    if (error) {
        console.error("Failed to batch insert catalog images:", error);
        throw new Error(error.message);
    }

    revalidatePath(`/admin/products/${productId}/setup`);
    revalidatePath("/product");
    revalidatePath(`/product-details/${productId}`);

    return data as CatalogAssetRecord[];
}

export async function setPrimaryCatalogImage(
    productId: string,
    targetAssetId: string
): Promise<void> {
    const adminCtx = await requirePermission("manage_products");
    const supabase = await createSupabaseServerClient();

    // Step 1: Remove primary flag from current primary
    await supabase
        .from("product_assets")
        .update({ is_primary: false, updated_by: adminCtx.profileId })
        .eq("product_id", productId)
        .eq("asset_type", "Catalog Image")
        .eq("is_primary", true);

    // Step 2: Set target asset as primary
    const { error } = await supabase
        .from("product_assets")
        .update({ is_primary: true, updated_by: adminCtx.profileId })
        .eq("asset_id", targetAssetId);

    if (error) {
        throw new Error(`Failed to set primary asset: ${error.message}`);
    }

    revalidatePath(`/admin/products/${productId}/setup`);
    revalidatePath("/product");
    revalidatePath(`/product-details/${productId}`);
}

export async function deleteCatalogImage(
    productId: string,
    assetId: string
): Promise<void> {
    const adminCtx = await requirePermission("manage_products");
    const supabase = await createSupabaseServerClient();

    // 1. Soft-delete the asset
    const { data: deleted } = await supabase
        .from("product_assets")
        .update({ status: "Inactive", is_primary: false, updated_by: adminCtx.profileId })
        .eq("asset_id", assetId)
        .select("is_primary")
        .single();

    // 2. If deleted asset was primary, promote the first remaining active asset
    if (deleted?.is_primary) {
        const { data: remaining } = await supabase
            .from("product_assets")
            .select("asset_id")
            .eq("product_id", productId)
            .eq("asset_type", "Catalog Image")
            .eq("status", "Active")
            .order("display_order", { ascending: true })
            .limit(1);

        if (remaining && remaining.length > 0) {
            await supabase
                .from("product_assets")
                .update({ is_primary: true, updated_by: adminCtx.profileId })
                .eq("asset_id", remaining[0].asset_id);
        }
    }

    revalidatePath(`/admin/products/${productId}/setup`);
    revalidatePath("/product");
    revalidatePath(`/product-details/${productId}`);
}

export async function deleteProductAssets(objectKeys: string[]) {
    if (!objectKeys || objectKeys.length === 0) return;
    
    await requirePermission("manage_products");

    try {
        const command = new DeleteObjectsCommand({
            Bucket: R2_BUCKET_NAME,
            Delete: {
                Objects: objectKeys.map(Key => ({ Key })),
                Quiet: false
            }
        });

        await s3Client.send(command);
    } catch (err: unknown) {
        console.error("Failed to delete product assets from R2:", err);
        const msg = err instanceof Error ? err.message : "R2 deletion error";
        throw new Error(msg);
    }
}

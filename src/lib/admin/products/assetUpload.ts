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

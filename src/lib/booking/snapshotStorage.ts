/**
 * GlassFit Visualization Snapshot Storage Adapter (IMP-MS13)
 *
 * Persists customer visualization canvas snapshots to Cloudflare R2 bucket storage
 * with fallback handling for local development environments.
 *
 * Upstream Specifications: docs/sdd-glassfit.md (SDD-C6, SDD-C8), docs/prd-glassfit.md (PRD-F9, PRD-F13)
 * Traceability Codes: PRD-F9, PRD-F13, SDD-C6, SDD-C8, ERD-E10, BAN-TYPE-05
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2AssetUrl } from "@/lib/r2";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "glassfit-assets";

/**
 * Uploads a base64 image data URL to Cloudflare R2 bucket storage under the snapshot key.
 * If Cloudflare R2 credentials are not configured, returns the target object key.
 */
export async function uploadSnapshotImage(
  dataUrl: string,
  profileId: string,
  snapshotId: string
): Promise<string> {
  const objectKey = `snapshots/${profileId}/${snapshotId}.webp`;

  if (!dataUrl || typeof dataUrl !== "string") {
    return objectKey;
  }

  // Verify R2 credentials availability
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.warn("R2 credentials not configured; recording snapshot key reference.");
    return objectKey;
  }

  try {
    const s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });

    const matches = dataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
    const contentType = matches ? matches[1] : "image/webp";
    const base64Data = matches ? matches[2] : dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    await s3Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: objectKey,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    return objectKey;
  } catch (err) {
    console.error("Failed to upload visualization snapshot to R2:", err);
    return objectKey;
  }
}

/**
 * Resolves a snapshot image URL for public rendering.
 * If the key is already a full URL or data URL, returns it directly.
 * Otherwise, resolves the asset URL against Cloudflare R2 asset base domain.
 */
export function resolveSnapshotUrl(objectKey: string | null | undefined): string | null {
  if (!objectKey) {
    return null;
  }

  if (objectKey.startsWith("data:") || objectKey.startsWith("http://") || objectKey.startsWith("https://")) {
    return objectKey;
  }

  return getR2AssetUrl(objectKey);
}

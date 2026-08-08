const R2_ASSET_BASE_URL =
    process.env.NEXT_PUBLIC_R2_ASSET_BASE_URL;

export function getR2AssetUrl(
    objectKey: string | null | undefined
): string | null {
    if (!objectKey || !R2_ASSET_BASE_URL) {
        return null;
    }

    const baseUrl =
        R2_ASSET_BASE_URL.replace(/\/+$/, "");

    const cleanObjectKey =
        objectKey.replace(/^\/+/, "");

    return `${baseUrl}/${cleanObjectKey}`;
}
"use client";

import { useState } from "react";
import Image from "next/image";
import { X, UploadCloud, Loader2 } from "lucide-react";
import { generatePresignedUrl, confirmAssetUpload } from "@/lib/admin/products/assetUpload";

export type CatalogAssetsSectionProps = {
    productId: string;
    initialData?: {
        catalogImage?: any; // from product_assets where asset_type = 'Catalog Image'
        catalogPreview?: any; // from product_assets where asset_type = 'Catalog 3D Preview'
    };
    onSave: (data: any) => void;
};

type UploadStatus = "idle" | "uploading" | "success" | "error";

export function CatalogAssetsSection({ productId, initialData, onSave }: CatalogAssetsSectionProps) {
    const [imageStatus, setImageStatus] = useState<UploadStatus>("idle");
    const [imageError, setImageError] = useState<string | null>(null);
    const [imageAsset, setImageAsset] = useState<any>(initialData?.catalogImage || null);
    
    const [previewStatus, setPreviewStatus] = useState<UploadStatus>("idle");
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [previewAsset, setPreviewAsset] = useState<any>(initialData?.catalogPreview || null);

    const [isDraggingImage, setIsDraggingImage] = useState(false);
    const [isDraggingPreview, setIsDraggingPreview] = useState(false);

    const handleFileUpload = async (
        file: File, 
        assetType: "Catalog Image" | "Catalog 3D Preview",
        setStatus: (s: UploadStatus) => void,
        setError: (e: string | null) => void,
        setAsset: (a: any) => void
    ) => {
        try {
            setStatus("uploading");
            setError(null);

            // 1. Request presigned URL
            const { uploadUrl, assetId, objectKey } = await generatePresignedUrl(
                productId,
                assetType,
                file.name,
                file.type
            );

            // 2. Direct PUT to R2
            const uploadResponse = await fetch(uploadUrl, {
                method: "PUT",
                body: file,
                headers: {
                    "Content-Type": file.type,
                },
            });

            if (!uploadResponse.ok) {
                throw new Error(`Upload failed: ${uploadResponse.statusText}`);
            }

            // 3. Confirm with server
            const confirmedAsset = await confirmAssetUpload(
                productId,
                assetId,
                objectKey,
                assetType,
                file.name,
                file.type,
                file.size
            );

            setAsset(confirmedAsset);
            setStatus("success");
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to upload file.");
            setStatus("error");
        }
    };

    return (
        <div className="flex flex-col gap-[30px]">
            <div className="flex flex-col gap-1 text-[#0f1422]">
                <h2 className="text-xl sm:text-2xl font-medium leading-tight tracking-tight">
                    Catalog Assets
                </h2>
                <p className="text-xs sm:text-base font-normal leading-snug text-neutral-600">
                    Upload the primary image and whole 3D preview for the customer catalog.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
                {/* Catalog Image Upload */}
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-[16px] font-medium leading-[1.4] text-[#0f1422]">
                            Catalog Image <span className="text-[#e74242]">*</span>
                        </label>
                        <p className="text-[12px] font-normal leading-[1.4] text-[#c3c3c3]">
                            JPG, PNG, or WebP. This is the thumbnail shown in the product list.
                        </p>
                    </div>

                    {imageAsset ? (
                        <div className="relative w-full aspect-square bg-[#f5f5f5] rounded-[16px] border border-neutral-200 overflow-hidden flex flex-col items-center justify-center p-4">
                            <div className="text-center">
                                <p className="font-medium text-[#0f1422]">{imageAsset.file_name}</p>
                                <p className="text-xs text-neutral-500">{(imageAsset.byte_size / 1024).toFixed(1)} KB</p>
                                <p className="text-sm text-green-600 mt-2 font-medium">✓ Uploaded successfully</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setImageAsset(null)}
                                className="absolute top-3 right-3 p-1.5 bg-white rounded-full text-neutral-500 hover:text-red-500 hover:bg-red-50 transition-colors border border-neutral-200 shadow-sm"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                    ) : (
                        <label 
                            className={`w-full aspect-square border-2 border-dashed rounded-[16px] flex flex-col items-center justify-center cursor-pointer transition-colors p-6 text-center group ${
                                isDraggingImage 
                                    ? "bg-[#07b6d3]/10 border-[#07b6d3]" 
                                    : "bg-[#f5f5f5]/50 border-[#07b6d3]/40 hover:bg-[#07b6d3]/5"
                            }`}
                            onDragOver={(e) => { e.preventDefault(); setIsDraggingImage(true); }}
                            onDragLeave={(e) => { e.preventDefault(); setIsDraggingImage(false); }}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDraggingImage(false);
                                if (e.dataTransfer.files?.[0]) {
                                    handleFileUpload(e.dataTransfer.files[0], "Catalog Image", setImageStatus, setImageError, setImageAsset);
                                }
                            }}
                        >
                            {imageStatus === "uploading" ? (
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="size-8 text-[#07b6d3] animate-spin" />
                                    <p className="text-[#07b6d3] font-medium">Uploading...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="p-4 rounded-full bg-white shadow-sm mb-4 group-hover:scale-105 transition-transform pointer-events-none">
                                        <UploadCloud className="size-6 text-[#07b6d3]" />
                                    </div>
                                    <p className="text-[#0f1422] font-medium mb-1 pointer-events-none">Click or drag to upload image</p>
                                    <p className="text-xs text-neutral-500 pointer-events-none">Max size: 5MB</p>
                                    {imageStatus === "error" && (
                                        <p className="text-xs text-red-500 mt-3 font-medium bg-red-50 p-1.5 rounded">{imageError}</p>
                                    )}
                                </>
                            )}
                            <input
                                type="file"
                                accept="image/png, image/jpeg, image/webp"
                                className="hidden"
                                disabled={imageStatus === "uploading"}
                                onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                        handleFileUpload(e.target.files[0], "Catalog Image", setImageStatus, setImageError, setImageAsset);
                                    }
                                }}
                            />
                        </label>
                    )}
                </div>

                {/* Catalog 3D Preview Upload */}
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-[16px] font-medium leading-[1.4] text-[#0f1422]">
                            Whole 3D Preview
                        </label>
                        <p className="text-[12px] font-normal leading-[1.4] text-[#c3c3c3]">
                            GLB format. Used to preview the complete product in the catalog before configuration.
                        </p>
                    </div>

                    {previewAsset ? (
                        <div className="relative w-full aspect-square bg-[#f5f5f5] rounded-[16px] border border-neutral-200 overflow-hidden flex flex-col items-center justify-center p-4">
                            <div className="text-center">
                                <Image src="/upload.svg" alt="3D Model" width={48} height={48} className="mx-auto mb-3 opacity-50" />
                                <p className="font-medium text-[#0f1422] truncate max-w-full">{previewAsset.file_name}</p>
                                <p className="text-xs text-neutral-500">{(previewAsset.byte_size / (1024 * 1024)).toFixed(2)} MB</p>
                                <p className="text-sm text-green-600 mt-2 font-medium">✓ Uploaded successfully</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreviewAsset(null)}
                                className="absolute top-3 right-3 p-1.5 bg-white rounded-full text-neutral-500 hover:text-red-500 hover:bg-red-50 transition-colors border border-neutral-200 shadow-sm"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                    ) : (
                        <label 
                            className={`w-full aspect-square border-2 border-dashed rounded-[16px] flex flex-col items-center justify-center cursor-pointer transition-colors p-6 text-center group ${
                                isDraggingPreview 
                                    ? "bg-[#07b6d3]/10 border-[#07b6d3]" 
                                    : "bg-[#f5f5f5]/50 border-[#07b6d3]/40 hover:bg-[#07b6d3]/5"
                            }`}
                            onDragOver={(e) => { e.preventDefault(); setIsDraggingPreview(true); }}
                            onDragLeave={(e) => { e.preventDefault(); setIsDraggingPreview(false); }}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDraggingPreview(false);
                                if (e.dataTransfer.files?.[0]) {
                                    handleFileUpload(e.dataTransfer.files[0], "Catalog 3D Preview", setPreviewStatus, setPreviewError, setPreviewAsset);
                                }
                            }}
                        >
                            {previewStatus === "uploading" ? (
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="size-8 text-[#07b6d3] animate-spin" />
                                    <p className="text-[#07b6d3] font-medium">Uploading...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="p-4 rounded-full bg-white shadow-sm mb-4 group-hover:scale-105 transition-transform pointer-events-none">
                                        <Image src="/upload.svg" alt="Upload" width={24} height={24} className="opacity-70" />
                                    </div>
                                    <p className="text-[#0f1422] font-medium mb-1 pointer-events-none">Click or drag to upload 3D model</p>
                                    <p className="text-xs text-neutral-500 pointer-events-none">GLB only (Max 25MB)</p>
                                    {previewStatus === "error" && (
                                        <p className="text-xs text-red-500 mt-3 font-medium bg-red-50 p-1.5 rounded">{previewError}</p>
                                    )}
                                </>
                            )}
                            <input
                                type="file"
                                accept=".glb,model/gltf-binary"
                                className="hidden"
                                disabled={previewStatus === "uploading"}
                                onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                        handleFileUpload(e.target.files[0], "Catalog 3D Preview", setPreviewStatus, setPreviewError, setPreviewAsset);
                                    }
                                }}
                            />
                        </label>
                    )}
                </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-neutral-200">
                <button
                    type="button"
                    onClick={() => onSave({ imageAsset, previewAsset })} // Just passing state forward for wizard continuity
                    className="bg-[#0f1422] text-white px-6 py-2.5 rounded-[10px] hover:bg-black transition-colors ml-auto font-medium"
                >
                    Continue
                </button>
            </div>
        </div>
    );
}

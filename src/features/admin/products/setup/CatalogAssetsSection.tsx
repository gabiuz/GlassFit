"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  X,
  Star,
  Loader2,
  Plus,
  ZoomIn,
} from "lucide-react";
import {
  confirmAssetUpload,
  confirmCatalogImageBatch,
  deleteCatalogImage,
  generatePresignedUrl,
  setPrimaryCatalogImage,
  type CatalogAssetRecord,
  type MultiAssetUploadItem,
} from "@/lib/admin/products/assetUpload";
import { getR2AssetUrl } from "@/lib/r2";
import { ModelPreviewCanvas } from "./components/ModelPreviewCanvas";
import { AssetLightboxModal } from "./components/AssetLightboxModal";

export type AssetSummary = {
  asset_id?: string;
  product_id?: string;
  asset_type?: string;
  file_name?: string;
  mime_type?: string;
  byte_size?: number;
  r2_object_key?: string;
  display_order?: number;
  is_primary?: boolean;
  status?: string;
  file_url?: string | null;
  [key: string]: unknown;
};

export type CatalogAssetsSectionProps = {
  productId: string;
  initialData?: {
    catalogImages?: AssetSummary[] | CatalogAssetRecord[] | null;
    catalogImage?: AssetSummary | CatalogAssetRecord | null;
    catalogPreview?: AssetSummary | CatalogAssetRecord | null;
  };
  onSave: (data: {
    catalogImages?: CatalogAssetRecord[];
    imageAsset?: CatalogAssetRecord | null;
    previewAsset: AssetSummary | CatalogAssetRecord | null;
  }) => void;
};

type UploadStatus = "idle" | "uploading" | "success" | "error";

export function resolveAssetUrl(
  asset: { file_url?: string | null; r2_object_key?: string | null } | CatalogAssetRecord | AssetSummary | null | undefined
): string | null {
  if (!asset) return null;
  if ("file_url" in asset && typeof asset.file_url === "string" && asset.file_url) return asset.file_url;
  if (asset.r2_object_key) {
    return getR2AssetUrl(asset.r2_object_key);
  }
  return null;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_MODEL_SIZE = 25 * 1024 * 1024; // 25 MB

export function CatalogAssetsSection({
  productId,
  initialData,
  onSave,
}: CatalogAssetsSectionProps) {
  // Multi-image catalog state
  const initialImages: CatalogAssetRecord[] = (
    initialData?.catalogImages ||
    (initialData?.catalogImage ? [initialData.catalogImage] : [])
  )
    .map((item, index) => ({
      asset_id: item.asset_id || `temp-${index}`,
      product_id: item.product_id || productId,
      asset_type: "Catalog Image" as const,
      r2_object_key: item.r2_object_key || "",
      file_name: item.file_name || "Catalog Image",
      mime_type: item.mime_type || "image/jpeg",
      byte_size: item.byte_size || 0,
      display_order: item.display_order ?? index + 1,
      is_primary: item.is_primary ?? index === 0,
      status: (item.status === "Inactive" ? "Inactive" : "Active") as "Active" | "Inactive",
    }))
    .filter((item) => item.status === "Active" && item.r2_object_key !== "");

  const [assets, setAssets] = useState<CatalogAssetRecord[]>(initialImages);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [isDraggingImages, setIsDraggingImages] = useState(false);
  const [imageFitMode, setImageFitMode] = useState<"contain" | "cover">("contain");

  // 3D Preview state
  const [previewStatus, setPreviewStatus] = useState<UploadStatus>("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<CatalogAssetRecord | AssetSummary | null>(
    initialData?.catalogPreview ?? null
  );
  const [localPreviewFile, setLocalPreviewFile] = useState<File | null>(null);
  const [isDraggingPreview, setIsDraggingPreview] = useState(false);

  // Lightbox Modal State
  const [lightboxData, setLightboxData] = useState<{
    assetType: "image" | "model";
    source: string | File;
    fileName: string;
    fileSizeBytes: number;
  } | null>(null);

  const previewInputRef = useRef<HTMLInputElement>(null);

  const totalImages = assets.length;
  const activeAsset = assets[activeIndex] || null;

  // Infinite Marquee Navigation with modulo wrap-around (no hard boundaries)
  const handleNextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (totalImages <= 1) return;
    setActiveIndex((prev) => (prev + 1) % totalImages);
  };

  const handlePrevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (totalImages <= 1) return;
    setActiveIndex((prev) => (prev - 1 + totalImages) % totalImages);
  };

  const handleImageBatchUpload = async (files: FileList | File[]) => {
    try {
      setIsUploadingImages(true);
      setImageUploadError(null);

      const fileList = Array.from(files);
      const validFiles: File[] = [];

      for (const file of fileList) {
        if (file.size > MAX_IMAGE_SIZE) {
          throw new Error(`File ${file.name} exceeds the 5MB maximum limit.`);
        }
        if (!file.type.match(/^image\/(png|jpeg|webp)$/i)) {
          throw new Error(`File ${file.name} is not a valid JPG, PNG, or WebP image.`);
        }
        validFiles.push(file);
      }

      const uploadedItems: MultiAssetUploadItem[] = [];

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const { uploadUrl, assetId, objectKey } = await generatePresignedUrl(
          productId,
          "Catalog Image",
          file.name,
          file.type
        );

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        if (!putRes.ok) {
          throw new Error(`Failed to upload image file: ${file.name}`);
        }

        uploadedItems.push({
          assetId,
          objectKey,
          fileName: file.name,
          mimeType: file.type,
          byteSize: file.size,
          displayOrder: assets.length + i + 1,
          isPrimary: assets.length === 0 && i === 0,
        });
      }

      const confirmed = await confirmCatalogImageBatch(productId, uploadedItems);
      const updated = [...assets, ...confirmed];
      setAssets(updated);
    } catch (err: unknown) {
      console.error("Image upload error:", err);
      setImageUploadError(err instanceof Error ? err.message : "Failed to upload catalog images.");
    } finally {
      setIsUploadingImages(false);
    }
  };

  const handleDeleteImage = async (assetId: string) => {
    try {
      await deleteCatalogImage(productId, assetId);
      const updated = assets.filter((a) => a.asset_id !== assetId);
      setAssets(updated);
      if (activeIndex >= updated.length) {
        setActiveIndex(Math.max(0, updated.length - 1));
      }
    } catch (err: unknown) {
      console.error("Delete image error:", err);
      setImageUploadError(err instanceof Error ? err.message : "Failed to delete image.");
    }
  };

  const handleMakePrimary = async (assetId: string) => {
    try {
      await setPrimaryCatalogImage(productId, assetId);
      const updated = assets.map((a) => ({
        ...a,
        is_primary: a.asset_id === assetId,
      }));
      setAssets(updated);
    } catch (err: unknown) {
      console.error("Make primary error:", err);
      setImageUploadError(err instanceof Error ? err.message : "Failed to set primary image.");
    }
  };

  const handlePreviewUpload = async (file: File) => {
    if (file.size > MAX_MODEL_SIZE) {
      setPreviewError("3D model file size exceeds the 25MB limit.");
      setPreviewStatus("error");
      return;
    }

    const isGlb =
      file.name.toLowerCase().endsWith(".glb") || file.type === "model/gltf-binary";
    if (!isGlb) {
      setPreviewError("Only GLB binary models (.glb) are supported.");
      setPreviewStatus("error");
      return;
    }

    setLocalPreviewFile(file);
    setPreviewStatus("uploading");
    setPreviewError(null);

    try {
      const { uploadUrl, assetId, objectKey } = await generatePresignedUrl(
        productId,
        "Catalog 3D Preview",
        file.name,
        file.type || "model/gltf-binary"
      );

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "model/gltf-binary" },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      const confirmedAsset = await confirmAssetUpload(
        productId,
        assetId,
        objectKey,
        "Catalog 3D Preview",
        file.name,
        file.type || "model/gltf-binary",
        file.size
      );

      setPreviewAsset(confirmedAsset);
      setPreviewStatus("success");
    } catch (err: unknown) {
      console.error("3D Preview upload error:", err);
      setPreviewError(err instanceof Error ? err.message : "Failed to upload 3D model.");
      setPreviewStatus("error");
    }
  };

  const handleRemovePreview = () => {
    setLocalPreviewFile(null);
    setPreviewAsset(null);
    setPreviewStatus("idle");
    setPreviewError(null);
    if (previewInputRef.current) {
      previewInputRef.current.value = "";
    }
  };

  // Determine active display source for 3D model
  const resolvedRemoteModelUrl = resolveAssetUrl(previewAsset);
  const activeModelSource = localPreviewFile || resolvedRemoteModelUrl;
  const activeModelName = previewAsset?.file_name || localPreviewFile?.name || "3D Preview Model";
  const activeModelSize = previewAsset?.byte_size || localPreviewFile?.size || 0;

  return (
    <div className="flex flex-col gap-[30px]">
      <div className="flex flex-col gap-1 text-[#0f1422]">
        <h2 className="text-xl sm:text-2xl font-medium leading-tight tracking-tight">
          Catalog Assets
        </h2>
        <p className="text-xs sm:text-base font-normal leading-snug text-neutral-600">
          Upload 2D photos for the product catalog gallery and an interactive 3D WebGL preview model.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
        {/* 2D Catalog Images (Multi-Image Ingestion & Infinite Marquee) */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[16px] font-medium leading-[1.4] text-[#0f1422]">
              2D Catalog Gallery <span className="text-[#e74242]">*</span>
            </label>
            <p className="text-[12px] font-normal leading-[1.4] text-neutral-400">
              JPG, PNG, or WebP. Upload multiple photos; select a primary thumbnail.
            </p>
          </div>

          {totalImages > 0 ? (
            <div className="flex flex-col gap-3">
              {/* Main Preview Container with Infinite Loop Navigation */}
              <div className="relative w-full aspect-square bg-[#f8fafc] rounded-[16px] border border-neutral-200 overflow-hidden flex flex-col justify-between group">
                {/* Checkered Canvas Underlay for Transparency */}
                <div
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    backgroundImage: "radial-gradient(#94a3b8 1px, transparent 1px)",
                    backgroundSize: "16px 16px",
                  }}
                />

                {activeAsset && (
                  <div className="relative w-full h-full p-2 flex items-center justify-center">
                    <Image
                      src={getR2AssetUrl(activeAsset.r2_object_key) || ""}
                      alt={activeAsset.file_name}
                      fill
                      unoptimized
                      className={`transition-all duration-200 ${
                        imageFitMode === "contain" ? "object-contain p-4" : "object-cover"
                      }`}
                    />

                    {/* Hover Zoom Overlay */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
                      <button
                        type="button"
                        onClick={() => {
                          const src = getR2AssetUrl(activeAsset.r2_object_key) || "";
                          setLightboxData({
                            assetType: "image",
                            source: src,
                            fileName: activeAsset.file_name,
                            fileSizeBytes: activeAsset.byte_size || 0,
                          });
                        }}
                        className="p-2 rounded-full bg-white text-neutral-700 hover:text-black hover:scale-105 transition-transform shadow-md cursor-pointer"
                        title="Inspect Full Image"
                      >
                        <ZoomIn className="size-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Primary Badge */}
                {activeAsset?.is_primary && (
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#07b6d3] text-white text-xs font-semibold flex items-center gap-1 shadow-sm z-20">
                    <Star className="size-3 fill-current" /> Primary Thumbnail
                  </div>
                )}

                {/* Infinite Marquee Controls: Left / Right Arrows */}
                {totalImages > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={handlePrevImage}
                      aria-label="Previous Image"
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 hover:bg-white text-neutral-700 hover:text-black shadow-md transition-transform hover:scale-110 z-20 cursor-pointer"
                    >
                      <ChevronLeft className="size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextImage}
                      aria-label="Next Image"
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 hover:bg-white text-neutral-700 hover:text-black shadow-md transition-transform hover:scale-110 z-20 cursor-pointer"
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  </>
                )}

                {/* Quick Actions Overlay */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
                  {activeAsset && !activeAsset.is_primary && (
                    <button
                      type="button"
                      onClick={() => handleMakePrimary(activeAsset.asset_id)}
                      className="p-1.5 rounded-full bg-white/90 hover:bg-white text-neutral-600 hover:text-[#07b6d3] shadow-sm transition-colors text-xs flex items-center gap-1 px-2.5 font-medium cursor-pointer"
                      title="Set as Primary Thumbnail"
                    >
                      <Star className="size-3.5" /> Make Primary
                    </button>
                  )}
                  {activeAsset && (
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(activeAsset.asset_id)}
                      className="p-1.5 rounded-full bg-white/90 hover:bg-red-50 text-neutral-500 hover:text-red-500 shadow-sm transition-colors cursor-pointer"
                      title="Delete this image"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>

                {/* Bottom Metadata Bar */}
                <div className="relative p-2.5 bg-white/95 backdrop-blur-sm border-t border-neutral-200 flex items-center justify-between text-xs z-20">
                  <div className="flex flex-col min-w-0 pr-2">
                    <p className="font-medium text-[#0f1422] truncate">
                      {activeAsset?.file_name}
                    </p>
                    <p className="text-neutral-400 text-[11px]">
                      {activeAsset?.byte_size && activeAsset.byte_size > 1024 * 1024
                        ? `${(activeAsset.byte_size / (1024 * 1024)).toFixed(2)} MB`
                        : `${((activeAsset?.byte_size || 0) / 1024).toFixed(1)} KB`}
                      {totalImages > 1 && ` • ${activeIndex + 1} of ${totalImages}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setImageFitMode(imageFitMode === "contain" ? "cover" : "contain")
                    }
                    className="text-[10px] px-2 py-1 rounded bg-neutral-100 text-neutral-600 hover:bg-neutral-200 font-medium transition-colors shrink-0 cursor-pointer"
                  >
                    {imageFitMode === "contain" ? "Fit" : "Fill"}
                  </button>
                </div>
              </div>

              {/* Thumbnail Strip with Add More Button */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
                {assets.map((item, idx) => (
                  <button
                    key={item.asset_id}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    className={`relative size-16 shrink-0 rounded-[10px] border-2 overflow-hidden transition-all cursor-pointer ${
                      idx === activeIndex
                        ? "border-[#07b6d3] ring-2 ring-[#07b6d3]/20 scale-105"
                        : "border-neutral-200 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <Image
                      src={getR2AssetUrl(item.r2_object_key) || ""}
                      alt={item.file_name}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                    {item.is_primary && (
                      <div className="absolute top-0.5 left-0.5 size-3.5 rounded-full bg-[#07b6d3] flex items-center justify-center">
                        <Star className="size-2 text-white fill-current" />
                      </div>
                    )}
                  </button>
                ))}

                {/* Add More Images Button */}
                <label className="size-16 shrink-0 rounded-[10px] border-2 border-dashed border-neutral-300 hover:border-[#07b6d3] hover:bg-[#07b6d3]/5 flex items-center justify-center cursor-pointer text-neutral-400 hover:text-[#07b6d3] transition-colors">
                  {isUploadingImages ? (
                    <Loader2 className="size-5 animate-spin text-[#07b6d3]" />
                  ) : (
                    <Plus className="size-5" />
                  )}
                  <input
                    type="file"
                    multiple
                    accept="image/png, image/jpeg, image/webp"
                    className="hidden"
                    disabled={isUploadingImages}
                    onChange={(e) => e.target.files && handleImageBatchUpload(e.target.files)}
                  />
                </label>
              </div>
            </div>
          ) : (
            /* Empty State Dropzone */
            <label
              className={`w-full aspect-square border-2 border-dashed rounded-[16px] flex flex-col items-center justify-center cursor-pointer transition-colors p-6 text-center group ${
                isDraggingImages
                  ? "bg-[#07b6d3]/10 border-[#07b6d3]"
                  : "bg-[#f5f5f5]/50 border-[#07b6d3]/40 hover:bg-[#07b6d3]/5"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingImages(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDraggingImages(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingImages(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleImageBatchUpload(e.dataTransfer.files);
                }
              }}
            >
              {isUploadingImages ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="size-8 text-[#07b6d3] animate-spin" />
                  <p className="text-[#07b6d3] font-medium">Uploading images...</p>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-full bg-white shadow-sm mb-4 group-hover:scale-105 transition-transform pointer-events-none">
                    <UploadCloud className="size-6 text-[#07b6d3]" />
                  </div>
                  <p className="text-[#0f1422] font-medium mb-1 pointer-events-none">
                    Click or drag images to upload
                  </p>
                  <p className="text-xs text-neutral-500 pointer-events-none">
                    JPG, PNG, or WebP. Accepts multiple files (Max 5MB each).
                  </p>
                </>
              )}
              <input
                type="file"
                multiple
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
                disabled={isUploadingImages}
                onChange={(e) => e.target.files && handleImageBatchUpload(e.target.files)}
              />
            </label>
          )}

          {imageUploadError && (
            <p className="text-xs text-red-500 font-medium bg-red-50 p-2 rounded">
              {imageUploadError}
            </p>
          )}
        </div>

        {/* Catalog 3D Preview Upload (Hardware-Accelerated WebGL Preview Canvas) */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[16px] font-medium leading-[1.4] text-[#0f1422]">
              Whole 3D Preview
            </label>
            <p className="text-[12px] font-normal leading-[1.4] text-neutral-400">
              GLB format. Used to preview the complete product in the catalog before configuration.
            </p>
          </div>

          {activeModelSource ? (
            <div className="relative">
              <ModelPreviewCanvas
                modelSource={activeModelSource}
                fileName={activeModelName}
                fileSizeBytes={activeModelSize}
                onRemove={handleRemovePreview}
                onExpand={() => {
                  setLightboxData({
                    assetType: "model",
                    source: activeModelSource,
                    fileName: activeModelName,
                    fileSizeBytes: activeModelSize,
                  });
                }}
              />
              {previewStatus === "uploading" && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs rounded-[16px] flex flex-col items-center justify-center gap-2 z-30">
                  <Loader2 className="size-7 text-[#07b6d3] animate-spin" />
                  <p className="text-xs font-medium text-[#07b6d3]">Uploading 3D preview...</p>
                </div>
              )}
            </div>
          ) : (
            <label
              className={`w-full aspect-square border-2 border-dashed rounded-[16px] flex flex-col items-center justify-center cursor-pointer transition-colors p-6 text-center group ${
                isDraggingPreview
                  ? "bg-[#07b6d3]/10 border-[#07b6d3]"
                  : "bg-[#f5f5f5]/50 border-[#07b6d3]/40 hover:bg-[#07b6d3]/5"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingPreview(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDraggingPreview(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingPreview(false);
                if (e.dataTransfer.files?.[0]) {
                  handlePreviewUpload(e.dataTransfer.files[0]);
                }
              }}
            >
              {previewStatus === "uploading" ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="size-8 text-[#07b6d3] animate-spin" />
                  <p className="text-[#07b6d3] font-medium">Uploading 3D preview...</p>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-full bg-white shadow-sm mb-4 group-hover:scale-105 transition-transform pointer-events-none">
                    <Image
                      src="/upload.svg"
                      alt="Upload"
                      width={24}
                      height={24}
                      className="opacity-70"
                    />
                  </div>
                  <p className="text-[#0f1422] font-medium mb-1 pointer-events-none">
                    Click or drag to upload 3D model
                  </p>
                  <p className="text-xs text-neutral-500 pointer-events-none">
                    GLB only (Max 25MB)
                  </p>
                  {previewStatus === "error" && (
                    <p className="text-xs text-red-500 mt-3 font-medium bg-red-50 p-1.5 rounded">
                      {previewError}
                    </p>
                  )}
                </>
              )}
              <input
                ref={previewInputRef}
                type="file"
                accept=".glb,model/gltf-binary"
                className="hidden"
                disabled={previewStatus === "uploading"}
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handlePreviewUpload(e.target.files[0]);
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
          onClick={() =>
            onSave({
              catalogImages: assets,
              imageAsset: assets.find((a) => a.is_primary) || assets[0] || null,
              previewAsset,
            })
          }
          className="bg-[#0f1422] text-white px-6 py-2.5 rounded-[10px] hover:bg-black transition-colors ml-auto font-medium cursor-pointer"
        >
          Continue
        </button>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {lightboxData && (
        <AssetLightboxModal
          isOpen={true}
          onClose={() => setLightboxData(null)}
          assetType={lightboxData.assetType}
          source={lightboxData.source}
          fileName={lightboxData.fileName}
          fileSizeBytes={lightboxData.fileSizeBytes}
        />
      )}
    </div>
  );
}

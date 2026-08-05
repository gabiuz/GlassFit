"use client";
import Image from "next/image";
import { useRef, useState, useCallback, DragEvent, ChangeEvent } from "react";

const MAX_SIZE_MB = 20;
const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif"];

function validateFile(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) {
        return "Only JPG, PNG, and HEIC files are accepted.";
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        return `File size must be under ${MAX_SIZE_MB} MB.`;
    }
    return null;
}

interface UploadImageProps {
    onImageUploaded?: (imageUrl: string) => void;
}

export function UploadImage({ onImageUploaded }: UploadImageProps = {}) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const processFile = useCallback((file: File) => {
        const validationError = validateFile(file);
        if (validationError) {
            setError(validationError);
            setPreviewUrl(null);
            setFileName(null);
            return;
        }
        setError(null);
        setFileName(file.name);
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        if (onImageUploaded) {
            onImageUploaded(url);
        }
    }, [onImageUploaded]);

    const handleBrowseClick = () => fileInputRef.current?.click();

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
        e.target.value = "";
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };

    const handleRemove = () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setFileName(null);
        setError(null);
    };

    return (
        <div className="w-full max-w-367 mx-auto px-4 sm:px-6 flex flex-col gap-12 items-center">
            {/* Header */}
            <div className="flex flex-col gap-5 items-center justify-center text-center">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-black leading-tight">
                    Upload Your <span className="text-green">Space Image</span>
                </h1>
                <p className="text-lg sm:text-[24px] md:text-[28px] font-normal text-black/90 tracking-tight leading-normal">
                    Use your actual space to create a more helpful visual preview.
                </p>
            </div>

            {/* Drop Zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleBrowseClick}
                className={[
                    "self-stretch py-12 md:py-24 rounded-[20px] shadow-[0px_0px_5px_0px_rgba(0,0,0,0.50)] border-[5px] border-dashed inline-flex flex-col justify-center items-center gap-4 sm:gap-6 md:gap-7 cursor-pointer transition-colors duration-200",
                    isDragging
                        ? "bg-cyan-50 border-cyan-400"
                        : "bg-neutral-100/30 border-cyan-500",
                ].join(" ")}
            >
                {previewUrl ? (
                    /* ── Preview State ── */
                    <div className="flex flex-col items-center gap-6 w-full">
                        <div className="relative w-full max-w-lg rounded-xl overflow-hidden shadow-lg">
                            <img
                                src={previewUrl}
                                alt="Uploaded preview"
                                className="w-full h-auto object-contain max-h-80"
                            />
                        </div>
                        <p className="text-base text-gray-600 truncate max-w-xs">{fileName}</p>
                        <div className="flex flex-wrap items-center gap-4">
                            <button
                                onClick={(e) => { e.stopPropagation(); handleRemove(); }}
                                className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-3xl text-lg font-normal transition-colors duration-200 cursor-pointer"
                            >
                                Remove Image
                            </button>
                            {onImageUploaded && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onImageUploaded(previewUrl); }}
                                    className="px-6 py-2.5 bg-green hover:bg-[#06a3bd] text-white rounded-3xl text-lg font-medium transition-colors duration-200 cursor-pointer shadow-md"
                                >
                                    Proceed to Workspace →
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="size-20 md:size-30 relative pointer-events-none">
                            <Image src="/upload.svg" alt="" width={400} height={400} />
                        </div>
                        <div className="flex flex-col gap-2 items-center justify-center text-center pointer-events-none">
                            <h2 className="text-xl sm:text-2xl md:text-3xl font-medium tracking-tight text-black leading-tight">
                                {isDragging ? "Drop it here!" : "Drag your photo here"}
                            </h2>
                            <p className="text-base sm:text-lg md:text-xl font-normal text-black/90 tracking-tight leading-normal">
                                or click to browse your files
                            </p>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleBrowseClick(); }}
                            className="px-5 py-3.5 bg-gray-900 rounded-3xl shadow-[0px_4px_50px_0px_rgba(0,0,0,0.25)] inline-flex justify-center items-center gap-3.5 hover:bg-gray-700 transition-colors duration-200"
                        >
                            <p className="text-white text-xl font-thin leading-7">Browse Files</p>
                        </button>
                        <p className="text-xs sm:text-sm md:text-xl text-stone-300 font-normal tracking-tight leading-normal pointer-events-none max-w-[280px] sm:max-w-md md:max-w-none text-center">
                            Accepted file types: JPG, PNG, and HEIC — up to 20 MB.
                        </p>
                    </>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/heic,image/heif"
                    className="hidden"
                    onChange={handleFileChange}
                />
            </div>

            {error && (
                <p className="text-red-500 text-lg font-normal">{error}</p>
            )}

            <p className="text-xl text-black font-normal tracking-tight leading-normal">
                Upload a clear photo of the area where the glass or aluminum product may be installed. <br />
                GlassFit will use this image as the background for your product overlay and visual output.
            </p>

        </div>
    );
}
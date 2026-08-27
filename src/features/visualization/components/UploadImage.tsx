"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { validateImageDecode, validateImageFile } from "@/lib/imageApi";

interface UploadImageProps {
    onImageSelected?: (file: File, previewUrl: string) => void;
}

export function UploadImage({ onImageSelected }: UploadImageProps = {}) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const clearPreview = useCallback(() => {
        setPreviewUrl((currentUrl) => {
            if (currentUrl) URL.revokeObjectURL(currentUrl);
            return null;
        });
        setFileName(null);
    }, []);

    const processFile = useCallback(async (file: File) => {
        const validationError = validateImageFile(file);
        if (validationError) {
            setError(validationError);
            clearPreview();
            return;
        }

        setIsValidating(true);
        try {
            await validateImageDecode(file);
            const nextPreviewUrl = URL.createObjectURL(file);

            setError(null);
            setFileName(file.name);
            setPreviewUrl((currentUrl) => {
                if (currentUrl) URL.revokeObjectURL(currentUrl);
                return nextPreviewUrl;
            });
            onImageSelected?.(file, nextPreviewUrl);
        } catch (decodeError) {
            setError(decodeError instanceof Error ? decodeError.message : "Uploaded image could not be decoded.");
            clearPreview();
        } finally {
            setIsValidating(false);
        }
    }, [clearPreview, onImageSelected]);

    const handleBrowseClick = () => fileInputRef.current?.click();

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) void processFile(file);
        event.target.value = "";
    };

    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) void processFile(file);
    };

    const handleRemove = () => {
        clearPreview();
        setError(null);
    };

    return (
        <div className="w-full max-w-367 mx-auto px-4 sm:px-6 flex flex-col gap-12 items-center">
            <div className="flex flex-col gap-5 items-center justify-center text-center">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-black leading-tight">
                    Upload Your <span className="text-green">Space Image</span>
                </h1>
                <p className="text-lg sm:text-[24px] md:text-[28px] font-normal text-black/90 tracking-tight leading-normal">
                    Use your actual space to create a more helpful visual preview.
                </p>
            </div>

            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleBrowseClick}
                data-dragging={isDragging ? "true" : "false"}
                className={[
                    "upload-dropzone self-stretch py-12 md:py-24 rounded-[20px] shadow-[0px_0px_5px_0px_rgba(0,0,0,0.50)] border-[5px] border-dashed inline-flex flex-col justify-center items-center gap-4 sm:gap-6 md:gap-7 cursor-pointer",
                    isDragging
                        ? "bg-cyan-50 border-cyan-400"
                        : "bg-neutral-100/30 border-cyan-500",
                ].join(" ")}
            >
                {previewUrl ? (
                    <div className="flex flex-col items-center gap-6 w-full">
                        <div className="relative w-full max-w-lg rounded-xl overflow-hidden shadow-lg">
                            <img
                                src={previewUrl}
                                alt="Uploaded preview"
                                className="w-full h-auto object-contain max-h-80"
                            />
                        </div>
                        <p className="text-base text-gray-600 truncate max-w-xs">{fileName}</p>
                        <button
                            onClick={(event) => {
                                event.stopPropagation();
                                handleRemove();
                            }}
                            className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-3xl text-lg font-normal transition-colors duration-200 cursor-pointer"
                            type="button"
                        >
                            Remove Image
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="size-20 md:size-30 relative pointer-events-none">
                            <Image src="/upload.svg" alt="" width={400} height={400} />
                        </div>
                        <div className="flex flex-col gap-2 items-center justify-center text-center pointer-events-none">
                            <h2 className="text-xl sm:text-2xl md:text-3xl font-medium tracking-tight text-black leading-tight">
                                {isValidating ? "Checking image..." : isDragging ? "Drop it here!" : "Drag your photo here"}
                            </h2>
                            <p className="text-base sm:text-lg md:text-xl font-normal text-black/90 tracking-tight leading-normal">
                                or click to browse your files
                            </p>
                        </div>
                        <button
                            onClick={(event) => {
                                event.stopPropagation();
                                handleBrowseClick();
                            }}
                            className="px-5 py-3.5 bg-gray-900 rounded-3xl shadow-[0px_4px_50px_0px_rgba(0,0,0,0.25)] inline-flex justify-center items-center gap-3.5 hover:bg-gray-700 transition-colors duration-200"
                            type="button"
                        >
                            <p className="text-white text-xl font-thin leading-7">Browse Files</p>
                        </button>
                        <p className="text-xs sm:text-sm md:text-xl text-stone-300 font-normal tracking-tight leading-normal pointer-events-none max-w-[280px] sm:max-w-md md:max-w-none text-center">
                            Accepted file types: JPG and PNG, up to 12 MB.
                        </p>
                    </>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
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

"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { createProductDraft, updateProductDraft } from "@/lib/admin/products/productMutations";
import type { ProductSetupData } from "./ProductSetupWizard";

export type BasicInfoSectionProps = {
    productId: string;
    initialData: ProductSetupData;
    onSave: (productId: string, data: Record<string, unknown>) => void;
    isEditing?: boolean;
};

const PRODUCT_TYPES = [
    "Window",
    "Door",
    "Partition",
    "Cabinet",
    "Enclosure",
    "Railing",
    "Other"
];

import type { AccessoryCategory, AccessoryMountingType, ProductRole } from "@/lib/admin/products/types";
export type { AccessoryCategory, AccessoryMountingType, ProductRole };

export function BasicInfoSection({ productId, initialData, onSave, isEditing }: BasicInfoSectionProps) {
    const searchParams = useSearchParams();
    const initialRole: ProductRole = (() => {
        if (Boolean(initialData?.is_accessory) || searchParams.get("role") === "accessory") {
            return "accessory";
        }
        if (Boolean(initialData?.is_addon) || searchParams.get("role") === "addon") {
            return "addon";
        }
        return "standard";
    })();

    const [name, setName] = useState(initialData?.product_name || "");
    const [type, setType] = useState(initialData?.product_type || "Window");
    const [description, setDescription] = useState(initialData?.description || "");
    const [basePrice, setBasePrice] = useState<string>(initialData?.base_price?.toString() || "");
    const [productRole, setProductRole] = useState<ProductRole>(initialRole);
    const [addonType, setAddonType] = useState<"screen" | "grill">(
        (initialData?.addon_type as "screen" | "grill") || "screen"
    );
    const [accessoryCategory, setAccessoryCategory] = useState<AccessoryCategory>(
        (initialData?.accessory_category as AccessoryCategory) || "handle"
    );
    const [mountingType, setMountingType] = useState<AccessoryMountingType>(
        (initialData?.accessory_mounting_type as AccessoryMountingType) || "surface_mount"
    );
    
    const isAddon = productRole === "addon";
    const isAccessory = productRole === "accessory";

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSaving(true);

        try {
            const data = {
                product_name: name,
                product_type: (isAddon || isAccessory) ? "Other" : type,
                description,
                base_price: isAddon ? 0 : (parseFloat(basePrice) || 0),
                is_addon: isAddon,
                addon_type: isAddon ? addonType : null,
                is_accessory: isAccessory,
                accessory_category: isAccessory ? accessoryCategory : null,
                accessory_mounting_type: isAccessory ? mountingType : null,
            };

            if (isEditing) {
                if (!productId || productId === "draft") {
                    throw new Error("A persisted product is required before updating basic information.");
                }
                const updatedProductId = await updateProductDraft(productId, data);
                onSave(updatedProductId, data);
            } else {
                const newProductId = await createProductDraft(data);
                onSave(newProductId, data);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An error occurred while saving.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-[30px]">
            <div className="flex flex-col gap-1 text-[#0f1422]">
                <h2 className="text-xl sm:text-2xl font-medium leading-tight tracking-tight">
                    Basic Product Information
                </h2>
                <p className="text-xs sm:text-base font-normal leading-snug text-neutral-600">
                    Enter the fundamental details. The product will remain in Draft (Inactive) status.
                </p>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">
                    {error}
                </div>
            )}

            <div className="flex flex-col gap-[20px] max-w-2xl">
                {/* Product Role Selector (MS67 & MS74) */}
                <div className="flex flex-col gap-[8px] w-full">
                    <label className="text-[16px] font-medium leading-[1.4] text-[#0f1422]">
                        Product Role <span className="text-[#e74242]">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button
                            type="button"
                            onClick={() => setProductRole("standard")}
                            className={cn(
                                "flex flex-col items-start p-3.5 rounded-[10px] border text-left transition-all cursor-pointer",
                                productRole === "standard"
                                    ? "border-[#07b6d3] bg-[#e9f9fb] text-[#0f1422] ring-1 ring-[#07b6d3]"
                                    : "border-[#c3c3c3] bg-white text-neutral-600 hover:border-neutral-400"
                            )}
                        >
                            <span className="text-sm font-semibold text-[#0f1422]">Standard Fixture</span>
                            <span className="text-xs text-neutral-500 mt-1">
                                Standalone catalog products (windows, doors, enclosures) browsable by clients.
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setProductRole("addon")}
                            className={cn(
                                "flex flex-col items-start p-3.5 rounded-[10px] border text-left transition-all cursor-pointer",
                                productRole === "addon"
                                    ? "border-[#07b6d3] bg-[#e9f9fb] text-[#0f1422] ring-1 ring-[#07b6d3]"
                                    : "border-[#c3c3c3] bg-white text-neutral-600 hover:border-neutral-400"
                            )}
                        >
                            <span className="text-sm font-semibold text-[#0f1422]">Add-on Attachment</span>
                            <span className="text-xs text-neutral-500 mt-1">
                                Aperture-spanning modular fixtures (insect screens and security grilles).
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setProductRole("accessory")}
                            className={cn(
                                "flex flex-col items-start p-3.5 rounded-[10px] border text-left transition-all cursor-pointer",
                                productRole === "accessory"
                                    ? "border-[#07b6d3] bg-[#e9f9fb] text-[#0f1422] ring-1 ring-[#07b6d3]"
                                    : "border-[#c3c3c3] bg-white text-neutral-600 hover:border-neutral-400"
                            )}
                        >
                            <span className="text-sm font-semibold text-[#0f1422]">Hardware Accessory</span>
                            <span className="text-xs text-neutral-500 mt-1">
                                Modular hardware components (handles, knobs, locks, rollers) swappable on host fixture parts.
                            </span>
                        </button>
                    </div>
                </div>

                {/* Dependent Add-on Type Select (MS67) */}
                {isAddon ? (
                    <div className="flex flex-col gap-2 p-4 bg-teal-50/60 border border-teal-200 rounded-[10px]">
                        <div className="flex flex-col gap-[5px] w-full">
                            <label className="text-[16px] font-medium leading-[1.4] text-[#0f1422]">
                                Add-on Accessory Type <span className="text-[#e74242]">*</span>
                            </label>
                            <select
                                value={addonType}
                                onChange={(e) => setAddonType(e.target.value as "screen" | "grill")}
                                required
                                className="w-full border border-teal-300 rounded-[8px] px-[16px] py-[12px] text-[14px] text-black bg-white focus:outline-none focus:border-[#07b6d3] transition-colors"
                            >
                                <option value="screen">Insect Screen</option>
                                <option value="grill">Security Grille</option>
                            </select>
                        </div>
                        <p className="text-xs text-teal-800 leading-relaxed mt-1">
                            Add-on accessories are not displayed directly in the public catalog. They are inherited as optional attachments by compatible windows and doors.
                        </p>
                    </div>
                ) : null}

                {/* Dependent Accessory Category & Mounting Type Select (MS74) */}
                {isAccessory ? (
                    <div className="flex flex-col gap-3 p-4 bg-purple-50/60 border border-purple-200 rounded-[10px]">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-[5px] w-full">
                                <label className="text-[14px] sm:text-[16px] font-medium leading-[1.4] text-[#0f1422]">
                                    Accessory Category <span className="text-[#e74242]">*</span>
                                </label>
                                <select
                                    value={accessoryCategory}
                                    onChange={(e) => setAccessoryCategory(e.target.value as AccessoryCategory)}
                                    required
                                    className="w-full border border-purple-300 rounded-[8px] px-[16px] py-[12px] text-[14px] text-black bg-white focus:outline-none focus:border-[#07b6d3] transition-colors"
                                >
                                    <option value="handle">Handle / Doorknob / Pull Bar</option>
                                    <option value="lock">Lock Mechanism / Latch / Deadbolt / Smart Lock</option>
                                    <option value="hinge">Hinge / Pivot Assembly</option>
                                    <option value="roller">Bottom Roller / Guide Wheel</option>
                                    <option value="other">Other Hardware Accessory</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-[5px] w-full">
                                <label className="text-[14px] sm:text-[16px] font-medium leading-[1.4] text-[#0f1422]">
                                    Mounting Classification <span className="text-[#e74242]">*</span>
                                </label>
                                <select
                                    value={mountingType}
                                    onChange={(e) => setMountingType(e.target.value as AccessoryMountingType)}
                                    required
                                    className="w-full border border-purple-300 rounded-[8px] px-[16px] py-[12px] text-[14px] text-black bg-white focus:outline-none focus:border-[#07b6d3] transition-colors"
                                >
                                    <option value="surface_mount">Surface Mount (Exterior / Face Fixed)</option>
                                    <option value="mortise">Mortise / Pocket Inset</option>
                                    <option value="recessed">Flush Recessed</option>
                                    <option value="clamp">Glass Friction Clamp</option>
                                </select>
                            </div>
                        </div>
                        <p className="text-xs text-purple-800 leading-relaxed">
                            Hardware accessories are not displayed directly in the public catalog. They are assigned as swappable hardware options on host fixture parts.
                        </p>
                    </div>
                ) : null}

                <div className="flex flex-col gap-[5px] w-full">
                    <label className="text-[16px] font-medium leading-[1.4] text-[#0f1422]">
                        Product Name <span className="text-[#e74242]">*</span>
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={
                            isAccessory
                                ? (accessoryCategory === "handle"
                                    ? "e.g Lever Handle Stainless"
                                    : accessoryCategory === "lock"
                                        ? "e.g Electronic Smart Deadbolt Lock"
                                        : "e.g Hardware Accessory Part")
                                : isAddon
                                    ? (addonType === "screen"
                                        ? "e.g Series 798 Insect Screen"
                                        : "e.g Diamond Grid Security Grille")
                                    : "e.g Aluminum Window"
                        }
                        required
                        className="w-full border border-[#c3c3c3] rounded-[8px] px-[16px] py-[12px] text-[14px] text-black placeholder-[#c3c3c3] focus:outline-none focus:border-[#07b6d3] transition-colors"
                    />
                </div>

                {!isAddon && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-[20px]">
                        {!isAccessory && (
                            <div className="flex flex-col gap-[5px] w-full">
                                <label className="text-[16px] font-medium leading-[1.4] text-[#0f1422]">
                                    Product Type <span className="text-[#e74242]">*</span>
                                </label>
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                    required
                                    className="w-full border border-[#c3c3c3] rounded-[8px] px-[16px] py-[12px] text-[14px] text-black bg-white focus:outline-none focus:border-[#07b6d3] transition-colors"
                                >
                                    {PRODUCT_TYPES.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className={cn("flex flex-col gap-[5px] w-full", isAccessory && "sm:col-span-2")}>
                            <label className="text-[16px] font-medium leading-[1.4] text-[#0f1422]">
                                {isAccessory ? "Accessory Base / Fixed Price (₱)" : "Base Price (₱)"} <span className="text-[#e74242]">*</span>
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={basePrice}
                                onChange={(e) => setBasePrice(e.target.value)}
                                placeholder="0.00"
                                required={!isAddon}
                                className="w-full border border-[#c3c3c3] rounded-[8px] px-[16px] py-[12px] text-[14px] text-black placeholder-[#c3c3c3] focus:outline-none focus:border-[#07b6d3] transition-colors"
                            />
                            {isAccessory && (
                                <p className="text-[12px] text-neutral-500">
                                    This base price serves as the fixed price for this accessory, eliminating the need to enter it again in components.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-[5px] w-full">
                    <label className="text-[16px] font-medium leading-[1.4] text-[#0f1422]">
                        Description
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Short product description..."
                        rows={3}
                        className="w-full border border-[#c3c3c3] rounded-[8px] px-[16px] py-[12px] text-[14px] text-black placeholder-[#c3c3c3] focus:outline-none focus:border-[#07b6d3] transition-colors resize-none"
                    />
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-neutral-200">
                <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-[#0f1422] text-white px-6 py-2.5 rounded-[10px] hover:bg-black transition-colors disabled:opacity-70 font-medium"
                >
                    {isSaving ? "Saving..." : "Save & Continue"}
                </button>
            </div>
        </form>
    );
}

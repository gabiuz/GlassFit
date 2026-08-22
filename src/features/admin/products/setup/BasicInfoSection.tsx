"use client";

import { useState } from "react";
import { createProductDraft } from "@/lib/admin/products/productMutations";

export type BasicInfoSectionProps = {
    initialData: any;
    onSave: (productId: string, data: any) => void;
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

export function BasicInfoSection({ initialData, onSave, isEditing }: BasicInfoSectionProps) {
    const [name, setName] = useState(initialData?.product_name || "");
    const [type, setType] = useState(initialData?.product_type || "Window");
    const [description, setDescription] = useState(initialData?.description || "");
    const [basePrice, setBasePrice] = useState<string>(initialData?.base_price?.toString() || "");
    
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSaving(true);

        try {
            const data = {
                product_name: name,
                product_type: type,
                description,
                base_price: parseFloat(basePrice) || 0,
            };

            if (isEditing) {
                // If editing, we would call an update mutation. 
                // For now, if we are editing and just passing to the next step, we could just fire onSave.
                // Assuming we have an update function later.
                onSave(initialData.product_id, data);
            } else {
                // Create draft
                const newProductId = await createProductDraft(data);
                onSave(newProductId, data);
            }
        } catch (err: any) {
            setError(err.message || "An error occurred while saving.");
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
                <div className="flex flex-col gap-[5px] w-full">
                    <label className="text-[16px] font-medium leading-[1.4] text-[#0f1422]">
                        Product Name <span className="text-[#e74242]">*</span>
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g Aluminum Window"
                        required
                        className="w-full border border-[#c3c3c3] rounded-[8px] px-[16px] py-[12px] text-[14px] text-black placeholder-[#c3c3c3] focus:outline-none focus:border-[#07b6d3] transition-colors"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-[20px]">
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

                    <div className="flex flex-col gap-[5px] w-full">
                        <label className="text-[16px] font-medium leading-[1.4] text-[#0f1422]">
                            Base Price (₱) <span className="text-[#e74242]">*</span>
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={basePrice}
                            onChange={(e) => setBasePrice(e.target.value)}
                            placeholder="0.00"
                            required
                            className="w-full border border-[#c3c3c3] rounded-[8px] px-[16px] py-[12px] text-[14px] text-black placeholder-[#c3c3c3] focus:outline-none focus:border-[#07b6d3] transition-colors"
                        />
                    </div>
                </div>

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

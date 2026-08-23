"use client";

import { useState } from "react";
import { UploadCloud, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { upsertProductComponent, ComponentType } from "@/lib/admin/products/componentMutations";
import { generatePresignedUrl, confirmAssetUpload } from "@/lib/admin/products/assetUpload";

export type StructuralComponentsSectionProps = {
    productId: string;
    templateId: string;
    modelStrategy: string | null;
    initialData?: any;
    onSave: () => void;
};

type MappedFile = {
    id: string;
    file: File;
    componentKey: string;
    componentName: string;
    componentType: ComponentType;
    assemblyGroup: string;
    baseQuantity: number;
    status: "idle" | "uploading" | "processing" | "success" | "error";
    errorMsg?: string;
};

const COMPONENT_TYPES: ComponentType[] = ["Model", "Procedural", "Glass", "Frame", "Panel", "Hardware", "Other"];

function formatKeyFromName(name: string) {
    return name.replace(/\.glb$/i, "").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
}

function formatLabelFromName(name: string) {
    const withoutExt = name.replace(/\.glb$/i, "");
    return withoutExt.replace(/[-_]/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

export function StructuralComponentsSection({ productId, templateId, modelStrategy, initialData, onSave }: StructuralComponentsSectionProps) {
    const [isDragging, setIsDragging] = useState(false);
    
    // Initialize from DB data if present
    const [mappedFiles, setMappedFiles] = useState<MappedFile[]>(() => {
        if (!initialData || !Array.isArray(initialData)) return [];
        return initialData.map((comp: any) => ({
            id: comp.component_id, // use DB id so we don't duplicate
            file: new File([], `${comp.component_key}.glb`), // dummy file since it's already uploaded
            componentKey: comp.component_key,
            componentName: comp.component_name,
            componentType: comp.component_type,
            assemblyGroup: comp.component_data?.assembly_group || "",
            baseQuantity: comp.base_quantity,
            status: "success",
        }));
    });
    
    const [isUploadingAll, setIsUploadingAll] = useState(false);

    // If it's fixed, we skip
    if (modelStrategy !== "Parametric") {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-neutral-200 rounded-[16px] bg-neutral-50">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                    <CheckCircle className="size-8 text-[#05b64b]" />
                </div>
                <h3 className="text-xl font-medium text-[#0f1422] mb-2">Not Applicable for Fixed Models</h3>
                <p className="text-neutral-500 max-w-md">
                    This product is configured as a Fixed model. Structural components are only required for Parametric models.
                </p>
                <button
                    type="button"
                    onClick={onSave}
                    className="mt-6 bg-[#0f1422] text-white px-6 py-2.5 rounded-[10px] hover:bg-black transition-colors font-medium"
                >
                    Continue to Next Step
                </button>
            </div>
        );
    }

    const handleFilesAdded = (files: FileList | null) => {
        if (!files) return;
        
        const glbFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith(".glb"));
        
        const newMapped = glbFiles.map(f => ({
            id: crypto.randomUUID(),
            file: f,
            componentKey: formatKeyFromName(f.name),
            componentName: formatLabelFromName(f.name),
            componentType: "Model" as ComponentType,
            assemblyGroup: "",
            baseQuantity: 1,
            status: "idle" as const
        }));

        setMappedFiles(prev => [...prev, ...newMapped]);
    };

    const updateMappedFile = (id: string, updates: Partial<MappedFile>) => {
        setMappedFiles(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    };

    const removeMappedFile = (id: string) => {
        setMappedFiles(prev => prev.filter(m => m.id !== id));
    };

    const processSingleUpload = async (mapped: MappedFile) => {
        updateMappedFile(mapped.id, { status: "processing" });

        try {
            // 1. Inspect GLB dynamically to avoid SSR issues
            const THREE = await import("three");
            const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
            
            const url = URL.createObjectURL(mapped.file);
            const loader = new GLTFLoader();
            const gltf = await loader.loadAsync(url);
            const box = new THREE.Box3().setFromObject(gltf.scene);
            const size = new THREE.Vector3();
            box.getSize(size);
            URL.revokeObjectURL(url);

            const dimensions = { x: size.x, y: size.y, z: size.z };

            updateMappedFile(mapped.id, { status: "uploading" });

            // 2. Upsert Component in DB
            const componentId = await upsertProductComponent({
                templateId,
                componentKey: mapped.componentKey,
                componentName: mapped.componentName,
                componentType: mapped.componentType,
                baseQuantity: mapped.baseQuantity,
                assemblyGroup: mapped.assemblyGroup || undefined,
                componentData: {
                    source_dimensions_mm: dimensions
                }
            });

            // 3. Request Presigned URL
            const { uploadUrl, assetId, objectKey } = await generatePresignedUrl(
                productId,
                "Component Model",
                mapped.file.name,
                mapped.file.type || "model/gltf-binary",
                componentId
            );

            // 4. PUT to R2
            const uploadRes = await fetch(uploadUrl, {
                method: "PUT",
                body: mapped.file,
                headers: { "Content-Type": mapped.file.type || "model/gltf-binary" }
            });

            if (!uploadRes.ok) {
                throw new Error(`R2 Upload failed: ${uploadRes.statusText}`);
            }

            // 5. Confirm Asset
            await confirmAssetUpload(
                productId,
                assetId,
                objectKey,
                "Component Model",
                mapped.file.name,
                mapped.file.type || "model/gltf-binary",
                mapped.file.size,
                componentId
            );

            updateMappedFile(mapped.id, { status: "success" });

        } catch (err: any) {
            console.error("Component upload failed:", err);
            updateMappedFile(mapped.id, { status: "error", errorMsg: err.message || "Upload failed" });
        }
    };

    const handleUploadAll = async () => {
        setIsUploadingAll(true);
        
        // Very basic concurrency limit (e.g., chunks of 3)
        const pending = mappedFiles.filter(m => m.status === "idle" || m.status === "error");
        
        const chunkSize = 3;
        for (let i = 0; i < pending.length; i += chunkSize) {
            const chunk = pending.slice(i, i + chunkSize);
            await Promise.all(chunk.map(processSingleUpload));
        }
        
        setIsUploadingAll(false);
    };

    const allCompleted = mappedFiles.length > 0 && mappedFiles.every(m => m.status === "success");

    return (
        <div className="flex flex-col gap-[30px]">
            <div className="flex flex-col gap-1 text-[#0f1422]">
                <h2 className="text-xl sm:text-2xl font-medium leading-tight tracking-tight">
                    Structural Components
                </h2>
                <p className="text-xs sm:text-base font-normal leading-snug text-neutral-600">
                    Upload the individual 3D parts required to construct this parametric model.
                </p>
            </div>

            {/* Dropzone */}
            <label 
                className={`w-full h-32 border-2 border-dashed rounded-[16px] flex flex-col items-center justify-center cursor-pointer transition-colors ${
                    isDragging ? "bg-[#07b6d3]/10 border-[#07b6d3]" : "bg-[#f5f5f5]/50 border-neutral-300 hover:bg-neutral-100"
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFilesAdded(e.dataTransfer.files);
                }}
            >
                <UploadCloud className="size-8 text-neutral-400 mb-2 pointer-events-none" />
                <p className="text-[#0f1422] font-medium pointer-events-none">Drag & drop multiple .glb files here</p>
                <p className="text-xs text-neutral-500 pointer-events-none">or click to browse</p>
                <input
                    type="file"
                    accept=".glb,model/gltf-binary"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFilesAdded(e.target.files)}
                />
            </label>

            {/* Mapping Table */}
            {mappedFiles.length > 0 && (
                <div className="border border-neutral-200 rounded-[12px] overflow-hidden bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-[#fcfcfc] border-b border-neutral-200 text-neutral-600 font-medium">
                                <tr>
                                    <th className="px-4 py-3">File</th>
                                    <th className="px-4 py-3">Component Key</th>
                                    <th className="px-4 py-3">Name</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Assembly Grp</th>
                                    <th className="px-4 py-3">Qty</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {mappedFiles.map((mapped) => (
                                    <tr key={mapped.id} className="hover:bg-neutral-50 transition-colors">
                                        <td className="px-4 py-3 max-w-[150px] truncate text-[#0f1422]">
                                            {mapped.file.name}
                                        </td>
                                        <td className="px-4 py-2">
                                            <input 
                                                type="text"
                                                value={mapped.componentKey}
                                                onChange={(e) => updateMappedFile(mapped.id, { componentKey: e.target.value })}
                                                disabled={mapped.status === "success"}
                                                className="w-32 border border-neutral-200 rounded-md px-2 py-1.5 text-xs outline-none focus:border-[#07b6d3] disabled:bg-neutral-100"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input 
                                                type="text"
                                                value={mapped.componentName}
                                                onChange={(e) => updateMappedFile(mapped.id, { componentName: e.target.value })}
                                                disabled={mapped.status === "success"}
                                                className="w-32 border border-neutral-200 rounded-md px-2 py-1.5 text-xs outline-none focus:border-[#07b6d3] disabled:bg-neutral-100"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <select
                                                value={mapped.componentType}
                                                onChange={(e) => updateMappedFile(mapped.id, { componentType: e.target.value as ComponentType })}
                                                disabled={mapped.status === "success"}
                                                className="w-24 border border-neutral-200 rounded-md px-2 py-1.5 text-xs outline-none focus:border-[#07b6d3] bg-white disabled:bg-neutral-100"
                                            >
                                                {COMPONENT_TYPES.map(t => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-4 py-2">
                                            <input 
                                                type="text"
                                                placeholder="e.g. static_frame"
                                                value={mapped.assemblyGroup}
                                                onChange={(e) => updateMappedFile(mapped.id, { assemblyGroup: e.target.value })}
                                                disabled={mapped.status === "success"}
                                                className="w-28 border border-neutral-200 rounded-md px-2 py-1.5 text-xs outline-none focus:border-[#07b6d3] disabled:bg-neutral-100"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input 
                                                type="number"
                                                min="1"
                                                value={mapped.baseQuantity}
                                                onChange={(e) => updateMappedFile(mapped.id, { baseQuantity: parseFloat(e.target.value) || 1 })}
                                                disabled={mapped.status === "success"}
                                                className="w-16 border border-neutral-200 rounded-md px-2 py-1.5 text-xs outline-none focus:border-[#07b6d3] disabled:bg-neutral-100"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            {mapped.status === "idle" && <span className="text-neutral-500 text-xs font-medium">Pending</span>}
                                            {mapped.status === "processing" && (
                                                <div className="flex items-center gap-1.5 text-blue-500 text-xs font-medium">
                                                    <Loader2 className="size-3 animate-spin" /> Insp...
                                                </div>
                                            )}
                                            {mapped.status === "uploading" && (
                                                <div className="flex items-center gap-1.5 text-[#07b6d3] text-xs font-medium">
                                                    <Loader2 className="size-3 animate-spin" /> Uploading...
                                                </div>
                                            )}
                                            {mapped.status === "success" && (
                                                <div className="flex items-center gap-1.5 text-green-600 text-xs font-medium">
                                                    <CheckCircle className="size-3.5" /> Done
                                                </div>
                                            )}
                                            {mapped.status === "error" && (
                                                <div className="flex items-center gap-1.5 text-red-500 text-xs font-medium" title={mapped.errorMsg}>
                                                    <AlertCircle className="size-3.5" /> Error
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button 
                                                type="button"
                                                onClick={() => removeMappedFile(mapped.id)}
                                                disabled={mapped.status === "uploading" || mapped.status === "processing"}
                                                className="text-neutral-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                            >
                                                <X className="size-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    <div className="p-4 border-t border-neutral-100 bg-[#fbfbfb] flex items-center justify-between">
                        <span className="text-sm text-neutral-500">
                            {mappedFiles.filter(m => m.status === "success").length} of {mappedFiles.length} uploaded
                        </span>
                        
                        {!allCompleted && (
                            <button
                                type="button"
                                onClick={handleUploadAll}
                                disabled={isUploadingAll}
                                className="bg-[#07b6d3] text-white px-5 py-2 rounded-[8px] hover:bg-[#06a2bc] transition-colors text-sm font-medium disabled:opacity-70 flex items-center gap-2"
                            >
                                {isUploadingAll && <Loader2 className="size-4 animate-spin" />}
                                {isUploadingAll ? "Processing..." : "Upload & Save Pending"}
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="flex justify-end pt-6 mt-2 border-t border-neutral-200">
                <button
                    type="button"
                    onClick={onSave}
                    disabled={!allCompleted && mappedFiles.length > 0}
                    className="bg-[#0f1422] text-white px-6 py-2.5 rounded-[10px] hover:bg-black transition-colors disabled:opacity-50 font-medium"
                >
                    Continue to Parameters
                </button>
            </div>
        </div>
    );
}

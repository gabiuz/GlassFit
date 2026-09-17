"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { UploadCloud, X, Loader2, CheckCircle, AlertCircle, Eye, CheckSquare, Square, Layers, Sparkles } from "lucide-react";
import { upsertProductComponent, ComponentType } from "@/lib/admin/products/componentMutations";
import { generatePresignedUrl, confirmAssetUpload } from "@/lib/admin/products/assetUpload";
import { autoDetectComponentSettings } from "@/lib/admin/products/autoDetection";
import { decomposeWholeModel, type ExtractedComponentPart } from "@/lib/admin/products/modelDecomposer";
import { DecompositionPreviewModal } from "./DecompositionPreviewModal";
import { PartInspectorDrawer, type PartInspectorConfig } from "./PartInspectorDrawer";
import { getRawMaterials } from "@/lib/admin/materials/materialActions";
import type { RawMaterial, DimensionBinding, PresentationCategory } from "@/lib/pricing/types";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage } from "@react-three/drei";
import * as THREE from "three";
import {
    classifySceneMesh,
    createWindowGlassMaterial,
} from "@/lib/visualization/materialClassifier";

export type StructuralComponentsSectionProps = {
    productId: string;
    templateId: string;
    modelStrategy: string | null;
    productType?: string;
    initialData?: unknown;
    wholeModelAsset?: {
        asset_id?: string;
        file_name?: string;
        file_url?: string;
        byte_size?: number;
    } | null;
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
    rawMaterialId: string | null;
    dimensionBinding: DimensionBinding;
    spanRatio: number;
    isRemovable: boolean;
    togglePropertyKey: string | null;
    presentationCategory: PresentationCategory;
    glbFileUrl?: string | null;
    status: "idle" | "uploading" | "processing" | "success" | "error";
    errorMsg?: string;
    previewMesh?: THREE.Group | null;
    sourceDimensions?: { x: number; y: number; z: number };
};

function formatKeyFromName(name: string) {
    return name.replace(/\.glb$/i, "").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
}

function formatLabelFromName(name: string) {
    const withoutExt = name.replace(/\.glb$/i, "");
    return withoutExt.replace(/[-_]/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

function recenterGroup(object: THREE.Object3D) {
    object.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(object);
    const center = new THREE.Vector3();
    bounds.getCenter(center);
    object.position.sub(center);
    object.updateMatrixWorld(true);
}

function getPartScale(targetMeters: number, sourceMeters: number) {
    if (!targetMeters || !sourceMeters || sourceMeters <= 0) {
        return 1;
    }
    return targetMeters / sourceMeters;
}

// 3D Canvas Multi-Part Viewer Component (Assembled Structure Preview)
function PartViewer3D({
    files,
    selectedIds,
    rawMaterials,
    productType = "Window",
    viewMode = "assembled",
    onSelectId,
}: {
    files: MappedFile[];
    selectedIds: Set<string>;
    rawMaterials: RawMaterial[];
    productType?: string;
    viewMode?: "assembled" | "exploded";
    onSelectId: (id: string, isShift: boolean) => void;
}) {
    const group = useMemo(() => {
        const root = new THREE.Group();
        root.name = "AssembledProductRoot";

        // Map files by key
        const filesByKey = new Map<string, MappedFile>();
        files.forEach((f) => {
            const normalized = f.componentKey.toLowerCase().replace(/_/g, "-");
            filesByKey.set(normalized, f);
            filesByKey.set(f.componentKey.toLowerCase(), f);
        });

        const hasLeft = filesByKey.has("frame-left");
        const hasRight = filesByKey.has("frame-right");
        const hasTop = filesByKey.has("frame-top");
        const hasBottom = filesByKey.has("frame-bottom");
        const hasGlass = filesByKey.has("glass-panel");

        // Check if models share assembly coordinates
        let isAssemblyCoords = false;
        files.forEach((f) => {
            if (f.previewMesh) {
                const box = new THREE.Box3().setFromObject(f.previewMesh);
                const center = new THREE.Vector3();
                box.getCenter(center);
                if (Math.abs(center.x) > 0.05 || Math.abs(center.y) > 0.05 || Math.abs(center.z) > 0.05) {
                    isAssemblyCoords = true;
                }
            }
        });

        const isParametricWindow =
            (productType.toLowerCase().includes("window") || (hasLeft && hasRight && hasTop && hasBottom)) &&
            !isAssemblyCoords;

        const applyPreviewMaterials = (clone: THREE.Object3D, file: MappedFile) => {
            const rawMat = rawMaterials.find((m) => m.id === file.rawMaterialId);
            clone.userData.fileId = file.id;
            clone.userData.componentKey = file.componentKey;
            clone.userData.componentName = file.componentName;
            clone.userData.componentType = file.componentType;
            clone.userData.presentationCategory = file.presentationCategory;
            clone.userData.rawMaterialId = file.rawMaterialId;
            clone.userData.rawMaterialCategory = rawMat?.category ?? null;
            clone.userData.rawMaterial = rawMat ?? null;

            clone.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.userData.fileId = file.id;
                    child.userData.componentKey = file.componentKey;
                    child.userData.componentName = file.componentName;
                    child.userData.componentType = file.componentType;
                    child.userData.presentationCategory = file.presentationCategory;
                    child.userData.rawMaterialId = file.rawMaterialId;
                    child.userData.rawMaterialCategory = rawMat?.category ?? null;
                    child.userData.rawMaterial = rawMat ?? null;

                    const classification = classifySceneMesh(child);
                    if (classification === "Glass") {
                        child.material = createWindowGlassMaterial("clear");
                    }
                }
            });
        };

        const highlightPart = (clone: THREE.Object3D, isSelected: boolean) => {
            clone.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    if (isSelected) {
                        const isGlass = classifySceneMesh(child) === "Glass";
                        if (Array.isArray(child.material)) {
                            child.material = child.material.map((mat) => {
                                const m = mat.clone();
                                if ("emissive" in m && m.emissive instanceof THREE.Color) {
                                    m.emissive.set("#07b6d3");
                                    if ("emissiveIntensity" in m) {
                                        (m as THREE.MeshStandardMaterial).emissiveIntensity = isGlass ? 0.25 : 0.45;
                                    }
                                }
                                return m;
                            });
                        } else if (child.material) {
                            const m = child.material.clone();
                            if ("emissive" in m && m.emissive instanceof THREE.Color) {
                                m.emissive.set("#07b6d3");
                                if ("emissiveIntensity" in m) {
                                    (m as THREE.MeshStandardMaterial).emissiveIntensity = isGlass ? 0.25 : 0.45;
                                }
                            }
                            child.material = m;
                        }
                    }
                }
            });
        };

        const createPreviewPart = (
            file: MappedFile,
            xM: number,
            yM: number,
            zM: number,
            targetWidthM?: number,
            targetHeightM?: number,
            targetDepthM?: number
        ) => {
            if (!file.previewMesh) return null;
            const wrapper = new THREE.Group();
            wrapper.name = file.componentKey;
            wrapper.userData.fileId = file.id;

            const clone = file.previewMesh.clone();
            applyPreviewMaterials(clone, file);
            recenterGroup(clone);
            wrapper.add(clone);

            const sourceSize = file.sourceDimensions || { x: 1, y: 1, z: 1 };
            wrapper.position.set(xM, yM, zM);
            wrapper.scale.set(
                getPartScale(targetWidthM ?? 0, sourceSize.x),
                getPartScale(targetHeightM ?? 0, sourceSize.y),
                getPartScale(targetDepthM ?? 0, sourceSize.z)
            );

            highlightPart(wrapper, selectedIds.has(file.id));
            return wrapper;
        };

        if (viewMode === "exploded") {
            // Exploded / Inspection Mode: Spread parts with clear visual separation along X
            let offsetX = 0;
            files.forEach((file) => {
                if (!file.previewMesh) return;
                const wrapper = new THREE.Group();
                wrapper.name = file.componentKey;
                wrapper.userData.fileId = file.id;

                const clone = file.previewMesh.clone();
                applyPreviewMaterials(clone, file);
                recenterGroup(clone);
                wrapper.add(clone);
                wrapper.position.set(offsetX, 0, 0);

                highlightPart(wrapper, selectedIds.has(file.id));
                root.add(wrapper);

                const size = file.sourceDimensions || { x: 0.4, y: 0.4, z: 0.4 };
                offsetX += (size.x || 0.4) + 0.15;
            });
        } else if (isParametricWindow && (hasLeft || hasRight || hasTop || hasBottom || hasGlass)) {
            // Procedural Parametric Window Assembly
            const widthM = 1.2;
            const heightM = 1.2;

            const leftF = filesByKey.get("frame-left");
            const rightF = filesByKey.get("frame-right");
            const topF = filesByKey.get("frame-top");
            const botF = filesByKey.get("frame-bottom");
            const centerF = filesByKey.get("frame-center");
            const glassF = filesByKey.get("glass-panel");
            const sillF = filesByKey.get("window-sill");

            const leftWidthM = leftF?.sourceDimensions?.x ? Math.min(0.08, leftF.sourceDimensions.x) : 0.05;
            const rightWidthM = rightF?.sourceDimensions?.x ? Math.min(0.08, rightF.sourceDimensions.x) : 0.05;
            const topHeightM = topF?.sourceDimensions?.y ? Math.min(0.08, topF.sourceDimensions.y) : 0.05;
            const botHeightM = botF?.sourceDimensions?.y ? Math.min(0.08, botF.sourceDimensions.y) : 0.05;
            const mullionWidthM = centerF?.sourceDimensions?.x ? Math.min(0.08, centerF.sourceDimensions.x) : 0.05;
            const glassDepthM = glassF?.sourceDimensions?.z ? Math.min(0.02, glassF.sourceDimensions.z) : 0.01;

            const centerQty = centerF ? (typeof centerF.baseQuantity === "number" ? centerF.baseQuantity : 1) : 0;
            const mullionCount = centerQty > 0 ? centerQty : 0;
            const paneCount = mullionCount + 1;

            const innerWidthM = widthM - leftWidthM - rightWidthM - mullionCount * mullionWidthM;
            const innerHeightM = heightM - topHeightM - botHeightM;
            const paneWidthM = Math.max(0.1, innerWidthM / paneCount);
            const horizontalFrameWidthM = widthM - leftWidthM - rightWidthM;

            // Frame Left
            if (leftF) {
                const part = createPreviewPart(leftF, -widthM / 2 + leftWidthM / 2, 0, 0, undefined, heightM);
                if (part) root.add(part);
            }

            // Frame Right
            if (rightF) {
                const part = createPreviewPart(rightF, widthM / 2 - rightWidthM / 2, 0, 0, undefined, heightM);
                if (part) root.add(part);
            }

            // Frame Top
            if (topF) {
                const part = createPreviewPart(topF, 0, heightM / 2 - topHeightM / 2, 0, horizontalFrameWidthM);
                if (part) root.add(part);
            }

            // Frame Bottom
            if (botF) {
                const part = createPreviewPart(botF, 0, -heightM / 2 + botHeightM / 2, 0, horizontalFrameWidthM);
                if (part) root.add(part);
            }

            // Center Mullions
            if (centerF && mullionCount > 0) {
                for (let i = 0; i < mullionCount; i++) {
                    const xM = -widthM / 2 + leftWidthM + paneWidthM * (i + 1) + mullionWidthM * i + mullionWidthM / 2;
                    const part = createPreviewPart(centerF, xM, 0, glassDepthM * 0.4, undefined, innerHeightM);
                    if (part) root.add(part);
                }
            }

            // Glass Panels
            if (glassF) {
                for (let i = 0; i < paneCount; i++) {
                    const xM = -widthM / 2 + leftWidthM + paneWidthM * i + mullionWidthM * i + paneWidthM / 2;
                    const part = createPreviewPart(
                        glassF,
                        xM,
                        0,
                        glassDepthM * 0.6,
                        paneWidthM - 0.01,
                        innerHeightM - 0.01,
                        glassDepthM
                    );
                    if (part) root.add(part);
                }
            }

            // Window Sill
            if (sillF && sillF.baseQuantity > 0) {
                const part = createPreviewPart(sillF, 0, -heightM / 2 - 0.04, -glassDepthM * 2, widthM);
                if (part) root.add(part);
            }

            // Other unplaced components
            const placedKeys = new Set(["frame-left", "frame-right", "frame-top", "frame-bottom", "frame-center", "glass-panel", "window-sill"]);
            let extraOffsetX = widthM / 2 + 0.2;
            files.forEach((f) => {
                const normalized = f.componentKey.toLowerCase().replace(/_/g, "-");
                if (!placedKeys.has(normalized) && f.previewMesh) {
                    const part = createPreviewPart(f, extraOffsetX, 0, 0);
                    if (part) {
                        root.add(part);
                        const s = f.sourceDimensions?.x || 0.2;
                        extraOffsetX += s + 0.15;
                    }
                }
            });
        } else {
            // Assembled (Built) View: Place each component at its modeled natural coordinates
            files.forEach((file) => {
                if (!file.previewMesh) return;
                const clone = file.previewMesh.clone();
                applyPreviewMaterials(clone, file);
                highlightPart(clone, selectedIds.has(file.id));
                root.add(clone);
            });
        }

        recenterGroup(root);
        return root;
    }, [files, selectedIds, rawMaterials, productType, viewMode]);

    return (
        <primitive
            object={group}
            onClick={(e: { stopPropagation: () => void; object: THREE.Object3D; shiftKey?: boolean }) => {
                e.stopPropagation();
                let curr: THREE.Object3D | null = e.object;
                while (curr && !curr.userData.fileId && curr.parent) {
                    curr = curr.parent;
                }
                if (curr && curr.userData.fileId) {
                    onSelectId(curr.userData.fileId, Boolean(e.shiftKey));
                }
            }}
        />
    );
}

export function StructuralComponentsSection({
    productId,
    templateId,
    modelStrategy,
    productType = "Window",
    initialData,
    wholeModelAsset,
    onSave,
}: StructuralComponentsSectionProps) {
    const [uploadMode, setUploadMode] = useState<"individual" | "assembled">("individual");
    const [viewMode, setViewMode] = useState<"assembled" | "exploded">("assembled");
    const [isDragging, setIsDragging] = useState(false);
    const [isDecomposing, setIsDecomposing] = useState(false);
    const [decompositionModalOpen, setDecompositionModalOpen] = useState(false);
    const [extractedParts, setExtractedParts] = useState<ExtractedComponentPart[]>([]);
    const [decompositionSourceFileName, setDecompositionSourceFileName] = useState("");
    const [decompositionWarnings, setDecompositionWarnings] = useState<string[]>([]);
    const [decompositionError, setDecompositionError] = useState<string | null>(null);

    const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Fetch master raw materials
    useEffect(() => {
        let mounted = true;
        getRawMaterials({ is_active: true })
            .then((mats) => {
                if (mounted) setRawMaterials(mats);
            })
            .catch((err) => console.error("Failed to load raw materials in setup:", err));
        return () => {
            mounted = false;
        };
    }, []);

    // Initialize from DB data if present
    const [mappedFiles, setMappedFiles] = useState<MappedFile[]>(() => {
        if (!initialData || !Array.isArray(initialData)) return [];
        return initialData.map((comp: Record<string, unknown>) => {
            const detected = autoDetectComponentSettings(String(comp.component_name || comp.component_key || ""));
            const compData = (comp.component_data || {}) as Record<string, unknown>;
            return {
                id: String(comp.component_id || crypto.randomUUID()),
                file: new File([], `${comp.component_key}.glb`),
                componentKey: String(comp.component_key || ""),
                componentName: String(comp.component_name || ""),
                componentType: (comp.component_type as ComponentType) || detected.componentType,
                assemblyGroup: String(compData.assembly_group || ""),
                baseQuantity: typeof comp.base_quantity === "number" ? comp.base_quantity : 1,
                rawMaterialId: (comp.raw_material_id as string) || null,
                dimensionBinding: (comp.dimension_binding as DimensionBinding) || detected.dimensionBinding,
                spanRatio: typeof comp.span_ratio === "number" ? comp.span_ratio : detected.spanRatio,
                isRemovable: typeof comp.is_removable === "boolean" ? comp.is_removable : detected.isRemovable,
                togglePropertyKey: (comp.toggle_property_key as string) || detected.togglePropertyKey,
                presentationCategory: (comp.presentation_category as PresentationCategory) || detected.presentationCategory,
                glbFileUrl: (comp.glb_file_url as string) || null,
                status: "success" as const,
            };
        });
    });

    const [prevInitialData, setPrevInitialData] = useState(initialData);
    if (initialData !== prevInitialData) {
        setPrevInitialData(initialData);
        if (Array.isArray(initialData) && initialData.length > 0) {
            setMappedFiles((prev) => {
                if (prev.length === 0) {
                    return initialData.map((comp: Record<string, unknown>) => {
                        const detected = autoDetectComponentSettings(String(comp.component_name || comp.component_key || ""));
                        const compData = (comp.component_data || {}) as Record<string, unknown>;
                        return {
                            id: String(comp.component_id || crypto.randomUUID()),
                            file: new File([], `${comp.component_key}.glb`),
                            componentKey: String(comp.component_key || ""),
                            componentName: String(comp.component_name || ""),
                            componentType: (comp.component_type as ComponentType) || detected.componentType,
                            assemblyGroup: String(compData.assembly_group || ""),
                            baseQuantity: typeof comp.base_quantity === "number" ? comp.base_quantity : 1,
                            rawMaterialId: (comp.raw_material_id as string) || null,
                            dimensionBinding: (comp.dimension_binding as DimensionBinding) || detected.dimensionBinding,
                            spanRatio: typeof comp.span_ratio === "number" ? comp.span_ratio : detected.spanRatio,
                            isRemovable: typeof comp.is_removable === "boolean" ? comp.is_removable : detected.isRemovable,
                            togglePropertyKey: (comp.toggle_property_key as string) || detected.togglePropertyKey,
                            presentationCategory: (comp.presentation_category as PresentationCategory) || detected.presentationCategory,
                            glbFileUrl: (comp.glb_file_url as string) || null,
                            status: "success" as const,
                        };
                    });
                }
                // Merge glbFileUrl and rawMaterialId if updated remotely
                return prev.map((item) => {
                    const found = initialData.find((c: Record<string, unknown>) => c.component_key === item.componentKey || c.component_id === item.id);
                    if (found) {
                        return {
                            ...item,
                            glbFileUrl: item.glbFileUrl || (found.glb_file_url as string) || null,
                            rawMaterialId: item.rawMaterialId !== undefined && item.status !== "success" ? item.rawMaterialId : (found.raw_material_id as string) || item.rawMaterialId,
                        };
                    }
                    return item;
                });
            });
        }
    }

    // Load preview meshes for initial files that have remote glb URLs or need local loading
    useEffect(() => {
        let isCancelled = false;
        const pendingItems = mappedFiles.filter(item => !item.previewMesh && item.glbFileUrl);

        if (pendingItems.length === 0) return;

        import("three/addons/loaders/GLTFLoader.js").then(({ GLTFLoader }) => {
            const loader = new GLTFLoader();
            pendingItems.forEach((item) => {
                loader.load(
                    item.glbFileUrl!,
                    (gltf) => {
                        if (isCancelled) return;
                        const box = new THREE.Box3().setFromObject(gltf.scene);
                        const size = new THREE.Vector3();
                        box.getSize(size);
                        setMappedFiles((prev) =>
                            prev.map((m) =>
                                m.id === item.id
                                    ? {
                                        ...m,
                                        previewMesh: gltf.scene,
                                        sourceDimensions: { x: size.x, y: size.y, z: size.z },
                                    }
                                    : m
                            )
                        );
                    },
                    undefined,
                    (err) => console.warn("Could not load preview mesh for component:", item.componentKey, err)
                );
            });
        }).catch((err) => console.warn("Could not load GLTFLoader:", err));

        return () => {
            isCancelled = true;
        };
    }, [mappedFiles]);

    const [isUploadingAll, setIsUploadingAll] = useState(false);

    const handleFilesAdded = async (files: FileList | null) => {
        if (!files) return;

        const glbFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith(".glb"));

        const newMappedPromises = glbFiles.map(async (f) => {
            const autoDetected = autoDetectComponentSettings(f.name);
            let previewMesh: THREE.Group | null = null;
            let dims = { x: 1, y: 1, z: 1 };

            try {
                const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
                const url = URL.createObjectURL(f);
                const loader = new GLTFLoader();
                const gltf = await loader.loadAsync(url);
                previewMesh = gltf.scene;
                const box = new THREE.Box3().setFromObject(gltf.scene);
                const size = new THREE.Vector3();
                box.getSize(size);
                dims = { x: size.x, y: size.y, z: size.z };
                URL.revokeObjectURL(url);
            } catch (err) {
                console.warn("Could not parse GLB preview locally:", err);
            }

            return {
                id: crypto.randomUUID(),
                file: f,
                componentKey: formatKeyFromName(f.name),
                componentName: formatLabelFromName(f.name),
                componentType: autoDetected.componentType,
                assemblyGroup: autoDetected.presentationCategory.toLowerCase(),
                baseQuantity: 1,
                rawMaterialId: null,
                dimensionBinding: autoDetected.dimensionBinding,
                spanRatio: autoDetected.spanRatio,
                isRemovable: autoDetected.isRemovable,
                togglePropertyKey: autoDetected.togglePropertyKey,
                presentationCategory: autoDetected.presentationCategory,
                previewMesh,
                status: "idle" as const,
                sourceDimensions: dims,
            };
        });

        const newMapped = await Promise.all(newMappedPromises);
        setMappedFiles(prev => [...prev, ...newMapped]);
        if (newMapped.length > 0 && selectedIds.size === 0) {
            setSelectedIds(new Set([newMapped[0].id]));
        }
    };

    const handleAssembledFileAdded = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        if (!file.name.toLowerCase().endsWith(".glb")) {
            setDecompositionError("Please upload a valid .glb 3D model file.");
            return;
        }

        setIsDecomposing(true);
        setDecompositionError(null);

        try {
            const result = await decomposeWholeModel(file);

            if (!result.success) {
                setDecompositionError(result.error || "Failed to decompose 3D model.");
                setIsDecomposing(false);
                return;
            }

            setExtractedParts(result.extractedParts);
            setDecompositionSourceFileName(file.name);
            setDecompositionWarnings(result.warnings);
            setDecompositionModalOpen(true);
        } catch (err: unknown) {
            console.error("Model decomposition error:", err);
            const msg = err instanceof Error ? err.message : "Failed to decompose model.";
            setDecompositionError(msg);
        } finally {
            setIsDecomposing(false);
        }
    };

    const handleDecomposeFromCatalogAsset = async () => {
        if (!wholeModelAsset?.file_url) return;
        setIsDecomposing(true);
        setDecompositionError(null);

        try {
            const res = await fetch(wholeModelAsset.file_url);
            if (!res.ok) throw new Error("Could not download whole 3D model asset from Step 3.");
            const buffer = await res.arrayBuffer();
            const result = await decomposeWholeModel(buffer, { minBoundingDimensionMeters: 0.005 });

            if (!result.success) {
                setDecompositionError(result.error || "Failed to decompose whole 3D model.");
                setIsDecomposing(false);
                return;
            }

            setExtractedParts(result.extractedParts);
            setDecompositionSourceFileName(wholeModelAsset.file_name || "whole_model.glb");
            setDecompositionWarnings(result.warnings);
            setDecompositionModalOpen(true);
        } catch (err: unknown) {
            console.error("Model decomposition error:", err);
            const msg = err instanceof Error ? err.message : "Failed to decompose whole model.";
            setDecompositionError(msg);
        } finally {
            setIsDecomposing(false);
        }
    };

    const handleApplyExtractedParts = (selectedParts: ExtractedComponentPart[]) => {
        const newMapped: MappedFile[] = selectedParts.map((part) => ({
            id: part.id || crypto.randomUUID(),
            file: part.file,
            componentKey: part.componentKey,
            componentName: part.componentName,
            componentType: part.componentType,
            assemblyGroup: part.presentationCategory.toLowerCase(),
            baseQuantity: part.baseQuantity || 1,
            rawMaterialId: null,
            dimensionBinding: part.dimensionBinding,
            spanRatio: part.spanRatio,
            isRemovable: part.isRemovable,
            togglePropertyKey: part.togglePropertyKey,
            presentationCategory: part.presentationCategory,
            glbFileUrl: null,
            status: "idle" as const,
            previewMesh: part.previewMesh,
            sourceDimensions: {
                x: part.dimensionsMm.width / 1000,
                y: part.dimensionsMm.height / 1000,
                z: part.dimensionsMm.depth / 1000,
            },
        }));

        setMappedFiles((prev) => [...prev, ...newMapped]);
        if (newMapped.length > 0) {
            setSelectedIds(new Set([newMapped[0].id]));
        }
        setDecompositionModalOpen(false);
    };

    const updateMappedFile = (id: string, updates: Partial<MappedFile>) => {
        setMappedFiles(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
    };

    const handleSelectPart = (id: string, isShift: boolean) => {
        setSelectedIds(prev => {
            const next = new Set(isShift ? prev : []);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleBatchUpdateSelected = (updates: Partial<PartInspectorConfig>) => {
        setMappedFiles(prev =>
            prev.map(item => {
                if (selectedIds.has(item.id)) {
                    return {
                        ...item,
                        ...(updates.rawMaterialId !== undefined && { rawMaterialId: updates.rawMaterialId }),
                        ...(updates.dimensionBinding !== undefined && { dimensionBinding: updates.dimensionBinding }),
                        ...(updates.spanRatio !== undefined && { spanRatio: updates.spanRatio }),
                        ...(updates.isRemovable !== undefined && { isRemovable: updates.isRemovable }),
                        ...(updates.togglePropertyKey !== undefined && { togglePropertyKey: updates.togglePropertyKey }),
                        ...(updates.presentationCategory !== undefined && { presentationCategory: updates.presentationCategory }),
                        ...(updates.baseQuantity !== undefined && { baseQuantity: updates.baseQuantity }),
                        ...(updates.assemblyGroup !== undefined && { assemblyGroup: updates.assemblyGroup }),
                        status: "idle" as const,
                    };
                }
                return item;
            })
        );
    };

    const removeMappedFile = (id: string) => {
        setMappedFiles(prev => prev.filter(m => m.id !== id));
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    const processSingleUpload = async (mapped: MappedFile) => {
        updateMappedFile(mapped.id, { status: "processing" });

        try {
            // 1. Inspect GLB dynamically to avoid SSR issues
            const THREE = await import("three");
            const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");

            let dimensions = mapped.sourceDimensions || { x: 1, y: 1, z: 1 };
            if (mapped.file.size > 0) {
                const url = URL.createObjectURL(mapped.file);
                const loader = new GLTFLoader();
                const gltf = await loader.loadAsync(url);
                const box = new THREE.Box3().setFromObject(gltf.scene);
                const size = new THREE.Vector3();
                box.getSize(size);
                URL.revokeObjectURL(url);
                dimensions = { x: size.x, y: size.y, z: size.z };
            }

            updateMappedFile(mapped.id, { status: "uploading" });

            // 2. Upsert Component in DB with all MS-3 fields
            const componentId = await upsertProductComponent({
                templateId,
                componentKey: mapped.componentKey,
                componentName: mapped.componentName,
                componentType: mapped.componentType,
                baseQuantity: mapped.baseQuantity,
                rawMaterialId: mapped.rawMaterialId,
                dimensionBinding: mapped.dimensionBinding,
                spanRatio: mapped.spanRatio,
                isRemovable: mapped.isRemovable,
                togglePropertyKey: mapped.togglePropertyKey,
                presentationCategory: mapped.presentationCategory,
                assemblyGroup: mapped.assemblyGroup || undefined,
                glbFileUrl: mapped.glbFileUrl || undefined,
                componentData: {
                    source_dimensions_mm: dimensions
                }
            });

            // 3. Request Presigned URL & upload only if file has content
            if (mapped.file.size > 0) {
                const { uploadUrl, assetId, objectKey } = await generatePresignedUrl(
                    productId,
                    "Component Model",
                    mapped.file.name,
                    mapped.file.type || "model/gltf-binary",
                    componentId
                );

                const uploadRes = await fetch(uploadUrl, {
                    method: "PUT",
                    body: mapped.file,
                    headers: { "Content-Type": mapped.file.type || "model/gltf-binary" }
                });

                if (!uploadRes.ok) {
                    throw new Error(`R2 Upload failed: ${uploadRes.statusText}`);
                }

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
            }

            updateMappedFile(mapped.id, { status: "success" });

        } catch (err: unknown) {
            console.error("Component upload failed:", err);
            const msg = err instanceof Error ? err.message : "Upload failed";
            updateMappedFile(mapped.id, { status: "error", errorMsg: msg });
        }
    };

    const handleUploadAll = async () => {
        setIsUploadingAll(true);
        const pending = mappedFiles.filter(m => m.status === "idle" || m.status === "error");

        const chunkSize = 3;
        for (let i = 0; i < pending.length; i += chunkSize) {
            const chunk = pending.slice(i, i + chunkSize);
            await Promise.all(chunk.map(processSingleUpload));
        }

        setIsUploadingAll(false);
    };

    const hasPendingChanges = mappedFiles.some(m => m.status === "idle" || m.status === "error");

    const handleContinue = async () => {
        const pending = mappedFiles.filter(m => m.status === "idle" || m.status === "error");
        if (pending.length > 0) {
            setIsUploadingAll(true);
            const chunkSize = 3;
            for (let i = 0; i < pending.length; i += chunkSize) {
                const chunk = pending.slice(i, i + chunkSize);
                await Promise.all(chunk.map(processSingleUpload));
            }
            setIsUploadingAll(false);
        }
        onSave();
    };

    // Convert selected mapped files to PartInspectorConfig
    const selectedPartConfigs: PartInspectorConfig[] = useMemo(() => {
        return mappedFiles
            .filter(m => selectedIds.has(m.id))
            .map(m => ({
                id: m.id,
                componentKey: m.componentKey,
                componentName: m.componentName,
                componentType: m.componentType,
                rawMaterialId: m.rawMaterialId,
                dimensionBinding: m.dimensionBinding,
                spanRatio: m.spanRatio,
                isRemovable: m.isRemovable,
                togglePropertyKey: m.togglePropertyKey,
                presentationCategory: m.presentationCategory,
                baseQuantity: m.baseQuantity,
                assemblyGroup: m.assemblyGroup,
            }));
    }, [mappedFiles, selectedIds]);

    // If it is fixed, skip structural components setup
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
                    className="mt-6 bg-[#0f1422] text-white px-6 py-2.5 rounded-[10px] hover:bg-black transition-colors font-medium cursor-pointer"
                >
                    Continue to Next Step
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-[24px]">
            <div className="flex flex-col gap-1 text-[#0f1422]">
                <h2 className="text-xl sm:text-2xl font-medium leading-tight tracking-tight">
                    Structural Components & Part Inspector
                </h2>
                <p className="text-xs sm:text-base font-normal leading-snug text-neutral-600">
                    Upload 3D part meshes (.glb), inspect dimensional bindings, link catalog raw materials, and configure parametric formulas.
                </p>
            </div>

            {/* Step 3 Whole Model Auto-Ingestion Banner */}
            {wholeModelAsset?.file_url && (
                <div className="bg-gradient-to-r from-sky-50 via-cyan-50 to-blue-50 border border-[#07b6d3]/30 rounded-[16px] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[12px] bg-[#07b6d3] text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Sparkles className="size-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold text-[#0f1422]">Whole 3D Model Detected (from Step 3)</h4>
                                <span className="px-2 py-0.5 rounded-full bg-white text-[#07b6d3] text-[10px] font-mono font-medium border border-[#07b6d3]/20">
                                    {wholeModelAsset.file_name || "Whole Model GLB"}
                                </span>
                            </div>
                            <p className="text-xs text-neutral-600 mt-0.5">
                                Automatically unpack structural components directly from your catalog model with 100% geometry, texture, and coordinate parity.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleDecomposeFromCatalogAsset}
                        disabled={isDecomposing}
                        className="bg-[#0f1422] text-white hover:bg-black px-4 py-2 rounded-[10px] text-xs font-semibold transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                        {isDecomposing ? <Loader2 className="size-3.5 animate-spin" /> : <Layers className="size-3.5 text-[#07b6d3]" />}
                        {isDecomposing ? "Unpacking Model..." : "Extract Components from Whole Model"}
                    </button>
                </div>
            )}

            {/* Ingestion Mode Segmented Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="bg-slate-100 p-1.5 rounded-[14px] inline-flex border border-neutral-200">
                    <button
                        type="button"
                        onClick={() => setUploadMode("individual")}
                        className={`px-3.5 py-1.5 rounded-[10px] text-xs transition-all font-medium cursor-pointer ${uploadMode === "individual"
                                ? "bg-white shadow-xs text-slate-900 font-semibold"
                                : "text-slate-500 hover:text-slate-900"
                            }`}
                    >
                        Upload Individual Parts
                    </button>
                    <button
                        type="button"
                        onClick={() => setUploadMode("assembled")}
                        className={`px-3.5 py-1.5 rounded-[10px] text-xs transition-all font-medium cursor-pointer flex items-center gap-1.5 ${uploadMode === "assembled"
                                ? "bg-white shadow-xs text-slate-900 font-semibold"
                                : "text-slate-500 hover:text-slate-900"
                            }`}
                    >
                        <Layers className="size-3.5 text-[#07b6d3]" />
                        Decompose Whole Model
                    </button>
                </div>
                <span className="text-xs text-neutral-500 hidden sm:inline">
                    {uploadMode === "individual"
                        ? "Upload standalone profile and glass .glb files directly"
                        : "Upload an assembled .glb model and unpack parts automatically"}
                </span>
            </div>

            {/* Error Notification Banner */}
            {decompositionError && (
                <div className="p-4 rounded-[14px] bg-amber-50 border border-amber-200 text-amber-900 flex items-start justify-between gap-3 animate-in fade-in duration-200">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-xs space-y-1">
                            <p className="font-semibold text-amber-950">Model Decomposition Notice</p>
                            <p className="text-amber-800">{decompositionError}</p>
                            <div className="pt-1.5 text-[11px] text-amber-700 space-y-0.5">
                                <p className="font-medium">Recommended next steps:</p>
                                <ul className="list-disc list-inside space-y-0.5 ml-1">
                                    <li>Switch to &quot;Upload Individual Parts&quot; mode to drop individual .glb files.</li>
                                    <li>Export the 3D model from CAD/Blender with separate named objects (do not join meshes).</li>
                                    <li>If this product is non-parametric, configure it as a Fixed Whole Model in Step 1.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setDecompositionError(null)}
                        className="text-amber-600 hover:text-amber-900 p-1 rounded-md hover:bg-amber-100 transition-colors"
                    >
                        <X className="size-4" />
                    </button>
                </div>
            )}

            {/* Dropzone - Individual Parts Mode */}
            {uploadMode === "individual" && (
                <label
                    className={`w-full h-28 border-2 border-dashed rounded-[16px] flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragging ? "bg-[#07b6d3]/10 border-[#07b6d3]" : "bg-[#f5f5f5]/50 border-neutral-300 hover:bg-neutral-100"
                        }`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                    onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        handleFilesAdded(e.dataTransfer.files);
                    }}
                >
                    <UploadCloud className="size-7 text-neutral-400 mb-1.5 pointer-events-none" />
                    <p className="text-[#0f1422] font-medium text-sm pointer-events-none">Drag & drop multiple .glb parts here</p>
                    <p className="text-[11px] text-neutral-500 pointer-events-none">Auto-detects Series 798 heads, sills, jambs, rails, glass & rollers</p>
                    <input
                        type="file"
                        accept=".glb,model/gltf-binary"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFilesAdded(e.target.files)}
                    />
                </label>
            )}

            {/* Dropzone - Whole Model Decomposition Mode */}
            {uploadMode === "assembled" && (
                <label
                    className={`w-full min-h-32 border-2 border-dashed rounded-[16px] flex flex-col items-center justify-center p-5 cursor-pointer transition-colors ${isDragging ? "bg-[#07b6d3]/10 border-[#07b6d3]" : "bg-[#f0f9ff]/40 border-[#07b6d3]/40 hover:bg-[#07b6d3]/10"
                        }`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                    onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        handleAssembledFileAdded(e.dataTransfer.files);
                    }}
                >
                    {isDecomposing ? (
                        <div className="flex flex-col items-center justify-center py-2 text-center pointer-events-none">
                            <Loader2 className="size-8 text-[#07b6d3] animate-spin mb-2" />
                            <p className="text-sm font-semibold text-[#0f1422]">Unpacking scene graph and extracting structural parts...</p>
                            <p className="text-xs text-neutral-500 mt-1">Isolating sub-meshes, recentering geometries, and synthesizing GLB blobs in memory</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center text-center pointer-events-none">
                            <div className="w-10 h-10 rounded-full bg-[#07b6d3]/15 text-[#07b6d3] flex items-center justify-center mb-2">
                                <Layers className="size-5" />
                            </div>
                            <p className="text-[#0f1422] font-semibold text-sm">Upload Assembled Product GLB</p>
                            <p className="text-xs text-neutral-600 max-w-md mt-0.5">
                                Drop a complete 3D model containing separated, named components. GlassFit will automatically unpack each structural element.
                            </p>
                            <span className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white text-neutral-600 text-[10px] font-mono border border-neutral-200 shadow-2xs">
                                <Sparkles className="size-3 text-[#07b6d3]" /> Format: .GLB (glTF 2.0 Binary) with named nodes
                            </span>
                        </div>
                    )}
                    <input
                        type="file"
                        accept=".glb,model/gltf-binary"
                        disabled={isDecomposing}
                        className="hidden"
                        onChange={(e) => handleAssembledFileAdded(e.target.files)}
                    />
                </label>
            )}

            {/* Quick Material Mapping Summary Banner */}
            {mappedFiles.length > 0 && (
                <div className="bg-gradient-to-r from-neutral-900 to-[#0f1422] text-white p-4 rounded-[16px] flex flex-wrap items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-6 text-xs sm:text-sm">
                        <div>
                            <span className="text-neutral-400 block text-[11px]">Total Parts</span>
                            <span className="font-semibold text-white">{mappedFiles.length} Components</span>
                        </div>
                        <div className="h-8 w-px bg-neutral-800" />
                        <div>
                            <span className="text-neutral-400 block text-[11px]">Catalog Linked</span>
                            <span className="font-semibold text-[#07b6d3]">
                                {mappedFiles.filter(m => m.rawMaterialId).length} of {mappedFiles.length} Linked
                            </span>
                        </div>
                        <div className="h-8 w-px bg-neutral-800" />
                        <div>
                            <span className="text-neutral-400 block text-[11px]">Toggleable (Sill)</span>
                            <span className="font-semibold text-amber-400">
                                {mappedFiles.filter(m => m.isRemovable).length} Removable
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-neutral-400 block text-[11px]">BOM Estimation Status</span>
                        <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                            Ready for Test-Drive Simulator (Step 6)
                        </span>
                    </div>
                </div>
            )}

            {/* Split Screen 60/40 Layout */}
            {mappedFiles.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 border border-neutral-200 rounded-[16px] overflow-hidden bg-white shadow-sm min-h-[500px]">
                    {/* Left Side: 3D Viewport (60% / 7 cols) */}
                    <div className="lg:col-span-7 bg-[#f2f4f7] relative min-h-[380px] lg:min-h-full flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-neutral-200">
                        <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-medium text-neutral-700 shadow-xs border border-neutral-200 flex items-center gap-1.5">
                            <Eye className="size-3.5 text-[#07b6d3]" /> Click part to inspect (Shift+Click for multi-select)
                        </div>

                        <div className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur-md p-1 rounded-[10px] inline-flex border border-neutral-200 shadow-xs">
                            <button
                                type="button"
                                onClick={() => setViewMode("assembled")}
                                className={`px-2.5 py-1 rounded-[6px] text-xs transition-all font-medium cursor-pointer ${viewMode === "assembled"
                                        ? "bg-[#0f1422] text-white shadow-2xs"
                                        : "text-neutral-600 hover:text-neutral-900"
                                    }`}
                            >
                                Assembled (Built)
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("exploded")}
                                className={`px-2.5 py-1 rounded-[6px] text-xs transition-all font-medium cursor-pointer ${viewMode === "exploded"
                                        ? "bg-[#0f1422] text-white shadow-2xs"
                                        : "text-neutral-600 hover:text-neutral-900"
                                    }`}
                            >
                                Exploded (Separated)
                            </button>
                        </div>

                        <div className="w-full h-full min-h-[360px] flex-1">
                            <Canvas shadows camera={{ position: [0, 1.5, 3], fov: 45 }}>
                                <ambientLight intensity={0.7} />
                                <directionalLight position={[5, 8, 5]} intensity={1.2} />
                                <Suspense fallback={null}>
                                    <Stage environment="city" adjustCamera={false}>
                                        <PartViewer3D
                                            files={mappedFiles}
                                            selectedIds={selectedIds}
                                            rawMaterials={rawMaterials}
                                            productType={productType}
                                            viewMode={viewMode}
                                            onSelectId={handleSelectPart}
                                        />
                                    </Stage>
                                </Suspense>
                                <OrbitControls makeDefault />
                            </Canvas>
                        </div>

                        <div className="p-3 bg-white/90 border-t border-neutral-200/80 backdrop-blur-sm flex items-center justify-between text-xs text-neutral-500">
                            <span>{mappedFiles.length} parts mapped ({selectedIds.size} selected)</span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedIds(new Set(mappedFiles.map(m => m.id)))}
                                    className="text-[#07b6d3] font-medium hover:underline text-xs"
                                >
                                    Select All
                                </button>
                                <span className="text-neutral-300">|</span>
                                <button
                                    type="button"
                                    onClick={() => setSelectedIds(new Set())}
                                    className="text-neutral-500 font-medium hover:underline text-xs"
                                >
                                    Clear Selection
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Part Inspector Drawer (40% / 5 cols) */}
                    <div className="lg:col-span-5 bg-white flex flex-col h-full min-h-[460px]">
                        <PartInspectorDrawer
                            selectedParts={selectedPartConfigs}
                            rawMaterials={rawMaterials}
                            onUpdateParts={handleBatchUpdateSelected}
                            onDeselect={() => setSelectedIds(new Set())}
                        />
                    </div>
                </div>
            )}

            {/* Component Summary List / Batch Table */}
            {mappedFiles.length > 0 && (
                <div className="border border-neutral-200 rounded-[12px] overflow-hidden bg-white shadow-sm">
                    <div className="p-3 bg-[#fcfcfc] border-b border-neutral-200 flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-neutral-800 uppercase tracking-wider">
                            Uploaded Components ({mappedFiles.length})
                        </h3>
                        <div className="flex items-center gap-3">
                            {hasPendingChanges && (
                                <button
                                    type="button"
                                    onClick={handleUploadAll}
                                    disabled={isUploadingAll}
                                    className="bg-[#07b6d3] text-white px-4 py-1.5 rounded-[8px] hover:bg-[#06a2bc] transition-colors text-xs font-medium disabled:opacity-70 flex items-center gap-1.5 shadow-xs cursor-pointer"
                                >
                                    {isUploadingAll && <Loader2 className="size-3.5 animate-spin" />}
                                    {isUploadingAll ? "Saving..." : "Save Component Changes"}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-[#f9fafb] border-b border-neutral-200 text-neutral-500 font-medium">
                                <tr>
                                    <th className="px-3 py-2 w-8">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (selectedIds.size === mappedFiles.length) setSelectedIds(new Set());
                                                else setSelectedIds(new Set(mappedFiles.map(m => m.id)));
                                            }}
                                            className="text-neutral-500 hover:text-neutral-700"
                                        >
                                            {selectedIds.size === mappedFiles.length && mappedFiles.length > 0 ? (
                                                <CheckSquare className="size-4 text-[#07b6d3]" />
                                            ) : (
                                                <Square className="size-4" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="px-3 py-2">Component Name</th>
                                    <th className="px-3 py-2">Driver</th>
                                    <th className="px-3 py-2">Span Ratio</th>
                                    <th className="px-3 py-2">Material Link</th>
                                    <th className="px-3 py-2">Removable</th>
                                    <th className="px-3 py-2">Status</th>
                                    <th className="px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {mappedFiles.map((mapped) => {
                                    const isSelected = selectedIds.has(mapped.id);
                                    const mat = rawMaterials.find(m => m.id === mapped.rawMaterialId);

                                    return (
                                        <tr
                                            key={mapped.id}
                                            onClick={() => handleSelectPart(mapped.id, false)}
                                            className={`hover:bg-neutral-50 cursor-pointer transition-colors ${isSelected ? "bg-[#07b6d3]/5" : ""
                                                }`}
                                        >
                                            <td className="px-3 py-2" onClick={(e) => { e.stopPropagation(); handleSelectPart(mapped.id, true); }}>
                                                {isSelected ? (
                                                    <CheckSquare className="size-4 text-[#07b6d3]" />
                                                ) : (
                                                    <Square className="size-4 text-neutral-400" />
                                                )}
                                            </td>
                                            <td className="px-3 py-2 font-medium text-[#0f1422]">
                                                <div>{mapped.componentName}</div>
                                                <div className="text-[10px] text-neutral-400 font-mono">{mapped.componentKey}</div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className="px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 font-mono text-[10px]">
                                                    {mapped.dimensionBinding}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 font-mono text-neutral-600">
                                                {mapped.spanRatio.toFixed(2)}x
                                            </td>
                                            <td className="px-3 py-2 max-w-[180px] truncate text-neutral-600">
                                                {mat ? (
                                                    <span title={mat.description} className="text-[#07b6d3] font-medium">
                                                        {mat.material_code}
                                                    </span>
                                                ) : (
                                                    <span className="text-neutral-400 italic">Unassigned</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                {mapped.isRemovable ? (
                                                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px] font-medium border border-amber-200">
                                                        {mapped.togglePropertyKey || "Toggleable"}
                                                    </span>
                                                ) : (
                                                    <span className="text-neutral-400 text-[11px]">Fixed</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                {mapped.status === "idle" && <span className="text-amber-600 font-medium text-xs">Unsaved</span>}
                                                {mapped.status === "processing" && (
                                                    <span className="flex items-center gap-1 text-blue-500 text-xs">
                                                        <Loader2 className="size-3 animate-spin" /> Saving
                                                    </span>
                                                )}
                                                {mapped.status === "uploading" && (
                                                    <span className="flex items-center gap-1 text-[#07b6d3] text-xs">
                                                        <Loader2 className="size-3 animate-spin" /> Uploading
                                                    </span>
                                                )}
                                                {mapped.status === "success" && (
                                                    <span className="flex items-center gap-1 text-green-600 text-xs">
                                                        <CheckCircle className="size-3" /> Ready
                                                    </span>
                                                )}
                                                {mapped.status === "error" && (
                                                    <span className="flex items-center gap-1 text-red-500 text-xs" title={mapped.errorMsg}>
                                                        <AlertCircle className="size-3" /> Error
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); removeMappedFile(mapped.id); }}
                                                    className="text-neutral-400 hover:text-red-500 transition-colors"
                                                >
                                                    <X className="size-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div className="flex justify-end pt-6 mt-2 border-t border-neutral-200">
                <button
                    type="button"
                    onClick={handleContinue}
                    disabled={isUploadingAll}
                    className="bg-[#0f1422] text-white px-6 py-2.5 rounded-[10px] hover:bg-black transition-colors disabled:opacity-50 font-medium text-sm flex items-center gap-2 cursor-pointer"
                >
                    {isUploadingAll && <Loader2 className="size-4 animate-spin" />}
                    {isUploadingAll ? "Saving Changes..." : "Continue to Parameters & Rules"}
                </button>
            </div>

            {/* Whole-Model Decomposition Review Drawer / Modal */}
            <DecompositionPreviewModal
                isOpen={decompositionModalOpen}
                sourceFileName={decompositionSourceFileName}
                parts={extractedParts}
                warnings={decompositionWarnings}
                onClose={() => setDecompositionModalOpen(false)}
                onApplyParts={handleApplyExtractedParts}
            />
        </div>
    );
}

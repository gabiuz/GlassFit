"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { UploadCloud, X, Loader2, CheckCircle, AlertCircle, Eye, CheckSquare, Square, Layers, Sparkles } from "lucide-react";
import { upsertProductComponent, deleteProductComponent } from "@/lib/admin/products/componentMutations";
import type { ComponentType, AccessoryCategory, AccessoryPositionOptions } from "@/lib/admin/products/types";
import { generatePresignedUrl, confirmAssetUpload, hasQualifyingProductModelAsset, deleteProductAssets } from "@/lib/admin/products/assetUpload";
import { getComponentIssues, getProductComponentIssue } from "@/lib/admin/products/componentEligibility";
import type { UpsertComponentInput } from "@/lib/admin/products/types";
import { autoDetectComponentSettings, suggestCandidateMaterials, isContinuousPerimeterRole } from "@/lib/admin/products/autoDetection";
import { decomposeWholeModel, type ExtractedComponentPart } from "@/lib/admin/products/modelDecomposer";
import { DecompositionPreviewModal } from "./DecompositionPreviewModal";
import { PartInspectorDrawer, type PartInspectorConfig } from "./PartInspectorDrawer";
import { analyzeGrilleGeometry, type GrilleGeometryAnalysis } from "@/lib/pricing/grilleGeometryAnalyzer";
import { analyzeJalousieGeometry } from "@/lib/visualization/jalousieGeometryAnalyzer";
import { getRawMaterials } from "@/lib/admin/materials/materialActions";
import type { RawMaterial, DimensionBinding, PresentationCategory, ComponentMaterialBinding, JalousieConfig, DynamicBayRole } from "@/lib/pricing/types";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { Html, OrbitControls, Stage } from "@react-three/drei";
import * as THREE from "three";
import {
    classifySceneMesh,
    createWindowGlassMaterial,
} from "@/lib/visualization/materialClassifier";
import { mirrorObjectHierarchyAcrossX, exportMirroredGlb, mirrorPartAcrossCenterline } from "@/lib/admin/products/meshMirroring";
import { updateProductAccessoryCategory } from "@/lib/admin/products/productMutations";
import type { ComponentHandingMetadata } from "@/lib/admin/products/types";
import { getR2AssetUrl } from "@/lib/r2";
import { getFrontPartIds, getVisiblePartHits } from "@/lib/admin/products/partPicking";

export type StructuralComponentsSectionProps = {
    productId: string;
    templateId: string;
    modelStrategy: string | null;
    productType?: string;
    productName?: string;
    initialData?: unknown;
    wholeModelAsset?: {
        asset_id?: string;
        file_name?: string;
        file_url?: string;
        byte_size?: number;
    } | null;
    isAccessory?: boolean;
    isAddon?: boolean;
    initialAccessoryCategory?: AccessoryCategory | null;
    productBasePrice?: number;
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
    materialBindings?: ComponentMaterialBinding[];
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
    persisted?: boolean;
    isAccessorySlot?: boolean;
    accessoryCategory?: AccessoryCategory | null;
    allowedAccessoryIds?: string[] | null;
    positionOptions?: AccessoryPositionOptions | null;
    unitPrice?: number;
    pricingMethod?: string;
    handingMetadata?: ComponentHandingMetadata | null;
    jalousieConfig?: JalousieConfig | null;
    bayRole?: DynamicBayRole | null;
    bay_role?: DynamicBayRole | null;
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

function extractComponentBindings(comp: Record<string, unknown>): ComponentMaterialBinding[] {
    const rawPcm = Array.isArray(comp.product_component_materials) ? comp.product_component_materials : [];
    if (rawPcm.length > 0) {
        return rawPcm.map((b: Record<string, unknown>, idx: number) => ({
            id: b.id as string | undefined,
            componentId: (b.product_component_id || comp.component_id) as string | undefined,
            rawMaterialId: String(b.raw_material_id || ""),
            isDefault: Boolean(b.is_default),
            displayOrder: typeof b.display_order === "number" ? b.display_order : idx,
        }));
    }
    if (comp.raw_material_id) {
        return [{
            rawMaterialId: String(comp.raw_material_id),
            isDefault: true,
            displayOrder: 0,
        }];
    }
    return [];
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
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [overlapChoice, setOverlapChoice] = useState<{ ids: string[]; point: THREE.Vector3 } | null>(null);
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

        const highlightPart = (clone: THREE.Object3D, isSelected: boolean, isHovered: boolean) => {
            const selectedMeshes: THREE.Mesh[] = [];
            clone.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    if (isSelected || isHovered) {
                        selectedMeshes.push(child);
                    }
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
            for (const mesh of selectedMeshes) {
                const outline = new THREE.LineSegments(
                    new THREE.EdgesGeometry(mesh.geometry, 25),
                    new THREE.LineBasicMaterial({ color: isSelected ? "#0f1422" : "#07b6d3", depthTest: false, transparent: true, opacity: 0.95 }),
                );
                // Visual outlines must never become picking targets. Three.js line
                // raycasts use a broad world-space threshold that can capture a
                // click over neighboring glass or narrow framing members.
                outline.raycast = () => {};
                outline.renderOrder = 100;
                outline.scale.setScalar(1.004);
                mesh.add(outline);
            }
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
            const isFixed = file.dimensionBinding === "FIXED";
            wrapper.scale.set(
                isFixed ? 1 : getPartScale(targetWidthM ?? 0, sourceSize.x),
                isFixed ? 1 : getPartScale(targetHeightM ?? 0, sourceSize.y),
                isFixed ? 1 : getPartScale(targetDepthM ?? 0, sourceSize.z)
            );

            highlightPart(wrapper, selectedIds.has(file.id), hoveredId === file.id);
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

                highlightPart(wrapper, selectedIds.has(file.id), hoveredId === file.id);
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
            // Identify accessory slots and measure host geometry bounds to resolve lateral center
            const accessorySlotIds = new Set<string>();
            const hostBox = new THREE.Box3();
            let hasHostGeom = false;

            files.forEach((f) => {
                const compIdentity = (
                    f.componentKey +
                    " " +
                    f.componentName +
                    " " +
                    (f.componentType || "") +
                    " " +
                    (f.presentationCategory || "")
                ).toLowerCase();

                const isSlot = Boolean(
                    f.isAccessorySlot ||
                    Boolean(f.accessoryCategory) ||
                    compIdentity.includes("handle") ||
                    compIdentity.includes("knob") ||
                    compIdentity.includes("lever") ||
                    compIdentity.includes("smartlock") ||
                    compIdentity.includes("lock")
                );

                if (isSlot) {
                    accessorySlotIds.add(f.id);
                } else if (f.previewMesh) {
                    hostBox.expandByObject(f.previewMesh);
                    hasHostGeom = true;
                }
            });

            const hostCenterVec = new THREE.Vector3();
            if (hasHostGeom) {
                hostBox.getCenter(hostCenterVec);
            }

            files.forEach((file) => {
                if (!file.previewMesh) return;
                const clone = file.previewMesh.clone();

                if (accessorySlotIds.has(file.id)) {
                    // Measure modeled handle bounds to determine natural modeled side
                    clone.updateMatrixWorld(true);
                    const origBox = new THREE.Box3().setFromObject(clone);
                    const origCenter = new THREE.Vector3();
                    origBox.getCenter(origCenter);

                    const baseCenterX = hasHostGeom ? hostCenterVec.x : 0;
                    const deltaX = origCenter.x - baseCenterX;
                    const modeledHanding: "left" | "right" = deltaX >= 0 ? "right" : "left";
                    const targetHanding: "left" | "right" = file.positionOptions?.defaultHorizontal || modeledHanding;

                    if (targetHanding === modeledHanding) {
                        applyPreviewMaterials(clone, file);
                        highlightPart(clone, selectedIds.has(file.id), hoveredId === file.id);
                        root.add(clone);
                    } else {
                        // Mirrored across lateral center: preserves exact same Y axis and Z depth (IMP-MS78)
                        const mirrored = mirrorPartAcrossCenterline(clone, baseCenterX, targetHanding);
                        applyPreviewMaterials(mirrored, file);
                        highlightPart(mirrored, selectedIds.has(file.id), hoveredId === file.id);
                        root.add(mirrored);
                    }
                } else {
                    applyPreviewMaterials(clone, file);
                    highlightPart(clone, selectedIds.has(file.id), hoveredId === file.id);
                    root.add(clone);
                }
            });
        }

        recenterGroup(root);
        return root;
    }, [files, selectedIds, hoveredId, rawMaterials, productType, viewMode]);

    return (
        <>
        <primitive
            object={group}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => {
                setHoveredId(getVisiblePartHits(e.intersections)[0]?.id ?? null);
            }}
            onPointerOut={() => setHoveredId(null)}
            onClick={(e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                const ids = getFrontPartIds(e.intersections);
                if (ids.length > 1) {
                    setOverlapChoice({ ids, point: e.point.clone() });
                } else if (ids.length === 1) {
                    setOverlapChoice(null);
                    onSelectId(ids[0], e.shiftKey);
                }
            }}
        />
        {overlapChoice && <Html position={overlapChoice.point} center>
            <div className="min-w-40 rounded-lg border border-neutral-200 bg-white p-2 text-xs shadow-lg" role="group" aria-label="Choose overlapping part">
                <p className="mb-1 font-semibold text-[#0f1422]">Choose part</p>
                {overlapChoice.ids.map(id => <button key={id} type="button" onClick={() => { onSelectId(id, false); setOverlapChoice(null); }} className="block w-full rounded px-2 py-1 text-left text-neutral-700 hover:bg-neutral-100">{files.find(file => file.id === id)?.componentName || id}</button>)}
            </div>
        </Html>}
        </>
    );
}

function ViewerCameraControls({ action }: { action: { kind: "fit" | "reset" | "front"; serial: number } | null }) {
    const { camera, scene, controls, invalidate } = useThree();
    useEffect(() => {
        if (!action) return;
        const bounds = new THREE.Box3().setFromObject(scene.getObjectByName("AssembledProductRoot") || scene);
        if (bounds.isEmpty()) return;
        const center = bounds.getCenter(new THREE.Vector3());
        const radius = Math.max(bounds.getSize(new THREE.Vector3()).length() * 0.8, 1.5);
        camera.position.set(center.x + (action.kind === "front" ? 0 : radius * 0.65), center.y + (action.kind === "front" ? 0 : radius * 0.35), center.z + radius);
        camera.lookAt(center);
        camera.updateProjectionMatrix();
        const orbit = controls as { target?: THREE.Vector3; update?: () => void } | undefined;
        orbit?.target?.copy(center);
        orbit?.update?.();
        invalidate();
    }, [action, camera, controls, invalidate, scene]);
    return null;
}

export function StructuralComponentsSection({
    productId,
    templateId,
    modelStrategy,
    productType = "Window",
    productName,
    initialData,
    wholeModelAsset,
    isAccessory = false,
    isAddon = false,
    initialAccessoryCategory = null,
    productBasePrice,
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

    const [selectedHanding, setSelectedHanding] = useState<"right" | "left">(() => {
        if (Array.isArray(initialData) && initialData.length > 0) {
            const firstData = (initialData[0] as Record<string, unknown>)?.component_data as Record<string, unknown> | undefined;
            const meta = firstData?.handing_metadata as ComponentHandingMetadata | undefined;
            if (meta?.sourceHanding === "left" || meta?.sourceHanding === "right") {
                return meta.sourceHanding;
            }
        }
        return "right";
    });

    const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [removedFiles, setRemovedFiles] = useState<MappedFile[]>([]);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveState, setSaveState] = useState<"clean" | "dirty" | "saving" | "saved" | "error">("clean");
    const [partSearch, setPartSearch] = useState("");
    const [showIssuesOnly, setShowIssuesOnly] = useState(false);
    const [cameraAction, setCameraAction] = useState<{ kind: "fit" | "reset" | "front"; serial: number } | null>(null);
    const [showUpload, setShowUpload] = useState(false);
    const [uploadErrors, setUploadErrors] = useState<string[]>([]);
    const eligibilityContext = { modelStrategy, isAccessory, isAddon };
    const issuesForPart = (part: MappedFile) => getComponentIssues({
        pricingMethod: part.pricingMethod,
        unitPrice: part.unitPrice,
        dimensionBinding: part.dimensionBinding,
        rawMaterialId: part.rawMaterialId,
        materialBindings: part.materialBindings,
        isAccessorySlot: part.isAccessorySlot,
        hasModelPreview: Boolean(part.glbFileUrl || part.previewMesh),
    }, eligibilityContext);
    const hasPartIssue = (part: MappedFile) => part.status !== "success" || issuesForPart(part).length > 0;

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
            const bindings = extractComponentBindings(comp);
            const defaultBinding = bindings.find(b => b.isDefault);
            const rawMaterialId = defaultBinding ? defaultBinding.rawMaterialId : (comp.raw_material_id as string) || null;
            const existingPrice = typeof comp.unit_price === "number" ? comp.unit_price : (comp.unit_price ? Number(comp.unit_price) : undefined);
            const resolvedUnitPrice = existingPrice !== undefined ? existingPrice : (isAccessory ? productBasePrice : undefined);
            const resolvedPricingMethod = (comp.pricing_method as string) || (isAccessory ? "Fixed" : (typeof resolvedUnitPrice === "number" && resolvedUnitPrice > 0 ? "Fixed" : undefined));

            return {
                id: String(comp.component_id || crypto.randomUUID()),
                file: new File([], `${comp.component_key}.glb`),
                componentKey: String(comp.component_key || ""),
                componentName: String(comp.component_name || ""),
                componentType: (comp.component_type as ComponentType) || detected.componentType,
                assemblyGroup: String(compData.assembly_group || ""),
                baseQuantity: typeof comp.base_quantity === "number" ? comp.base_quantity : 1,
                rawMaterialId,
                materialBindings: bindings,
                dimensionBinding: (comp.dimension_binding as DimensionBinding) || (isAccessory ? "FIXED" : detected.dimensionBinding),
                spanRatio: typeof comp.span_ratio === "number" ? comp.span_ratio : detected.spanRatio,
                isRemovable: isAccessory ? true : (typeof comp.is_removable === "boolean" ? comp.is_removable : detected.isRemovable),
                togglePropertyKey: (comp.toggle_property_key as string) || detected.togglePropertyKey,
                presentationCategory: (comp.presentation_category as PresentationCategory) || detected.presentationCategory,
                glbFileUrl: (comp.glb_file_url as string) || null,
                isAccessorySlot: isAccessory ? false : (typeof comp.is_accessory_slot === "boolean" ? comp.is_accessory_slot : Boolean(detected.isAccessorySlot)),
                accessoryCategory: (comp.accessory_category as AccessoryCategory) || (compData.accessory_category as AccessoryCategory) || (initialAccessoryCategory as AccessoryCategory) || detected.accessoryCategory || (isAccessory ? "handle" : null),
                allowedAccessoryIds: (comp.allowed_accessory_ids as string[]) || [],
                positionOptions: (comp.position_options as AccessoryPositionOptions) || detected.positionOptions || null,
                unitPrice: resolvedUnitPrice,
                pricingMethod: resolvedPricingMethod,
                handingMetadata: (compData.handing_metadata as ComponentHandingMetadata) || null,
                jalousieConfig: ((comp.jalousie_config || compData.jalousie_config) as JalousieConfig) || null,
                bayRole: ((comp.bay_role || compData.bay_role) as DynamicBayRole) || detected.bayRole || null,
                sourceDimensions: compData.source_dimensions_mm as { x: number; y: number; z: number } | undefined,
                persisted: true,
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
                        const bindings = extractComponentBindings(comp);
                        const defaultBinding = bindings.find(b => b.isDefault);
                        const rawMaterialId = defaultBinding ? defaultBinding.rawMaterialId : (comp.raw_material_id as string) || null;
                        return {
                            id: String(comp.component_id || crypto.randomUUID()),
                            file: new File([], `${comp.component_key}.glb`),
                            componentKey: String(comp.component_key || ""),
                            componentName: String(comp.component_name || ""),
                            componentType: (comp.component_type as ComponentType) || detected.componentType,
                            assemblyGroup: String(compData.assembly_group || ""),
                            baseQuantity: typeof comp.base_quantity === "number" ? comp.base_quantity : 1,
                            rawMaterialId,
                            materialBindings: bindings,
                            dimensionBinding: (comp.dimension_binding as DimensionBinding) || (isAccessory ? "FIXED" : detected.dimensionBinding),
                            spanRatio: typeof comp.span_ratio === "number" ? comp.span_ratio : detected.spanRatio,
                            isRemovable: isAccessory ? true : (typeof comp.is_removable === "boolean" ? comp.is_removable : detected.isRemovable),
                            togglePropertyKey: (comp.toggle_property_key as string) || detected.togglePropertyKey,
                            presentationCategory: (comp.presentation_category as PresentationCategory) || detected.presentationCategory,
                            glbFileUrl: (comp.glb_file_url as string) || null,
                            isAccessorySlot: isAccessory ? false : (typeof comp.is_accessory_slot === "boolean" ? comp.is_accessory_slot : Boolean(detected.isAccessorySlot)),
                            accessoryCategory: (comp.accessory_category as AccessoryCategory) || (compData.accessory_category as AccessoryCategory) || (initialAccessoryCategory as AccessoryCategory) || detected.accessoryCategory || (isAccessory ? "handle" : null),
                            allowedAccessoryIds: (comp.allowed_accessory_ids as string[]) || [],
                            positionOptions: (comp.position_options as AccessoryPositionOptions) || detected.positionOptions || null,
                            unitPrice: (() => {
                                const ep = typeof comp.unit_price === "number" ? comp.unit_price : (comp.unit_price ? Number(comp.unit_price) : undefined);
                                return ep !== undefined ? ep : (isAccessory ? productBasePrice : undefined);
                            })(),
                            pricingMethod: (comp.pricing_method as string) || (isAccessory ? "Fixed" : (typeof comp.unit_price === "number" && comp.unit_price > 0 ? "Fixed" : undefined)),
                            handingMetadata: (compData.handing_metadata as ComponentHandingMetadata) || null,
                            jalousieConfig: ((comp.jalousie_config || compData.jalousie_config) as JalousieConfig) || null,
                            sourceDimensions: compData.source_dimensions_mm as { x: number; y: number; z: number } | undefined,
                            persisted: true,
                            status: "success" as const,
                        };
                    });
                }
                // Merge glbFileUrl, rawMaterialId, and materialBindings if updated remotely
                return prev.map((item) => {
                    const found = initialData.find((c: Record<string, unknown>) => c.component_key === item.componentKey || c.component_id === item.id);
                    if (found) {
                        const foundBindings = extractComponentBindings(found);
                        const defaultBinding = foundBindings.find(b => b.isDefault);
                        const nextRawMatId = defaultBinding ? defaultBinding.rawMaterialId : (found.raw_material_id as string) || null;
                        const foundData = (found.component_data || {}) as Record<string, unknown>;
                        const foundPrice = typeof found.unit_price === "number" ? found.unit_price : (found.unit_price ? Number(found.unit_price) : item.unitPrice);
                        const resolvedUnitPrice = foundPrice !== undefined ? foundPrice : (isAccessory ? productBasePrice : undefined);
                        const resolvedPricingMethod = (found.pricing_method as string) || (isAccessory ? "Fixed" : item.pricingMethod);
                        return {
                            ...item,
                            glbFileUrl: (found.glb_file_url as string) || item.glbFileUrl,
                            rawMaterialId: nextRawMatId ?? item.rawMaterialId,
                            materialBindings: foundBindings.length > 0 ? foundBindings : item.materialBindings,
                            unitPrice: resolvedUnitPrice,
                            pricingMethod: resolvedPricingMethod,
                            handingMetadata: (foundData.handing_metadata as ComponentHandingMetadata) || item.handingMetadata,
                            isAccessorySlot: typeof found.is_accessory_slot === "boolean" ? found.is_accessory_slot : item.isAccessorySlot,
                            accessoryCategory: (found.accessory_category as AccessoryCategory) || item.accessoryCategory,
                            allowedAccessoryIds: (found.allowed_accessory_ids as string[]) || item.allowedAccessoryIds,
                            positionOptions: (found.position_options as AccessoryPositionOptions) || item.positionOptions,
                            jalousieConfig: ((found.jalousie_config || foundData.jalousie_config) as JalousieConfig) || item.jalousieConfig,
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
        const rejected = Array.from(files).filter(f => !f.name.toLowerCase().endsWith(".glb"));
        setUploadErrors(rejected.map(f => `${f.name}: only .glb files are supported.`));
        const glbFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith(".glb"));

        const newMappedPromises = glbFiles.map(async (f) => {
            const autoDetected = autoDetectComponentSettings(f.name);
            let previewMesh: THREE.Group | null = null;
            let dims: { x: number; y: number; z: number } | undefined;
            let parseError: string | undefined;

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
                parseError = err instanceof Error ? err.message : "Could not parse GLB geometry.";
            }

            const isJalousieEligibleProduct =
                productType.toLowerCase().includes("jalousie") ||
                productType.toLowerCase().includes("louver") ||
                f.name.toLowerCase().includes("jalousie") ||
                f.name.toLowerCase().includes("louver") ||
                f.name.toLowerCase().includes("blade") ||
                f.name.toLowerCase().includes("operator") ||
                f.name.toLowerCase().includes("crank") ||
                f.name.toLowerCase().includes("rotopers") ||
                f.name.toLowerCase().includes("clips_and_glass");

            const jalousieAnalysis = (previewMesh && isJalousieEligibleProduct)
                ? analyzeJalousieGeometry(previewMesh, f.name)
                : null;
            const isJalousie = Boolean(jalousieAnalysis && (jalousieAnalysis.isLouverBlade || jalousieAnalysis.isLouverOperator));
            const resolvedBinding = (isAccessory
                ? "FIXED"
                : (isJalousie
                    ? jalousieAnalysis!.suggestedBinding
                    : (modelStrategy === "Fixed"
                        ? "FIXED"
                        : autoDetected.dimensionBinding))) as DimensionBinding;
            const resolvedBaseQty = isJalousie ? jalousieAnalysis!.suggestedBaseQuantity : 1;
            const resolvedPresentation = isJalousie ? jalousieAnalysis!.suggestedPresentationCategory : autoDetected.presentationCategory;
            const suggested = suggestCandidateMaterials(resolvedPresentation, rawMaterials, undefined, resolvedBinding, { productType, productName, modelStrategy });
            const jalousieConfig = isJalousie ? {
                pitch_mm: jalousieAnalysis!.pitchMm,
                blade_height_mm: jalousieAnalysis!.bladeHeightMm,
                blades_per_operator: jalousieAnalysis!.bladesPerOperator,
                base_blade_count: jalousieAnalysis!.louverCount,
                base_operator_count: jalousieAnalysis!.operatorCount,
            } : null;

            return {
                id: crypto.randomUUID(),
                file: f,
                componentKey: formatKeyFromName(f.name),
                componentName: autoDetected.componentLabel || formatLabelFromName(f.name),
                componentType: isJalousie ? (jalousieAnalysis!.isLouverBlade ? "Glass" : "Hardware") : autoDetected.componentType,
                assemblyGroup: resolvedPresentation.toLowerCase(),
                baseQuantity: resolvedBaseQty,
                rawMaterialId: isAccessory ? null : suggested.defaultRawMaterialId,
                materialBindings: isAccessory ? [] : suggested.materialBindings.map(b => ({
                    rawMaterialId: b.rawMaterialId,
                    isDefault: b.isDefault,
                    displayOrder: b.displayOrder,
                })),
                dimensionBinding: resolvedBinding,
                spanRatio: modelStrategy === "Fixed" ? 1.0 : autoDetected.spanRatio,
                isRemovable: isAccessory ? true : autoDetected.isRemovable,
                togglePropertyKey: autoDetected.togglePropertyKey,
                presentationCategory: resolvedPresentation,
                previewMesh,
                status: parseError ? "error" as const : "idle" as const,
                errorMsg: parseError,
                sourceDimensions: dims,
                isAccessorySlot: isAccessory ? false : (isJalousie ? (jalousieAnalysis?.isLouverOperator ? Boolean(autoDetected.isAccessorySlot) : false) : Boolean(autoDetected.isAccessorySlot)),
                accessoryCategory: isAccessory ? (initialAccessoryCategory || autoDetected.accessoryCategory || "handle") : (isJalousie ? (jalousieAnalysis?.isLouverOperator ? (autoDetected.accessoryCategory || "handle") : null) : (autoDetected.accessoryCategory || null)),
                allowedAccessoryIds: [],
                positionOptions: autoDetected.positionOptions || null,
                unitPrice: isAccessory ? productBasePrice : undefined,
                pricingMethod: (isAccessory || (modelStrategy === "Fixed" && !isJalousie)) ? "Fixed" : undefined,
                handingMetadata: null,
                jalousieConfig,
                bayRole: autoDetected.bayRole || null,
            };
        });

        const newMapped = await Promise.all(newMappedPromises);
        setMappedFiles(prev => [...prev, ...newMapped]);
        if (newMapped.length) setSaveState("dirty");
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
        const newMapped: MappedFile[] = selectedParts.map((part) => {
            const suggested = suggestCandidateMaterials(part.presentationCategory, rawMaterials, undefined, part.dimensionBinding, { productType, productName, modelStrategy });
            return {
                id: part.id || crypto.randomUUID(),
                file: part.file,
                componentKey: part.componentKey,
                componentName: autoDetectComponentSettings(part.componentKey).componentLabel || part.componentName,
                componentType: part.componentType,
                assemblyGroup: part.presentationCategory.toLowerCase(),
                baseQuantity: part.baseQuantity || 1,
                rawMaterialId: isAccessory ? null : suggested.defaultRawMaterialId,
                materialBindings: isAccessory ? [] : suggested.materialBindings.map(b => ({
                    rawMaterialId: b.rawMaterialId,
                    isDefault: b.isDefault,
                    displayOrder: b.displayOrder,
                })),
                dimensionBinding: isAccessory ? "FIXED" : part.dimensionBinding,
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
                isAccessorySlot: Boolean(part.isAccessorySlot),
                accessoryCategory: part.accessoryCategory || null,
                allowedAccessoryIds: [],
                positionOptions: part.positionOptions || null,
                unitPrice: isAccessory ? productBasePrice : undefined,
                pricingMethod: (isAccessory || modelStrategy === "Fixed") ? "Fixed" : undefined,
                handingMetadata: null,
            };
        });

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
            if (!isShift) return new Set([id]);
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleBatchUpdateSelected = (updates: Partial<PartInspectorConfig>) => {
        setSaveState("dirty");
        setMappedFiles(prev =>
            prev.map(item => {
                if (selectedIds.has(item.id)) {
                    let nextBindings = item.materialBindings;
                    let nextRawMaterialId = item.rawMaterialId;

                    if (updates.materialBindings !== undefined) {
                        nextBindings = updates.materialBindings;
                        const def = nextBindings.find(b => b.isDefault);
                        nextRawMaterialId = def ? def.rawMaterialId : null;
                    } else if (updates.rawMaterialId !== undefined) {
                        nextRawMaterialId = updates.rawMaterialId;
                    }

                    return {
                        ...item,
                        rawMaterialId: nextRawMaterialId,
                        materialBindings: nextBindings,
                        ...(updates.dimensionBinding !== undefined && { dimensionBinding: updates.dimensionBinding }),
                        ...(updates.spanRatio !== undefined && { spanRatio: updates.spanRatio }),
                        ...(updates.isRemovable !== undefined && { isRemovable: updates.isRemovable }),
                        ...(updates.togglePropertyKey !== undefined && { togglePropertyKey: updates.togglePropertyKey }),
                        ...(updates.presentationCategory !== undefined && { presentationCategory: updates.presentationCategory }),
                        ...(updates.baseQuantity !== undefined && { baseQuantity: isContinuousPerimeterRole(updates.bayRole ?? item.bayRole) ? Math.min(2, Math.max(1, updates.baseQuantity)) : updates.baseQuantity }),
                        ...(updates.assemblyGroup !== undefined && { assemblyGroup: updates.assemblyGroup }),
                        ...(updates.isAccessorySlot !== undefined && { isAccessorySlot: updates.isAccessorySlot }),
                        ...("accessoryCategory" in updates ? { accessoryCategory: updates.accessoryCategory } : {}),
                        ...(updates.allowedAccessoryIds !== undefined && { allowedAccessoryIds: updates.allowedAccessoryIds }),
                        ...(updates.positionOptions !== undefined && { positionOptions: updates.positionOptions }),
                        ...("unitPrice" in updates ? { unitPrice: updates.unitPrice } : {}),
                        ...(updates.pricingMethod !== undefined && { pricingMethod: updates.pricingMethod }),
                        ...("jalousieConfig" in updates ? { jalousieConfig: updates.jalousieConfig } : {}),
                        ...("bayRole" in updates ? { bayRole: updates.bayRole } : {}),
                        status: "idle" as const,
                    };
                }
                return item;
            })
        );

        if (isAccessory && updates.accessoryCategory && productId && productId !== "draft") {
            updateProductAccessoryCategory(productId, updates.accessoryCategory).catch((err) => {
                console.error("Failed to sync accessory category to product:", err);
            });
        }
    };

    const handleSyncAssemblyGroup = (
        assemblyGroup: string,
        bindings: ComponentMaterialBinding[],
        defaultMaterialId: string | null
    ) => {
        if (!assemblyGroup) return;
        setSaveState("dirty");
        setMappedFiles(prev =>
            prev.map(item => {
                if (item.assemblyGroup.toLowerCase() === assemblyGroup.toLowerCase()) {
                    return {
                        ...item,
                        materialBindings: bindings,
                        rawMaterialId: defaultMaterialId,
                        status: "idle" as const,
                    };
                }
                return item;
            })
        );
    };

    const removeMappedFile = (id: string) => {
        const removed = mappedFiles.find(m => m.id === id);
        if (removed) setRemovedFiles(prev => [...prev, removed]);
        setMappedFiles(prev => prev.filter(m => m.id !== id));
        setSaveState("dirty");
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    const processSingleUpload = async (mapped: MappedFile): Promise<{ name: string; success: boolean; error?: string }> => {
        updateMappedFile(mapped.id, { status: "processing" });

        try {
            // 1. Inspect GLB dynamically to avoid SSR issues
            const THREE = await import("three");
            const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");

            let dimensions = mapped.sourceDimensions;
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
            if (!dimensions && !mapped.glbFileUrl) throw new Error("GLB geometry could not be verified.");

            updateMappedFile(mapped.id, { status: "uploading" });

            // FIX13-V5: use one complete payload for initial and post-upload persistence.
            const buildPayload = (glbFileUrl: string | null, handingMetadata = mapped.handingMetadata): UpsertComponentInput => ({
                templateId,
                componentKey: mapped.componentKey,
                componentName: mapped.componentName,
                componentType: mapped.componentType,
                baseQuantity: mapped.baseQuantity,
                rawMaterialId: mapped.rawMaterialId,
                materialBindings: mapped.materialBindings?.map(binding => ({
                    rawMaterialId: binding.rawMaterialId,
                    isDefault: binding.isDefault,
                    displayOrder: binding.displayOrder,
                })),
                dimensionBinding: mapped.dimensionBinding,
                spanRatio: mapped.spanRatio,
                isRemovable: mapped.isRemovable,
                togglePropertyKey: mapped.togglePropertyKey,
                presentationCategory: mapped.presentationCategory,
                assemblyGroup: mapped.assemblyGroup || undefined,
                glbFileUrl,
                componentData: {
                    ...(dimensions ? { source_dimensions_mm: dimensions } : {}),
                    ...(handingMetadata ? { handing_metadata: handingMetadata } : {}),
                    ...(mapped.accessoryCategory ? { accessory_category: mapped.accessoryCategory } : {}),
                    ...(mapped.jalousieConfig ? { jalousie_config: mapped.jalousieConfig } : {}),
                    ...(mapped.bayRole ? { bay_role: mapped.bayRole } : {}),
                },
                isAccessorySlot: mapped.isAccessorySlot,
                accessoryCategory: mapped.accessoryCategory,
                allowedAccessoryIds: mapped.allowedAccessoryIds,
                positionOptions: mapped.positionOptions || undefined,
                unitPrice: mapped.unitPrice !== undefined ? mapped.unitPrice : (isAccessory ? productBasePrice : undefined),
                pricingMethod: mapped.pricingMethod || (isAccessory ? "Fixed" : undefined),
                handingMetadata,
                jalousieConfig: mapped.jalousieConfig || undefined,
                bayRole: mapped.bayRole || undefined,
                bay_role: mapped.bayRole || undefined,
            });
            const payload = buildPayload(mapped.glbFileUrl || null);
            if (isAccessory && (!Number.isFinite(payload.unitPrice) || (payload.unitPrice ?? 0) <= 0)) {
                throw new Error("Accessory unit price is missing. Set a positive price before saving.");
            }

            // Object storage and PostgreSQL have separate commit boundaries. Upload first.
            let primaryGlbUrl = mapped.glbFileUrl || "";
            let stagedAsset: { assetId: string; objectKey: string } | null = null;
            if (mapped.file.size > 0) {
                const { uploadUrl, assetId, objectKey } = await generatePresignedUrl(
                    productId, "Component Model", mapped.file.name, mapped.file.type || "model/gltf-binary"
                );
                const uploadRes = await fetch(uploadUrl, {
                    method: "PUT",
                    body: mapped.file,
                    headers: { "Content-Type": mapped.file.type || "model/gltf-binary" },
                });
                if (!uploadRes.ok) throw new Error(`R2 upload failed: ${uploadRes.statusText}`);
                stagedAsset = { assetId, objectKey };
                primaryGlbUrl = getR2AssetUrl(objectKey) || "";
                if (!primaryGlbUrl) throw new Error("Uploaded model URL could not be resolved.");
            }

            let componentId: string;
            try {
                componentId = await upsertProductComponent(buildPayload(primaryGlbUrl || null));
            } catch (saveError) {
                if (stagedAsset) {
                    try { await deleteProductAssets([stagedAsset.objectKey]); }
                    catch (cleanupError) { console.error("Staged component asset cleanup failed:", cleanupError); }
                }
                throw saveError;
            }
            if (stagedAsset) {
                await confirmAssetUpload(
                    productId, stagedAsset.assetId, stagedAsset.objectKey, "Component Model",
                    mapped.file.name, mapped.file.type || "model/gltf-binary", mapped.file.size, componentId
                );
            }

            // 4. Bilateral Handing Mesh Mirroring for hardware accessories (IMP-MS78)
            if (isAccessory && mapped.previewMesh) {
                try {
                    const mirroredMesh = mirrorObjectHierarchyAcrossX(mapped.previewMesh);
                    const mirroredFile = await exportMirroredGlb(mirroredMesh, `mirrored_${mapped.file.name}`);
                    const { uploadUrl: mirrorUploadUrl, assetId: mirrorAssetId, objectKey: mirrorObjectKey } = await generatePresignedUrl(
                        productId,
                        "Component Model",
                        mirroredFile.name,
                        mirroredFile.type || "model/gltf-binary",
                        componentId
                    );

                    const mirrorRes = await fetch(mirrorUploadUrl, {
                        method: "PUT",
                        body: mirroredFile,
                        headers: { "Content-Type": mirroredFile.type || "model/gltf-binary" }
                    });

                    if (mirrorRes.ok) {
                        await confirmAssetUpload(
                            productId,
                            mirrorAssetId,
                            mirrorObjectKey,
                            "Component Model",
                            mirroredFile.name,
                            mirroredFile.type || "model/gltf-binary",
                            mirroredFile.size,
                            componentId
                        );
                        const mirroredGlbUrl = getR2AssetUrl(mirrorObjectKey) || "";

                        const finalHandingMetadata: ComponentHandingMetadata = {
                            sourceHanding: selectedHanding,
                            uploadedGlbUrl: primaryGlbUrl,
                            leftGlbUrl: selectedHanding === "left" ? primaryGlbUrl : mirroredGlbUrl,
                            rightGlbUrl: selectedHanding === "right" ? primaryGlbUrl : mirroredGlbUrl,
                            mirroredAt: new Date().toISOString(),
                        };

                        await upsertProductComponent(buildPayload(primaryGlbUrl, finalHandingMetadata));

                        updateMappedFile(mapped.id, { handingMetadata: finalHandingMetadata });
                    }
                } catch (mirrorErr) {
                    throw new Error(`Accessory handing model could not be saved: ${mirrorErr instanceof Error ? mirrorErr.message : "Unknown error"}`);
                }
            }

            updateMappedFile(mapped.id, { status: "success", persisted: true, glbFileUrl: primaryGlbUrl || mapped.glbFileUrl });

            if (isAccessory && mapped.accessoryCategory && productId && productId !== "draft") {
                try {
                    await updateProductAccessoryCategory(productId, mapped.accessoryCategory);
                } catch {
                    // Ignore background sync errors
                }
            }

            return { name: mapped.componentName, success: true };

        } catch (err: unknown) {
            console.error("Component upload failed:", err);
            const msg = err instanceof Error ? err.message : "Upload failed";
            updateMappedFile(mapped.id, { status: "error", errorMsg: msg });
            return { name: mapped.componentName, success: false, error: msg };
        }
    };

    const handleUploadAll = async (): Promise<boolean> => {
        setIsUploadingAll(true);
        setSaveState("saving");
        setSaveError(null);
        const pending = mappedFiles.filter(m => m.status === "idle" || m.status === "error");
        const results: { name: string; success: boolean; error?: string }[] = [];
        const chunkSize = 3;
        for (let i = 0; i < pending.length; i += chunkSize) {
            const chunk = pending.slice(i, i + chunkSize);
            results.push(...await Promise.all(chunk.map(processSingleUpload)));
        }
        const successfullyRemoved: string[] = [];
        for (const removed of removedFiles) {
            if (removed.persisted) {
                try {
                    await deleteProductComponent(templateId, removed.componentKey);
                    successfullyRemoved.push(removed.id);
                } catch (error) {
                    results.push({ name: removed.componentName, success: false, error: error instanceof Error ? error.message : "Delete failed" });
                }
            } else successfullyRemoved.push(removed.id);
        }
        setRemovedFiles(previous => previous.filter(item => !successfullyRemoved.includes(item.id)));
        const failures = results.filter(result => !result.success);
        if (failures.length) {
            setSaveError(failures.map(result => `${result.name}: ${result.error}`).join("; "));
            setSaveState("error");
        } else {
            setSaveState("saved");
        }
        setIsUploadingAll(false);
        return failures.length === 0;
    };

    const hasPendingChanges = removedFiles.length > 0 || mappedFiles.some(m => m.status === "idle" || m.status === "error");

    const handleContinue = async () => {
        if (hasPendingChanges && !(await handleUploadAll())) return;
        let hasQualifyingModelAsset = false;
        try {
            hasQualifyingModelAsset = await hasQualifyingProductModelAsset(productId);
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : "Could not verify product model asset.");
            setSaveState("error");
            return;
        }
        const productIssue = getProductComponentIssue({ ...eligibilityContext, componentsCount: mappedFiles.length, hasQualifyingModelAsset });
        const partIssues = mappedFiles.flatMap(part => issuesForPart(part).map(issue => `${part.componentName}: ${issue}`));
        if (productIssue || partIssues.length) {
            setSaveError([productIssue, ...partIssues].filter(Boolean).join("; "));
            setSaveState("error");
            return;
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
                materialBindings: m.materialBindings || (m.rawMaterialId ? [{ rawMaterialId: m.rawMaterialId, isDefault: true, displayOrder: 0 }] : []),
                dimensionBinding: m.dimensionBinding,
                spanRatio: m.spanRatio,
                isRemovable: m.isRemovable,
                togglePropertyKey: m.togglePropertyKey,
                presentationCategory: m.presentationCategory,
                baseQuantity: m.baseQuantity,
                assemblyGroup: m.assemblyGroup,
                isAccessorySlot: m.isAccessorySlot,
                accessoryCategory: m.accessoryCategory,
                allowedAccessoryIds: m.allowedAccessoryIds,
                positionOptions: m.positionOptions,
                unitPrice: m.unitPrice,
                pricingMethod: m.pricingMethod,
                jalousieConfig: m.jalousieConfig,
                bayRole: m.bayRole,
            }));
    }, [mappedFiles, selectedIds]);

    const analyzedGrilleData = useMemo((): GrilleGeometryAnalysis | null => {
        const primary = selectedPartConfigs[0];
        if (!primary || primary.dimensionBinding !== "GRILLE_LINEAR") return null;
        const matchingFile = mappedFiles.find((m) => m.id === primary.id);
        if (!matchingFile?.previewMesh) return null;
        try {
            return analyzeGrilleGeometry(matchingFile.previewMesh, 1200, 1200);
        } catch {
            return null;
        }
    }, [selectedPartConfigs, mappedFiles]);

    const primaryFile = mappedFiles[0];
    const leftPreviewMesh = useMemo(() => {
        if (!primaryFile?.previewMesh) return null;
        if (selectedHanding === "left") {
            return primaryFile.previewMesh.clone();
        }
        return mirrorObjectHierarchyAcrossX(primaryFile.previewMesh);
    }, [primaryFile, selectedHanding]);

    const rightPreviewMesh = useMemo(() => {
        if (!primaryFile?.previewMesh) return null;
        if (selectedHanding === "right") {
            return primaryFile.previewMesh.clone();
        }
        return mirrorObjectHierarchyAcrossX(primaryFile.previewMesh);
    }, [primaryFile, selectedHanding]);

    return (
        <div className="flex flex-col gap-[24px]">
            <div className="flex flex-col gap-1 text-[#0f1422]">
                <h2 className="text-xl sm:text-2xl font-medium leading-tight tracking-tight">
                    {modelStrategy === "Fixed" ? "Fixed Model Components & Pricing" : "Structural Components & Part Inspector"}
                </h2>
                <p className="text-xs sm:text-base font-normal leading-snug text-neutral-600">
                    {modelStrategy === "Fixed"
                        ? "Upload constituent 3D part meshes (.glb) and assign fixed prices (PHP) to each part without raw material extrusion formulas."
                        : "Upload 3D part meshes (.glb), inspect dimensional bindings, link catalog raw materials, and configure parametric formulas."}
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

            {mappedFiles.length > 0 && <button type="button" onClick={() => setShowUpload(value => !value)} className="self-start rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-[#0f1422]">{showUpload ? "Hide Add Parts" : "Add Parts"}</button>}
            {uploadErrors.length > 0 && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{uploadErrors.map(error => <p key={error}>{error}</p>)}</div>}
            {(mappedFiles.length === 0 || showUpload) && <>
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
                    <p className="text-xs text-neutral-500 pointer-events-none">Part names suggest categories and dimensions; review each assignment before saving.</p>
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

            </>}
            {/* Quick Material Mapping Summary Banner */}
            {mappedFiles.length > 0 && (
                <div className="bg-[#0f1422] text-white p-3 rounded-[12px] flex flex-wrap items-center justify-between gap-4 shadow-sm">
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
                        {!isAccessory && (
                            <>
                                <div className="h-8 w-px bg-neutral-800" />
                                <div>
                                    <span className="text-neutral-400 block text-[11px]">Toggleable (Sill)</span>
                                    <span className="font-semibold text-amber-400">
                                        {mappedFiles.filter(m => m.isRemovable).length} Removable
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="text-right">
                        <span className="text-neutral-400 block text-[11px]">BOM Estimation Status</span>
                        <span className="text-xs font-medium text-white flex items-center gap-1.5">
                            {mappedFiles.every(m => !hasPartIssue(m)) && !removedFiles.length && (mappedFiles.length > 0 || modelStrategy === "Fixed" && Boolean(wholeModelAsset)) ? "Ready for Validation" : "Needs review"}
                        </span>
                    </div>
                </div>
            )}

            {/* Bilateral Handing Configuration Card (IMP-MS78) */}
            {isAccessory && mappedFiles.length > 0 && (
                <div className="bg-white p-5 rounded-[16px] border border-neutral-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles className="size-5 text-[#07b6d3]" />
                            <h3 className="text-base font-semibold text-[#0f1422]">
                                Bilateral Handing Configuration (Left & Right)
                            </h3>
                        </div>
                        <span className="text-xs bg-[#07b6d3]/10 text-[#07b6d3] font-medium px-2.5 py-1 rounded-full">
                            Hardware Handing
                        </span>
                    </div>

                    <p className="text-xs text-neutral-600">
                        Hardware accessories require both Left and Right handed geometries so that handles, levers, and locks point properly when installed on opposite sides of doors and windows. Select which version you uploaded:
                    </p>

                    {/* Hardware Accessory Category Selection */}
                    <div className="bg-neutral-50 p-3.5 rounded-[12px] border border-neutral-200 space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-[#0f1422] block">
                                Accessory Category <span className="text-red-500">*</span>
                            </label>
                            <span className="text-[10px] text-neutral-500">Hardware Template Type</span>
                        </div>
                        <select
                            value={mappedFiles[0]?.accessoryCategory || "handle"}
                            onChange={(e) => {
                                const nextCategory = e.target.value as AccessoryCategory;
                                setMappedFiles(prev => prev.map(m => ({ ...m, accessoryCategory: nextCategory })));
                                if (productId && productId !== "draft") {
                                    updateProductAccessoryCategory(productId, nextCategory).catch(() => {});
                                }
                            }}
                            className="w-full sm:w-80 border border-neutral-300 rounded-[8px] px-3 py-2 text-xs font-medium text-[#0f1422] focus:border-[#07b6d3] outline-none bg-white shadow-xs cursor-pointer"
                        >
                            <option value="handle">Handle / Knob / Pull</option>
                            <option value="lock">Lock / Latch / Smart Lock</option>
                            <option value="roller">Roller / Guide Wheel</option>
                            <option value="hinge">Hinge / Pivot</option>
                            <option value="other">Other Hardware</option>
                        </select>
                        <p className="text-[11px] text-neutral-500">
                            Specifies what type of fixture slot (e.g. door handles or sliding locks) can mount this hardware template.
                        </p>
                    </div>

                    {/* Handing Selection Choice Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className={`p-4 rounded-[12px] border-2 cursor-pointer transition-all flex flex-col gap-1 ${
                            selectedHanding === "right"
                                ? "border-[#07b6d3] bg-[#07b6d3]/5"
                                : "border-neutral-200 hover:border-neutral-300 bg-white"
                        }`}>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-[#0f1422]">Uploaded Model is Right-Handed</span>
                                <input
                                    type="radio"
                                    name="accessoryHanding"
                                    value="right"
                                    checked={selectedHanding === "right"}
                                    onChange={() => setSelectedHanding("right")}
                                    className="w-4 h-4 text-[#07b6d3]"
                                />
                            </div>
                            <p className="text-[11px] text-neutral-500">
                                System assigns uploaded file to Right handing and generates Left handing by lateral reflection.
                            </p>
                        </label>

                        <label className={`p-4 rounded-[12px] border-2 cursor-pointer transition-all flex flex-col gap-1 ${
                            selectedHanding === "left"
                                ? "border-[#07b6d3] bg-[#07b6d3]/5"
                                : "border-neutral-200 hover:border-neutral-300 bg-white"
                        }`}>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-[#0f1422]">Uploaded Model is Left-Handed</span>
                                <input
                                    type="radio"
                                    name="accessoryHanding"
                                    value="left"
                                    checked={selectedHanding === "left"}
                                    onChange={() => setSelectedHanding("left")}
                                    className="w-4 h-4 text-[#07b6d3]"
                                />
                            </div>
                            <p className="text-[11px] text-neutral-500">
                                System assigns uploaded file to Left handing and generates Right handing by lateral reflection.
                            </p>
                        </label>
                    </div>

                    {/* Dual Handing Side-by-Side 3D Preview */}
                    {primaryFile?.previewMesh && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-[#0f1422]">Left Handing</span>
                                    <span className="text-neutral-500 text-[10px]">
                                        {selectedHanding === "left" ? "Original Upload" : "Generated Mirror"}
                                    </span>
                                </div>
                                <div className="h-64 sm:h-72 bg-neutral-100 rounded-[10px] overflow-hidden border border-neutral-200">
                                    <Canvas shadows camera={{ position: [0, 0, 0.6], fov: 45 }}>
                                        <ambientLight intensity={0.7} />
                                        <directionalLight position={[2, 4, 3]} intensity={1.2} />
                                        <Suspense fallback={null}>
                                            <Stage environment={null} intensity={0.8} adjustCamera={1.2}>
                                                {leftPreviewMesh && <primitive object={leftPreviewMesh} />}
                                            </Stage>
                                        </Suspense>
                                        <OrbitControls enableZoom={true} minDistance={0.1} maxDistance={5} autoRotate autoRotateSpeed={2} />
                                    </Canvas>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-[#0f1422]">Right Handing</span>
                                    <span className="text-neutral-500 text-[10px]">
                                        {selectedHanding === "right" ? "Original Upload" : "Generated Mirror"}
                                    </span>
                                </div>
                                <div className="h-64 sm:h-72 bg-neutral-100 rounded-[10px] overflow-hidden border border-neutral-200">
                                    <Canvas shadows camera={{ position: [0, 0, 0.6], fov: 45 }}>
                                        <ambientLight intensity={0.7} />
                                        <directionalLight position={[2, 4, 3]} intensity={1.2} />
                                        <Suspense fallback={null}>
                                            <Stage environment={null} intensity={0.8} adjustCamera={1.2}>
                                                {rightPreviewMesh && <primitive object={rightPreviewMesh} />}
                                            </Stage>
                                        </Suspense>
                                        <OrbitControls enableZoom={true} minDistance={0.1} maxDistance={5} autoRotate autoRotateSpeed={2} />
                                    </Canvas>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Split Screen 60/40 Layout */}
            {mappedFiles.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 border border-neutral-200 rounded-[16px] overflow-hidden bg-white shadow-sm lg:h-[min(760px,calc(100vh-150px))]">
                    {/* Left Side: 3D Viewport (60% / 7 cols) */}
                    <div className="lg:col-span-7 bg-[#f2f4f7] relative h-[480px] lg:h-full min-h-0 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-neutral-200">
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

                        <div className="relative w-full min-h-0 flex-1">
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
                                <ViewerCameraControls action={cameraAction} />
                            </Canvas>
                            <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full border border-neutral-200 bg-white/90 px-3 py-1 text-[11px] font-medium text-neutral-700 shadow-xs backdrop-blur-md">
                                <Eye aria-hidden="true" className="size-3.5 shrink-0 text-[#07b6d3]" />
                                <span>Click part to inspect (Shift+Click for multi-select)</span>
                            </div>
                        </div>

                        <div className="flex gap-2 border-t border-neutral-200 bg-white px-3 py-2 text-xs">
                            {(["fit", "reset", "front"] as const).map(kind => <button key={kind} type="button" onClick={() => setCameraAction(previous => ({ kind, serial: (previous?.serial || 0) + 1 }))} className="rounded-md border border-neutral-200 px-2 py-1 text-neutral-700 focus-visible:outline-2 focus-visible:outline-[#07b6d3]">{kind === "fit" ? "Fit Model" : kind === "reset" ? "Reset Camera" : "Front View"}</button>)}
                        </div>

                        <div className="p-3 bg-white/90 border-t border-neutral-200/80 backdrop-blur-sm flex items-center justify-between text-xs text-neutral-500">
                            <span aria-live="polite">{selectedIds.size === 1 ? mappedFiles.find(m => selectedIds.has(m.id))?.componentName : `${selectedIds.size} parts selected`} · {mappedFiles.length} parts</span>
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
                        <div className="max-h-44 overflow-y-auto border-t border-neutral-200 bg-white p-2" aria-label="Part navigator">
                            <input aria-label="Search parts" value={partSearch} onChange={event => setPartSearch(event.target.value)} placeholder="Search parts" className="mb-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" />
                            <button type="button" aria-pressed={showIssuesOnly} onClick={() => setShowIssuesOnly(value => !value)} className="mb-2 rounded-lg border border-neutral-200 px-2 py-1 text-xs">{showIssuesOnly ? "Show all parts" : "Show issues only"}</button>
                            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                                {mappedFiles.filter(part => `${part.componentName} ${part.presentationCategory}`.toLowerCase().includes(partSearch.toLowerCase()) && (!showIssuesOnly || hasPartIssue(part))).map(part => <div key={part.id} className={`flex items-center gap-1 rounded-lg px-1 ${selectedIds.has(part.id) ? "bg-[#0f1422] text-white" : "bg-neutral-100 text-neutral-800"}`}><button type="button" aria-pressed={selectedIds.has(part.id)} onClick={() => handleSelectPart(part.id, false)} className="flex-1 px-1 py-1.5 text-left text-xs focus-visible:outline-2 focus-visible:outline-[#07b6d3]">{part.componentName}{part.status === "error" ? " · Error" : ""}</button><button type="button" aria-label={`Toggle ${part.componentName} in batch selection`} aria-pressed={selectedIds.has(part.id)} onClick={() => handleSelectPart(part.id, true)} className="rounded px-1 text-xs focus-visible:outline-2 focus-visible:outline-[#07b6d3]">{selectedIds.has(part.id) ? "✓" : "+"}</button></div>)}
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Part Inspector Drawer (40% / 5 cols) */}
                    <div className="lg:col-span-5 bg-white flex flex-col min-h-0 lg:h-full lg:overflow-y-auto">
                        <PartInspectorDrawer
                            selectedParts={selectedPartConfigs}
                            allParts={mappedFiles}
                            rawMaterials={rawMaterials}
                            analyzedGrilleData={analyzedGrilleData}
                            modelStrategy={modelStrategy}
                            productType={`${productType} ${productName || ""}`}
                            isAccessory={isAccessory}
                            productBasePrice={productBasePrice}
                            onUpdateParts={handleBatchUpdateSelected}
                            onSyncAssemblyGroup={handleSyncAssemblyGroup}
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
                                    {isAccessory ? (
                                        <th className="px-3 py-2">Unit Price</th>
                                    ) : (
                                        <>
                                            <th className="px-3 py-2">Driver</th>
                                            <th className="px-3 py-2">Span Ratio</th>
                                            <th className="px-3 py-2">Material Link</th>
                                            <th className="px-3 py-2">Removable</th>
                                        </>
                                    )}
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
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleSelectPart(mapped.id, false); }} className="text-left underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[#07b6d3]">{mapped.componentName}</button>
                                                    {mapped.isAccessorySlot && (
                                                        <span className="px-1.5 py-0.5 rounded-[4px] bg-cyan-50 text-[#07b6d3] font-semibold text-[9px] border border-cyan-200 uppercase tracking-tight">
                                                            Accessory Slot ({mapped.accessoryCategory || "handle"})
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-neutral-400 font-mono">{mapped.componentKey}</div>
                                            </td>
                                            {isAccessory ? (
                                                <td className="px-3 py-2 font-medium text-neutral-800">
                                                    PHP {(productBasePrice ?? 0).toFixed(2)}
                                                </td>
                                            ) : (
                                                <>
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
                                                            <span title={mat.description} className="text-[#07b6d3] font-medium flex items-center gap-1">
                                                                <span>{mat.description} ({mat.material_code})</span>
                                                                {mapped.materialBindings && mapped.materialBindings.length > 1 && (
                                                                    <span className="text-[10px] px-1 py-0.2 rounded bg-cyan-100 text-[#07b6d3] font-semibold">
                                                                        +{mapped.materialBindings.length - 1}
                                                                    </span>
                                                                )}
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
                                                </>
                                            )}
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
                                                        <CheckCircle className="size-3" /> Saved
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
                                                    aria-label={`Remove ${mapped.componentName}`}
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

            {removedFiles.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{removedFiles.length} part(s) pending removal. <button type="button" onClick={() => { setMappedFiles(prev => [...prev, ...removedFiles]); setRemovedFiles([]); }} className="font-semibold underline">Undo removal</button></div>}
            {saveError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{saveError}</div>}
            <div className="sticky bottom-0 z-20 flex items-center justify-between gap-3 bg-white/95 pt-4 pb-2 mt-2 border-t border-neutral-200 backdrop-blur-sm">
                <span role="status" aria-live="polite" className="text-sm font-medium text-neutral-700">{saveState === "dirty" ? "Unsaved changes" : saveState === "saving" ? "Saving changes" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : hasPendingChanges ? "Unsaved changes" : "No unsaved changes"}</span>
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

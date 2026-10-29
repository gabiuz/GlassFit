import type { SpaceImageSession } from "@/lib/imageApi";
import type { RawMaterial, CalculatedBOMResult, ComponentMaterialBinding, DimensionBinding } from "@/lib/pricing/types";
import type { AluminumFinishKey, RrdAluminumFinishKey } from "./colorVariations";
import type {
  AccessoryCategory,
  AccessoryPositionOptions,
  HorizontalPosition,
  VerticalPosition,
} from "@/lib/admin/products/types";

export type {
  AccessoryCategory,
  AccessoryPositionOptions,
  HorizontalPosition,
  VerticalPosition,
};

export type JsonObject = Record<string, unknown>;

export interface DuplicateProductProposal {
  axis: "width" | "height";
  count: number;
  pieceMm: number;
  originalMm: number;
}

export type ModelStrategy = "Fixed" | "Parametric";
export type GlassAppearanceMode = "clear" | "frosted" | "opaque" | "reflective" | "outdoor";
export type GlassColorKey = "clear" | "bronze" | "silver" | "blue";
export type GlassThicknessMm = 6 | 8 | 12;
export type GlassTypeKey = "regular" | "frosted" | "mirror" | "tempered" | "reflective";
export type ActiveAddonType = "screen" | "grill" | "none" | null;
export type { AddonGeometryConfig } from "./addonGeometryBuilder";

export type ProductConfigurationSeed = {
  aluminumFinish: RrdAluminumFinishKey;
  glassType: GlassTypeKey;
  glassAppearance: GlassAppearanceMode;
  glassColor: GlassColorKey;
  glassThicknessMm: GlassThicknessMm;
  widthCm?: number;
  heightCm?: number;
  quantity: number;
};

export type PendingProductConfiguration = {
  productId: string;
  configuration: ProductConfigurationSeed;
};

export type SelectedVisualizationProduct = {
  productId: string;
  productName: string;
  productType: string;
  description: string | null;
  catalogImageUrl: string | null;
};

export type ProductParameter = {
  parameterId: string;
  parameterKey: string;
  parameterName: string;
  parameterType: "Number" | "Integer" | "Boolean" | "Select" | string;
  minimumValue: number | null;
  maximumValue: number | null;
  defaultValue: unknown;
  stepValue: number | null;
  unit: string | null;
  affectsStructure: boolean;
  displayOrder: number;
};

export type ProductComponentModel = {
  assetId: string;
  r2ObjectKey: string;
  url: string;
  fileName: string;
  sourceDimensionsMm: SourceDimensionsMm | null;
};

export type SourceDimensionsMm = {
  width: number;
  height: number;
  depth: number;
};

export type ProductComponentDefinition = {
  componentId: string;
  componentKey: string;
  componentName: string;
  partName?: string;
  componentType: string;
  baseQuantity: number;
  rawMaterialId?: string | null;
  rawMaterial?: RawMaterial | null;
  allowedMaterials?: ComponentMaterialBinding[];
  defaultRawMaterialId?: string | null;
  dimensionBinding?: DimensionBinding;
  spanRatio?: number;
  isRemovable?: boolean;
  togglePropertyKey?: string | null;
  presentationCategory?: "Framing" | "Glazing" | "Hardware" | "Consumable" | "Other";
  componentData: JsonObject;
  model: ProductComponentModel;
  // Step 4 structural metadata extensions
  role?: string;
  finishGroup?: string;
  lengthFormula?: string;
  quantityFormula?: string;
  isAccessorySlot?: boolean;
  accessoryCategory?: AccessoryCategory | null;
  allowedAccessoryIds?: string[] | null;
  positionOptions?: AccessoryPositionOptions | null;
  unitPrice?: number;
  pricingMethod?: string;
  handingMetadata?: import("@/lib/admin/products/types").ComponentHandingMetadata | null;
  jalousieConfig?: import("@/lib/pricing/types").JalousieConfig | null;
};

export interface AccessorySlotOverride {
  slotComponentKey?: string;
  accessoryProductId?: string | null;
  accessoryProductName?: string | null;
  accessoryModelUrl?: string | null;
  accessoryMesh?: unknown; // THREE.Group
  horizontalPosition?: HorizontalPosition;
  verticalPosition?: VerticalPosition;
}

export interface SelectedAccessoryState {
  slotComponentId: string;
  slotCategory?: AccessoryCategory | string;
  accessoryId: string;
  accessoryName: string;
  category: AccessoryCategory | string;
  price: number;
  finish: string;
  horizontalPosition: HorizontalPosition;
  verticalPosition: VerticalPosition;
  priceDelta?: number;
  glbUrl?: string | null;
  imageUrl?: string | null;
  handingMetadata?: import("@/lib/admin/products/types").ComponentHandingMetadata | null;
}

export type ProductStructuralAsset = {
  assetId: string;
  assetType: string;
  r2ObjectKey: string;
  url: string | null;
  fileName: string;
  isPrimary: boolean;
  status: string;
};

export type StructuralRule = {
  ruleId: string;
  ruleName: string;
  priority: number;
  conditionData: JsonObject;
  actionData: JsonObject;
};

export type ProductStructuralDefinition = {
  product: {
    productId: string;
    productName: string;
    productType: string;
    description?: string | null;
    basePrice?: number;
    catalogImageUrl?: string | null;
    preview_glb_url?: string | null;
    isAddon?: boolean;
    addonType?: "screen" | "grill" | null;
    isAccessory?: boolean;
    accessoryCategory?: "handle" | "lock" | "hinge" | "roller" | "other" | null;
    accessoryMountingType?: "surface_mount" | "mortise" | "recessed" | "clamp" | null;
  };
  template: {
    templateId: string;
    templateName: string;
    modelStrategy: ModelStrategy;
    measurementUnit: "mm" | "cm" | "m" | string;
    baseConfiguration: JsonObject;
    category?: string;
    parametricRules?: JsonObject;
  };
  parameters: ProductParameter[];
  components: ProductComponentDefinition[];
  rules: StructuralRule[];
  assets?: ProductStructuralAsset[];
  componentMaterials?: ComponentMaterialBinding[];
  compatibleAddons?: CompatibleAddon[];
};

export type CompatibleAddon = {
  id: string;
  parentProductId: string;
  addonProductId: string;
  addonType: "screen" | "grill";
  isDefaultEnabled?: boolean;
  displayOrder?: number;
  allowedSides?: "front" | "back" | "both";
  defaultSide?: "front" | "back";
  hatchTargetComponentKeys?: string[] | null;
  hatchAlignmentConfig?: Record<string, unknown> | null;
  addonProduct?: {
    productId: string;
    productName: string;
    basePrice: number;
    status: string;
  };
  template?: {
    templateId: string;
    templateName: string;
    modelStrategy: string;
    measurementUnit: string;
    baseConfiguration: Record<string, unknown>;
  };
  components?: ProductComponentDefinition[];
  assets?: ProductStructuralAsset[];
};

export type { RawMaterial as RawMaterialOption } from "@/lib/pricing/types";

export type ResolvedStructure = {
  resolvedValues: Record<string, unknown>;
  numericValuesMm: Record<string, number>;
  componentQuantities: Record<string, number>;
  appliedRuleIds: string[];
};

export type OverlayTransform = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  yaw: number;
  pitch: number;
};

export type ActiveOverlay = {
  overlayId: string;
  productId: string;
  templateId: string;
  visualParameterValues: Record<string, unknown>;
  resolvedStructure: ResolvedStructure;
  transform: OverlayTransform;
  occlusionObjectIds: string[];
};

export type PlacedOverlay = {
  overlayId: string;
  productId: string;
  productName: string;
  templateId: string;
  configuration: ProductConfigurationSnapshot;
  flattenedImageDataUrl: string;
  variationImageDataUrls?: Partial<Record<AluminumFinishKey, string>>;
  variationAssetRefs?: Partial<Record<AluminumFinishKey, VariationAssetRef>>;
  variationRenderRecipe?: VariationRenderRecipe;
  sourceCanvasWidth?: number;
  sourceCanvasHeight?: number;
  sourceOverlayWidth?: number;
  sourceOverlayHeight?: number;
  visibleModelBounds?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  isActive?: boolean;
  bomResult?: CalculatedBOMResult;
  unitPrice?: number;
  totalPrice?: number;
  layerNumber?: number;
  previewGlbUrl?: string | null;
  grilleBOM?: import("@/lib/pricing/types").GrilleLinearBOMResult | null;
};

export type VariationAssetRef = {
  cacheKey: string;
  mimeType: "image/webp" | "image/png";
  byteLength: number;
  width: number;
  height: number;
  fingerprint: string;
};

export type VariationRenderRecipe = {
  productId: string;
  templateId: string;
  structuralDefinition: ProductStructuralDefinition;
  configuration: ProductConfigurationSnapshot;
  sourceCanvasWidth: number;
  sourceCanvasHeight: number;
  sourceOverlayWidth: number;
  sourceOverlayHeight: number;
  visibleModelBounds: NonNullable<PlacedOverlay["visibleModelBounds"]>;
};

export type VariationAssetPriority = "visible" | "user" | "idle";

export type VariationAssetStatus =
  | { state: "missing" }
  | { state: "queued"; priority: VariationAssetPriority }
  | { state: "rendering"; finish: AluminumFinishKey }
  | { state: "ready"; asset: VariationAssetRef; objectUrl: string }
  | { state: "error"; message: string; retryable: boolean };

export type VisualizationSessionState = {
  assetSessionId: string | null;
  selectedProductId: string | null;
  pendingProductConfiguration: PendingProductConfiguration | null;
  spaceImageSession: SpaceImageSession | null;
  workspaceBackgroundDataUrl: string | null;
  structuralDefinition: ProductStructuralDefinition | null;
  productConfiguration: ProductConfigurationSnapshot | null;
  variationSnapshots: ProductVariationSnapshot[];
  activeOverlay: ActiveOverlay | null;
  placedOverlays: PlacedOverlay[];
  comparisonOverlays: PlacedOverlay[];
  finalSnapshotDataUrl: string | null;
};

export type ProductVariationSnapshot = {
  key: AluminumFinishKey;
  title: string;
  label: string;
  swatchClassName: string;
  previewHex?: string;
  imageDataUrl: string;
};

export type Point2D = {
  x: number;
  y: number;
};

export type QuadrilateralCorners = [Point2D, Point2D, Point2D, Point2D];

export type PerspectiveOpeningType = "window" | "door" | "opening";

export type ManualOcclusionPolygon = Point2D[];

export type ManualOcclusionMaskResult = {
  polygons: ManualOcclusionPolygon[];
  maskDataUrl: string | null;
};

export type ProductConfigurationSnapshot = {
  /** IMP-MS55: explicit opening-plane assignment; absent means approximate. */
  targetPlaneId?: string | null;
  widthCm: number;
  heightCm: number;
  thicknessMm: number;
  quantity: number;
  panelCount?: number;
  structuralWaiver?: boolean;
  aluminumFinish: "black" | "white" | "silver" | string;
  glassAppearance: GlassAppearanceMode;
  glassColor?: GlassColorKey;
  glassThicknessMm?: GlassThicknessMm;
  glassType?: GlassTypeKey;
  includeSill: boolean;
  yaw: number;
  pitch: number;
  rotateAngle: number;
  isFlipped: boolean;
  zoomLevel?: number;
  activeOcclusionIds?: string[];
  manualOcclusionMaskDataUrl?: string | null;
  manualOcclusionPolygons?: ManualOcclusionPolygon[];
  perspectiveFitCorners?: QuadrilateralCorners | null;
  ambientLight?: boolean;
  autoShadow?: boolean;
  autoRealism?: boolean;
  positionX?: number;
  positionY?: number;
  selectedMaterials?: Record<string, string>;
  selectedAddon?: "none" | "screen" | "grill";
  addonProductId?: string | null;
  addonName?: string | null;
  addonPrice?: number;
  addonAluminumFinish?: string;
  addonMountingSide?: "front" | "back";
  hatchCount?: number;
  hatchTargetKeys?: string[];
  baseUnitPrice?: number;
  grilleBOM?: import("@/lib/pricing/types").GrilleLinearBOMResult | null;
  swappedAccessories?: Record<string, SelectedAccessoryState>;
  accessoryPriceDelta?: number;
  visualParameterValues: Record<string, unknown>;
};

export type MeasurementOverride = {
  widthIn: number;
  heightIn: number;
  widthOverridden: boolean;
  heightOverridden: boolean;
  acknowledged: boolean;
};

export type MeasurementConfirmationEntry = {
  overlayId: string;
  productId: string;
  productName: string;
  aluminumFinish: string;
  previewGlbUrl: string | null;
  systemWidthCm: number;
  systemHeightCm: number;
  systemTotalPrice: number;
  structuralDefinition: ProductStructuralDefinition | null;
  overlayConfiguration: ProductConfigurationSnapshot;
  isActiveProduct: boolean;
  override: MeasurementOverride;
  recalculatedTotalPrice: number | null;
  dimensionSource?: string;
  calibrationMethod?: string | null;
  calibrationConfidence?: number | null;
  paperStandard?: string | null;
  calibrationScaleCmPerPx?: number | null;
  userVerified?: boolean | null;
};

export type ScaleEstimationAnchor = {
  label: string;
  bbox_height_px: number;
  reference_height_cm: number;
  scale_cm_per_px: number;
  confidence: number;
  depth_correction: number;
};

export type ScaleEstimationSignal = {
  reference_confirmed?: boolean;
  anchors: ScaleEstimationAnchor[];
  best_scale_cm_per_px: number | null;
  confidence: number;
  method: string;
  exif_focal_length_mm: number | null;
  exif_focal_length_35mm: number | null;
  exif_device_model: string | null;
};

export type DimensionEstimate = {
  widthCm: number;
  heightCm: number;
  confidence: number;
  method: string;
};

export type CalibrationMode = "standard" | "paper_fiducial" | "auto_detect";

export type FiducialPaperStandard = "short" | "a4" | "long";

export interface PaperStandardDimensionsMm {
  widthMm: number;
  heightMm: number;
  label: string;
}

export const PAPER_STANDARD_METRICS: Record<FiducialPaperStandard, PaperStandardDimensionsMm> = {
  short: {
    widthMm: 215.9,
    heightMm: 279.4,
    label: 'Short Bond / Letter (8.5" x 11")',
  },
  a4: {
    widthMm: 210.0,
    heightMm: 297.0,
    label: 'A4 Standard (8.27" x 11.69")',
  },
  long: {
    widthMm: 215.9,
    heightMm: 330.2,
    label: 'Long Bond / Folio (8.5" x 13")',
  },
};

export interface CalibrationIntakeOptions {
  mode: CalibrationMode;
  paperStandard?: FiducialPaperStandard;
  seedPoint?: { x: number; y: number };
}

export type PaperCalibrationStatus =
  | "calibrated"
  | "detected"
  | "manual_pin_required"
  | "verified_calibrated"
  | "heuristic_fallback"
  | "not_requested";

/** IMP-MS53 / QAD-TC68 / IMP-MS58: evidence scores are not measurement probabilities. */
export type PaperReferenceSource = "auto_detected" | "candidate_selected" | "manual_corners" | "click_guided";
export interface PaperCandidate {
  id: string;
  corners: [number, number][];
  score: number;
  score_components: Record<string, number>;
  rejection_reasons: string[];
}

export type PaperCandidateRecord = PaperCandidate;

export interface PaperCalibrationResult {
  geometry_contract_version?: "paper-plane-mm-v1";
  coordinate_image_id?: string | null;
  oriented_source_to_workspace?: number[][] | null;
  metric_reference?: import("./metricGeometry").MetricReference | null;
  detection_outcome?: "candidate_found" | "ambiguous" | "not_found";
  candidates?: PaperCandidate[];
  selected_candidate_id?: string | null;
  reference_source?: PaperReferenceSource | null;
  paper_standard_confirmed?: boolean;
  coordinate_space?: "oriented_source" | "workspace";
  image_width?: number;
  image_height?: number;
  status: "detected" | "manual_pin_required" | "not_requested" | "verified_calibrated" | "calibrated";
  paper_standard: FiducialPaperStandard | null;
  suggested_paper_standard?: FiducialPaperStandard | null;
  aspect_ratio_match_confidence?: number;
  unwarped_aspect_ratio?: number | null;
  detected_corners: [number, number][] | null;
  scale_cm_per_px: number | null;
  confidence: number;
  homography_matrix: number[][] | null;
  user_verified?: boolean;
  verified_corners?: [Point2D, Point2D, Point2D, Point2D] | null;
  verified_scale_cm_per_px?: number | null;
  rejection_reasons?: string[];
}

export interface CalibrationMetadata {
  placementReview?: import("./planeEligibility").PlacementReview;
  metricReference?: import("./metricGeometry").MetricReference | null;
  referenceSource?: PaperReferenceSource;
  selectedCandidateId?: string | null;
  paperStandardConfirmed?: boolean;
  samePlaneConfirmed?: boolean;
  mode: CalibrationMode;
  paperStandard: FiducialPaperStandard | null;
  suggested_paper_standard?: FiducialPaperStandard | null;
  suggestedPaperStandard?: FiducialPaperStandard | null;
  aspect_ratio_match_confidence?: number;
  aspectRatioMatchConfidence?: number;
  unwarped_aspect_ratio?: number | null;
  unwarpedAspectRatio?: number | null;
  status: PaperCalibrationStatus;
  confidence: number;
  homographyMatrix?: number[][] | null;
  detectedCorners?: [number, number][] | null;
  user_verified?: boolean;
  verified_corners?: [Point2D, Point2D, Point2D, Point2D] | null;
  verified_scale_cm_per_px?: number | null;
}

export type CalibrationMeta = CalibrationMetadata;


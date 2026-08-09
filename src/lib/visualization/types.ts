import type { SpaceImageSession } from "@/lib/imageApi";

export type JsonObject = Record<string, unknown>;

export type ModelStrategy = "Fixed" | "Parametric";
export type GlassAppearanceMode = "clear" | "frosted" | "opaque" | "reflective";

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
  componentType: string;
  baseQuantity: number;
  componentData: JsonObject;
  model: ProductComponentModel;
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
  };
  template: {
    templateId: string;
    templateName: string;
    modelStrategy: ModelStrategy;
    measurementUnit: "mm" | "cm" | "m" | string;
    baseConfiguration: JsonObject;
  };
  parameters: ProductParameter[];
  components: ProductComponentDefinition[];
  rules: StructuralRule[];
};

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

export type PlacedOverlay = ActiveOverlay & {
  flattenedImageDataUrl: string;
};

export type VisualizationSessionState = {
  selectedProductId: string | null;
  spaceImageSession: SpaceImageSession | null;
  structuralDefinition: ProductStructuralDefinition | null;
  activeOverlay: ActiveOverlay | null;
  placedOverlays: PlacedOverlay[];
};

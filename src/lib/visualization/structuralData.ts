import { getR2AssetUrl } from "@/lib/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RawMaterial } from "@/lib/pricing/types";
import type {
  JsonObject,
  ProductComponentDefinition,
  ProductParameter,
  ProductStructuralAsset,
  ProductStructuralDefinition,
  SelectedVisualizationProduct,
  SourceDimensionsMm,
  StructuralRule,
} from "./types";

function parseRawMaterial(rawMatData: unknown): RawMaterial | null {
  if (!rawMatData) return null;
  const row = Array.isArray(rawMatData) ? rawMatData[0] : rawMatData;
  if (!row || typeof row !== "object" || !("id" in row)) return null;
  const r = row as Record<string, unknown>;
  return {
    id: String(r.id),
    material_code: String(r.material_code ?? ""),
    description: String(r.description ?? ""),
    category: (r.category as RawMaterial["category"]) || "Aluminum",
    finish_type: (r.finish_type as RawMaterial["finish_type"]) || "Analok",
    billing_unit: (r.billing_unit as RawMaterial["billing_unit"]) || "m",
    unit_price: Number(r.unit_price) || 0,
    waste_allowance: Number(r.waste_allowance) || 0,
    is_active: Boolean(r.is_active ?? true),
  };
}

type AssetRow = {
  asset_id: string;
  asset_type: string;
  r2_object_key: string;
  file_name: string;
  is_primary: boolean;
  status: string;
  component_id?: string | null;
};

export async function getSelectedVisualizationProduct(
  productId: string,
): Promise<SelectedVisualizationProduct | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("products")
    .select(`
      product_id,
      product_name,
      product_type,
      description,
      status,
      product_assets (
        asset_id,
        asset_type,
        r2_object_key,
        file_name,
        is_primary,
        status
      )
    `)
    .eq("product_id", productId)
    .eq("status", "Active")
    .single();

  if (error || !data) {
    return null;
  }

  const assets = Array.isArray(data.product_assets)
    ? (data.product_assets as AssetRow[])
    : [];
  const catalogAsset = assets.find(
    (asset) =>
      asset.asset_type === "Catalog Image" &&
      asset.is_primary &&
      asset.status === "Active",
  );

  return {
    productId: data.product_id,
    productName: data.product_name,
    productType: data.product_type,
    description: typeof data.description === "string" ? data.description : null,
    catalogImageUrl: getR2AssetUrl(catalogAsset?.r2_object_key),
  };
}

export async function getProductStructuralDefinition(
  productId: string,
): Promise<ProductStructuralDefinition> {
  const supabase = await createSupabaseServerClient();

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("product_id, product_name, product_type, description, base_price, status")
    .eq("product_id", productId)
    .eq("status", "Active")
    .single();

  if (productError || !product) {
    throw new Error("Selected product is not available.");
  }

  const { data: template, error: templateError } = await supabase
    .from("product_templates")
    .select("template_id, template_name, model_strategy, measurement_unit, base_configuration")
    .eq("product_id", productId)
    .eq("status", "Active")
    .single();

  if (templateError || !template) {
    throw new Error("This product does not have an active structural template.");
  }

  const templateId = template.template_id;

  const [
    parametersResult,
    componentsResult,
    rulesResult,
    assetsResult,
    publishAssetsResult,
  ] = await Promise.all([
    supabase
      .from("product_parameters")
      .select(`
        parameter_id,
        parameter_key,
        parameter_name,
        parameter_type,
        minimum_value,
        maximum_value,
        default_value,
        step_value,
        unit,
        affects_structure,
        display_order
      `)
      .eq("template_id", templateId)
      .eq("status", "Active")
      .order("display_order", { ascending: true }),
    supabase
      .from("product_components")
      .select(`
        component_id,
        component_key,
        component_name,
        component_type,
        base_quantity,
        raw_material_id,
        dimension_binding,
        span_ratio,
        is_removable,
        toggle_property_key,
        presentation_category,
        component_data,
        raw_materials:raw_material_id (
          id,
          material_code,
          description,
          category,
          finish_type,
          billing_unit,
          unit_price,
          waste_allowance,
          is_active
        )
      `)
      .eq("template_id", templateId)
      .eq("status", "Active")
      .order("component_key", { ascending: true }),
    supabase
      .from("structural_rules")
      .select("rule_id, rule_name, priority, condition_data, action_data")
      .eq("template_id", templateId)
      .eq("status", "Active")
      .order("priority", { ascending: true }),
    supabase
      .from("product_assets")
      .select(`
        asset_id,
        component_id,
        asset_type,
        r2_object_key,
        file_name,
        is_primary,
        status
      `)
      .eq("product_id", productId)
      .eq("template_id", templateId)
      .eq("asset_type", "Component Model")
      .eq("status", "Active")
      .order("is_primary", { ascending: false })
      .order("display_order", { ascending: true }),
    supabase
      .from("product_assets")
      .select(`
        asset_id,
        asset_type,
        r2_object_key,
        file_name,
        is_primary,
        status
      `)
      .eq("product_id", productId)
      .in("asset_type", ["Whole Model", "Catalog 3D Preview", "Catalog Image"])
      .eq("status", "Active")
      .order("is_primary", { ascending: false })
      .order("display_order", { ascending: true }),
  ]);

  if (parametersResult.error) {
    throw new Error("Product parameters could not be loaded.");
  }

  if (componentsResult.error) {
    throw new Error("Product components could not be loaded.");
  }

  if (rulesResult.error) {
    throw new Error("Product structural rules could not be loaded.");
  }

  if (assetsResult.error) {
    throw new Error("Product component assets could not be loaded.");
  }

  if (publishAssetsResult.error) {
    throw new Error("Product 3D model assets could not be loaded.");
  }

  const componentAssets = new Map<string, AssetRow>();
  for (const asset of (assetsResult.data ?? []) as AssetRow[]) {
    if (!asset.component_id || componentAssets.has(asset.component_id)) {
      continue;
    }
    componentAssets.set(asset.component_id, asset);
  }

  const components: ProductComponentDefinition[] = [];
  for (const row of componentsResult.data ?? []) {
    const asset = componentAssets.get(row.component_id);
    const url = getR2AssetUrl(asset?.r2_object_key);

    if (!asset || !url) {
      throw new Error(`Missing Component Model asset for ${row.component_key}.`);
    }

    const componentData = toJsonObject(row.component_data);

    components.push({
      componentId: row.component_id,
      componentKey: row.component_key,
      componentName: row.component_name,
      componentType: row.component_type,
      baseQuantity: toNumber(row.base_quantity, 0),
      rawMaterialId: (row.raw_material_id as string) || null,
      rawMaterial: parseRawMaterial((row as Record<string, unknown>).raw_materials),
      dimensionBinding: row.dimension_binding || "FIXED",
      spanRatio: typeof row.span_ratio === "number" ? row.span_ratio : 1.0,
      isRemovable: Boolean(row.is_removable),
      togglePropertyKey: (row.toggle_property_key as string) || null,
      presentationCategory: row.presentation_category || "Framing",
      componentData,
      model: {
        assetId: asset.asset_id,
        r2ObjectKey: asset.r2_object_key,
        url,
        fileName: asset.file_name,
        sourceDimensionsMm: readSourceDimensionsMm(componentData),
      },
    });
  }

  const productAssets = mapStructuralAssets(publishAssetsResult.data ?? []);
  const catalogAsset = productAssets.find(
    (asset) =>
      asset.assetType === "Catalog Image" &&
      asset.isPrimary &&
      asset.status === "Active",
  );
  const fixedModelAssets = productAssets.filter(
    (asset) =>
      (asset.assetType === "Whole Model" ||
        asset.assetType === "Catalog 3D Preview") &&
      asset.status === "Active",
  );

  if (template.model_strategy === "Parametric" && components.length === 0) {
    throw new Error("This product has no active structural components.");
  }

  if (template.model_strategy === "Fixed" && fixedModelAssets.length === 0) {
    throw new Error("This fixed product does not have an active 3D model asset.");
  }

  return {
    product: {
      productId: product.product_id,
      productName: product.product_name,
      productType: product.product_type,
      description: typeof product.description === "string" ? product.description : null,
      basePrice: toNumber(product.base_price, 0),
      catalogImageUrl: catalogAsset?.url ?? null,
    },
    template: {
      templateId,
      templateName: template.template_name,
      modelStrategy: template.model_strategy,
      measurementUnit: template.measurement_unit,
      baseConfiguration: toJsonObject(template.base_configuration),
    },
    parameters: (parametersResult.data ?? []).map<ProductParameter>((row) => ({
      parameterId: row.parameter_id,
      parameterKey: row.parameter_key,
      parameterName: row.parameter_name,
      parameterType: row.parameter_type,
      minimumValue: toOptionalNumber(row.minimum_value),
      maximumValue: toOptionalNumber(row.maximum_value),
      defaultValue: row.default_value,
      stepValue: toOptionalNumber(row.step_value),
      unit: typeof row.unit === "string" ? row.unit : null,
      affectsStructure: Boolean(row.affects_structure),
      displayOrder: Number(row.display_order) || 1,
    })),
    components,
    rules: (rulesResult.data ?? []).map<StructuralRule>((row) => ({
      ruleId: row.rule_id,
      ruleName: row.rule_name,
      priority: Number(row.priority) || 1,
      conditionData: toJsonObject(row.condition_data),
      actionData: toJsonObject(row.action_data),
    })),
    assets: productAssets,
  };
}

export async function getDraftStructuralDefinition(
  productId: string,
): Promise<ProductStructuralDefinition> {
  const supabase = await createSupabaseServerClient();

  // Same as getProductStructuralDefinition but without eq("status", "Active") for product and template
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("product_id, product_name, product_type, description, base_price, status")
    .eq("product_id", productId)
    .single();

  if (productError || !product) {
    throw new Error("Draft product is not available.");
  }

  const { data: template, error: templateError } = await supabase
    .from("product_templates")
    .select("template_id, template_name, model_strategy, measurement_unit, base_configuration")
    .eq("product_id", productId)
    .single();

  if (templateError || !template) {
    throw new Error("This product does not have a structural template.");
  }

  const templateId = template.template_id;

  const [
    parametersResult,
    componentsResult,
    rulesResult,
    assetsResult,
    publishAssetsResult,
  ] = await Promise.all([
    supabase
      .from("product_parameters")
      .select(`
        parameter_id,
        parameter_key,
        parameter_name,
        parameter_type,
        minimum_value,
        maximum_value,
        default_value,
        step_value,
        unit,
        affects_structure,
        display_order
      `)
      .eq("template_id", templateId)
      .order("display_order", { ascending: true }),
    supabase
      .from("product_components")
      .select(`
        component_id,
        component_key,
        component_name,
        component_type,
        base_quantity,
        raw_material_id,
        dimension_binding,
        span_ratio,
        is_removable,
        toggle_property_key,
        presentation_category,
        component_data,
        raw_materials:raw_material_id (
          id,
          material_code,
          description,
          category,
          finish_type,
          billing_unit,
          unit_price,
          waste_allowance,
          is_active
        )
      `)
      .eq("template_id", templateId)
      .order("component_key", { ascending: true }),
    supabase
      .from("structural_rules")
      .select("rule_id, rule_name, priority, condition_data, action_data")
      .eq("template_id", templateId)
      .order("priority", { ascending: true }),
    supabase
      .from("product_assets")
      .select(`
        asset_id,
        component_id,
        asset_type,
        r2_object_key,
        file_name,
        is_primary,
        status
      `)
      .eq("product_id", productId)
      .eq("template_id", templateId)
      .eq("asset_type", "Component Model")
      .order("is_primary", { ascending: false })
      .order("display_order", { ascending: true }),
    supabase
      .from("product_assets")
      .select(`
        asset_id,
        asset_type,
        r2_object_key,
        file_name,
        is_primary,
        status
      `)
      .eq("product_id", productId)
      .in("asset_type", ["Whole Model", "Catalog 3D Preview", "Catalog Image"])
      .eq("status", "Active")
      .order("is_primary", { ascending: false })
      .order("display_order", { ascending: true }),
  ]);

  if (parametersResult.error) throw new Error("Product parameters could not be loaded.");
  if (componentsResult.error) throw new Error("Product components could not be loaded.");
  if (rulesResult.error) throw new Error("Product structural rules could not be loaded.");
  if (assetsResult.error) throw new Error("Product component assets could not be loaded.");
  if (publishAssetsResult.error) throw new Error("Product 3D preview assets could not be loaded.");

  const componentAssets = new Map<string, AssetRow>();
  for (const asset of (assetsResult.data ?? []) as AssetRow[]) {
    // Note: since is_primary is false for multiple component models now, we just pick the first we see per component
    if (!asset.component_id || componentAssets.has(asset.component_id)) {
      continue;
    }
    componentAssets.set(asset.component_id, asset);
  }

  const components: ProductComponentDefinition[] = [];
  for (const row of componentsResult.data ?? []) {
    const asset = componentAssets.get(row.component_id);
    const url = getR2AssetUrl(asset?.r2_object_key);

    if (!asset || !url) {
      throw new Error(`Missing Component Model asset for ${row.component_key}.`);
    }

    const componentData = toJsonObject(row.component_data);
    components.push({
      componentId: row.component_id,
      componentKey: row.component_key,
      componentName: row.component_name,
      componentType: row.component_type,
      baseQuantity: toNumber(row.base_quantity, 0),
      rawMaterialId: (row.raw_material_id as string) || null,
      rawMaterial: parseRawMaterial((row as Record<string, unknown>).raw_materials),
      dimensionBinding: row.dimension_binding || "FIXED",
      spanRatio: typeof row.span_ratio === "number" ? row.span_ratio : 1.0,
      isRemovable: Boolean(row.is_removable),
      togglePropertyKey: (row.toggle_property_key as string) || null,
      presentationCategory: row.presentation_category || "Framing",
      componentData,
      model: {
        assetId: asset.asset_id,
        r2ObjectKey: asset.r2_object_key,
        url,
        fileName: asset.file_name,
        sourceDimensionsMm: readSourceDimensionsMm(componentData),
      },
    });
  }

  const productAssets = mapStructuralAssets(publishAssetsResult.data ?? []);
  const catalogAsset = productAssets.find(
    (asset) =>
      asset.assetType === "Catalog Image" &&
      asset.isPrimary &&
      asset.status === "Active",
  );

  return {
    product: {
      productId: product.product_id,
      productName: product.product_name,
      productType: product.product_type,
      description: typeof product.description === "string" ? product.description : null,
      basePrice: toNumber(product.base_price, 0),
      catalogImageUrl: catalogAsset?.url ?? null,
    },
    template: {
      templateId,
      templateName: template.template_name,
      modelStrategy: template.model_strategy,
      measurementUnit: template.measurement_unit,
      baseConfiguration: toJsonObject(template.base_configuration),
    },
    parameters: (parametersResult.data ?? []).map<ProductParameter>((row) => ({
      parameterId: row.parameter_id,
      parameterKey: row.parameter_key,
      parameterName: row.parameter_name,
      parameterType: row.parameter_type,
      minimumValue: toOptionalNumber(row.minimum_value),
      maximumValue: toOptionalNumber(row.maximum_value),
      defaultValue: row.default_value,
      stepValue: toOptionalNumber(row.step_value),
      unit: typeof row.unit === "string" ? row.unit : null,
      affectsStructure: Boolean(row.affects_structure),
      displayOrder: Number(row.display_order) || 1,
    })),
    components,
    rules: (rulesResult.data ?? []).map<StructuralRule>((row) => ({
      ruleId: row.rule_id,
      ruleName: row.rule_name,
      priority: Number(row.priority) || 1,
      conditionData: toJsonObject(row.condition_data),
      actionData: toJsonObject(row.action_data),
    })),
    assets: productAssets,
  };
}

function mapStructuralAssets(assets: unknown[]): ProductStructuralAsset[] {
  return (assets as AssetRow[]).map<ProductStructuralAsset>((asset) => ({
    assetId: asset.asset_id,
    assetType: asset.asset_type,
    r2ObjectKey: asset.r2_object_key,
    url: getR2AssetUrl(asset.r2_object_key),
    fileName: asset.file_name,
    isPrimary: Boolean(asset.is_primary),
    status: asset.status,
  }));
}

function toJsonObject(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }

  return {};
}

function toOptionalNumber(value: unknown) {
  const next = toNumber(value, Number.NaN);
  return Number.isFinite(next) ? next : null;
}

function toNumber(value: unknown, fallback: number) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function readSourceDimensionsMm(data: JsonObject): SourceDimensionsMm | null {
  const candidates = [
    data.sourceDimensionsMm,
    data.source_dimensions_mm,
    data.sourceDimensions,
    data.dimensions_mm,
    data.dimensions,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const record = candidate as Record<string, unknown>;
    const width = toNumber(record.width, Number.NaN);
    const height = toNumber(record.height, Number.NaN);
    const depth = toNumber(record.depth, Number.NaN);

    if (width > 0 && height > 0 && depth > 0) {
      return { width, height, depth };
    }
  }

  return null;
}

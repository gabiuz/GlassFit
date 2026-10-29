import { getR2AssetUrl } from "@/lib/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RawMaterial, ComponentMaterialBinding } from "@/lib/pricing/types";
import type {
  JsonObject,
  ProductComponentDefinition,
  ProductParameter,
  ProductStructuralAsset,
  ProductStructuralDefinition,
  SelectedVisualizationProduct,
  SourceDimensionsMm,
  StructuralRule,
  CompatibleAddon,
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

function extractComponentBindings(row: Record<string, unknown>): ComponentMaterialBinding[] {
  const rawPcm = Array.isArray(row.product_component_materials) ? row.product_component_materials : [];
  if (rawPcm.length > 0) {
    return rawPcm.map((b: Record<string, unknown>, idx: number) => ({
      id: b.id as string | undefined,
      componentId: (b.product_component_id || row.component_id) as string | undefined,
      rawMaterialId: String(b.raw_material_id || ""),
      isDefault: Boolean(b.is_default),
      displayOrder: typeof b.display_order === "number" ? b.display_order : idx,
      rawMaterial: parseRawMaterial(b.raw_materials) ?? undefined,
    }));
  }
  if (row.raw_material_id) {
    return [{
      rawMaterialId: String(row.raw_material_id),
      isDefault: true,
      displayOrder: 0,
      rawMaterial: parseRawMaterial(row.raw_materials) ?? undefined,
    }];
  }
  return [];
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

async function fetchCompatibleAddons(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  productId: string,
): Promise<CompatibleAddon[]> {
  const { data: addonsData, error } = await supabase
    .from("product_compatible_addons")
    .select("id, parent_product_id, addon_product_id, addon_type, is_default_enabled, display_order, allowed_sides, default_side, hatch_target_component_keys, hatch_alignment_config")
    .eq("parent_product_id", productId)
    .order("display_order", { ascending: true });

  if (error || !addonsData || addonsData.length === 0) {
    return [];
  }

  const addonIds = addonsData.map((d) => d.addon_product_id);
  const [productsRes, templatesRes, assetsRes] = await Promise.all([
    supabase
      .from("products")
      .select("product_id, product_name, base_price, status")
      .in("product_id", addonIds),
    supabase
      .from("product_templates")
      .select("template_id, product_id, template_name, model_strategy, measurement_unit, base_configuration, status")
      .in("product_id", addonIds),
    supabase
      .from("product_assets")
      .select("asset_id, product_id, template_id, component_id, asset_type, r2_object_key, file_name, is_primary, status")
      .in("product_id", addonIds),
  ]);

  const productMap = new Map((productsRes.data || []).map((p) => [p.product_id, p]));
  const addonTemplates = templatesRes.data || [];
  const addonAssets = assetsRes.data || [];
  const templateIds = addonTemplates.map((t) => t.template_id);

  const componentsRes = templateIds.length > 0
    ? await supabase
        .from("product_components")
        .select(`
          component_id,
          template_id,
          component_key,
          component_name,
          component_type,
          base_quantity,
          raw_material_id,
          dimension_binding,
          jalousie_config,
          span_ratio,
          is_removable,
          toggle_property_key,
          presentation_category,
          unit_price,
          pricing_method,
          component_data,
          is_accessory_slot,
          accessory_category,
          allowed_accessory_ids,
          position_options,
          status,
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
          ),
          product_component_materials (
            id,
            product_component_id,
            raw_material_id,
            is_default,
            display_order,
            raw_materials (
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
          )
        `)
        .in("template_id", templateIds)
        .order("component_key", { ascending: true })
    : { data: [] };

  const allComponents = componentsRes.data || [];

  return addonsData.map((row) => {
    const prod = productMap.get(row.addon_product_id);
    const template = addonTemplates.find((t) => t.product_id === row.addon_product_id);
    const productAssetsList = addonAssets.filter((a) => a.product_id === row.addon_product_id);
    const mappedAssets = mapStructuralAssets(productAssetsList);

    const templateComponents = template
      ? allComponents.filter((c) => c.template_id === template.template_id)
      : [];

    const componentAssetsMap = new Map<string, AssetRow>();
    productAssetsList.forEach((a) => {
      if (a.component_id) {
        componentAssetsMap.set(a.component_id, a as AssetRow);
      }
    });

    const mappedComponents: ProductComponentDefinition[] = [];
    for (const compRow of templateComponents) {
      const asset = componentAssetsMap.get(compRow.component_id);
      const url = getR2AssetUrl(asset?.r2_object_key);
      if (!asset || !url) continue;

      const compData = toJsonObject(compRow.component_data);
      mappedComponents.push({
        componentId: compRow.component_id,
        componentKey: compRow.component_key,
        componentName: compRow.component_name,
        componentType: compRow.component_type,
        baseQuantity: toNumber(compRow.base_quantity, 1),
        rawMaterialId: (compRow.raw_material_id as string) || null,
        rawMaterial: parseRawMaterial((compRow as Record<string, unknown>).raw_materials),
        allowedMaterials: extractComponentBindings(compRow as Record<string, unknown>),
        defaultRawMaterialId: (compRow.raw_material_id as string) || null,
        dimensionBinding: compRow.dimension_binding || "FIXED",
        spanRatio: typeof compRow.span_ratio === "number" ? compRow.span_ratio : 1.0,
        isRemovable: Boolean(compRow.is_removable),
        togglePropertyKey: (compRow.toggle_property_key as string) || null,
        presentationCategory: compRow.presentation_category || "Framing",
        componentData: compData,
        isAccessorySlot: Boolean((compRow as Record<string, unknown>).is_accessory_slot),
        accessoryCategory: ((compRow as Record<string, unknown>).accessory_category as import("@/lib/admin/products/types").AccessoryCategory) || null,
        allowedAccessoryIds: ((compRow as Record<string, unknown>).allowed_accessory_ids as string[]) || [],
        positionOptions: ((compRow as Record<string, unknown>).position_options as import("@/lib/admin/products/types").AccessoryPositionOptions) || null,
        unitPrice: typeof (compRow as Record<string, unknown>).unit_price === "number"
          ? (compRow as Record<string, unknown>).unit_price as number
          : ((compRow as Record<string, unknown>).unit_price ? Number((compRow as Record<string, unknown>).unit_price) : undefined),
        pricingMethod: ((compRow as Record<string, unknown>).pricing_method as string) || undefined,
        handingMetadata: (compData?.handing_metadata as import("@/lib/admin/products/types").ComponentHandingMetadata) || null,
        jalousieConfig: ((compRow as Record<string, unknown>).jalousie_config || compData?.jalousie_config) as import("@/lib/pricing/types").JalousieConfig || null,
        model: {
          assetId: asset.asset_id,
          r2ObjectKey: asset.r2_object_key,
          url,
          fileName: asset.file_name,
          sourceDimensionsMm: readSourceDimensionsMm(compData),
        },
      });
    }

    return {
      id: row.id,
      parentProductId: row.parent_product_id,
      addonProductId: row.addon_product_id,
      addonType: row.addon_type as "screen" | "grill",
      isDefaultEnabled: Boolean(row.is_default_enabled),
      displayOrder: typeof row.display_order === "number" ? row.display_order : 0,
      allowedSides: (row.allowed_sides as "front" | "back" | "both") || "both",
      defaultSide: (row.default_side as "front" | "back") || "back",
      hatchTargetComponentKeys: (row.hatch_target_component_keys as string[]) || null,
      hatchAlignmentConfig: (row.hatch_alignment_config as Record<string, unknown>) || null,
      addonProduct: prod
        ? {
            productId: prod.product_id,
            productName: prod.product_name,
            basePrice: Number(prod.base_price) || 0,
            status: prod.status,
          }
        : undefined,
      template: template
        ? {
            templateId: template.template_id,
            templateName: template.template_name,
            modelStrategy: template.model_strategy,
            measurementUnit: template.measurement_unit,
            baseConfiguration: toJsonObject(template.base_configuration),
          }
        : undefined,
      components: mappedComponents,
      assets: mappedAssets,
    };
  });
}

export async function getProductStructuralDefinition(
  productId: string,
): Promise<ProductStructuralDefinition> {
  const supabase = await createSupabaseServerClient();

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("product_id, product_name, product_type, description, base_price, status, is_addon, addon_type, is_accessory, accessory_category, accessory_mounting_type")
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
        jalousie_config,
        span_ratio,
        is_removable,
        toggle_property_key,
        presentation_category,
        unit_price,
        pricing_method,
        component_data,
        is_accessory_slot,
        accessory_category,
        allowed_accessory_ids,
        position_options,
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
        ),
        product_component_materials (
          id,
          product_component_id,
          raw_material_id,
          is_default,
          display_order,
          raw_materials (
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
      allowedMaterials: extractComponentBindings(row as Record<string, unknown>),
      defaultRawMaterialId: (row.raw_material_id as string) || null,
      dimensionBinding: row.dimension_binding || "FIXED",
      spanRatio: typeof row.span_ratio === "number" ? row.span_ratio : 1.0,
      isRemovable: Boolean(row.is_removable),
      togglePropertyKey: (row.toggle_property_key as string) || null,
      presentationCategory: row.presentation_category || "Framing",
      componentData,
      isAccessorySlot: Boolean((row as Record<string, unknown>).is_accessory_slot),
      accessoryCategory: ((row as Record<string, unknown>).accessory_category as import("@/lib/admin/products/types").AccessoryCategory) || null,
      allowedAccessoryIds: ((row as Record<string, unknown>).allowed_accessory_ids as string[]) || [],
      positionOptions: ((row as Record<string, unknown>).position_options as import("@/lib/admin/products/types").AccessoryPositionOptions) || null,
      unitPrice: typeof (row as Record<string, unknown>).unit_price === "number"
        ? (row as Record<string, unknown>).unit_price as number
        : ((row as Record<string, unknown>).unit_price ? Number((row as Record<string, unknown>).unit_price) : undefined),
      pricingMethod: ((row as Record<string, unknown>).pricing_method as string) || undefined,
      handingMetadata: (componentData?.handing_metadata as import("@/lib/admin/products/types").ComponentHandingMetadata) || null,
      jalousieConfig: ((row as Record<string, unknown>).jalousie_config || componentData?.jalousie_config) as import("@/lib/pricing/types").JalousieConfig || null,
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
      isAddon: Boolean(product.is_addon),
      addonType: (product.addon_type as "screen" | "grill") || null,
      isAccessory: Boolean(product.is_accessory),
      accessoryCategory: product.accessory_category || null,
      accessoryMountingType: product.accessory_mounting_type || null,
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
    compatibleAddons: await fetchCompatibleAddons(supabase, productId),
  };
}

export async function getDraftStructuralDefinition(
  productId: string,
): Promise<ProductStructuralDefinition> {
  const supabase = await createSupabaseServerClient();

  // Same as getProductStructuralDefinition but without eq("status", "Active") for product and template
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("product_id, product_name, product_type, description, base_price, status, is_addon, addon_type, is_accessory, accessory_category, accessory_mounting_type")
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
        jalousie_config,
        span_ratio,
        is_removable,
        toggle_property_key,
        presentation_category,
        unit_price,
        pricing_method,
        component_data,
        is_accessory_slot,
        accessory_category,
        allowed_accessory_ids,
        position_options,
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
        ),
        product_component_materials (
          id,
          product_component_id,
          raw_material_id,
          is_default,
          display_order,
          raw_materials (
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
      allowedMaterials: extractComponentBindings(row as Record<string, unknown>),
      defaultRawMaterialId: (row.raw_material_id as string) || null,
      dimensionBinding: row.dimension_binding || "FIXED",
      spanRatio: typeof row.span_ratio === "number" ? row.span_ratio : 1.0,
      isRemovable: Boolean(row.is_removable),
      togglePropertyKey: (row.toggle_property_key as string) || null,
      presentationCategory: row.presentation_category || "Framing",
      componentData,
      isAccessorySlot: Boolean((row as Record<string, unknown>).is_accessory_slot),
      accessoryCategory: ((row as Record<string, unknown>).accessory_category as import("@/lib/admin/products/types").AccessoryCategory) || null,
      allowedAccessoryIds: ((row as Record<string, unknown>).allowed_accessory_ids as string[]) || [],
      positionOptions: ((row as Record<string, unknown>).position_options as import("@/lib/admin/products/types").AccessoryPositionOptions) || null,
      unitPrice: typeof (row as Record<string, unknown>).unit_price === "number"
        ? (row as Record<string, unknown>).unit_price as number
        : ((row as Record<string, unknown>).unit_price ? Number((row as Record<string, unknown>).unit_price) : undefined),
      pricingMethod: ((row as Record<string, unknown>).pricing_method as string) || undefined,
      handingMetadata: (componentData?.handing_metadata as import("@/lib/admin/products/types").ComponentHandingMetadata) || null,
      jalousieConfig: ((row as Record<string, unknown>).jalousie_config || componentData?.jalousie_config) as import("@/lib/pricing/types").JalousieConfig || null,
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
      isAddon: Boolean(product.is_addon),
      addonType: (product.addon_type as "screen" | "grill") || null,
      isAccessory: Boolean(product.is_accessory),
      accessoryCategory: product.accessory_category || null,
      accessoryMountingType: product.accessory_mounting_type || null,
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
    compatibleAddons: await fetchCompatibleAddons(supabase, productId),
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
    let width = toNumber(record.width ?? record.x, Number.NaN);
    let height = toNumber(record.height ?? record.y, Number.NaN);
    let depth = toNumber(record.depth ?? record.z, Number.NaN);

    // If dimensions are stored in meters (all positive dimensions <= 10), convert to mm
    if (width > 0 && width <= 10 && height > 0 && height <= 10) {
      width *= 1000;
      height *= 1000;
      depth = depth > 0 ? depth * 1000 : depth;
    }

    if (width > 0 && height > 0 && depth > 0) {
      return { width, height, depth };
    }
  }

  return null;
}

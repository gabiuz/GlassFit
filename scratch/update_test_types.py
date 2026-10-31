with open('tests/unit/casementHardwarePlacement.test.ts', 'r', encoding='utf-8') as f:
    c = f.read().replace('\r\n', '\n')

old_code = """      template: {
        templateId: "tpl-casement",
        templateName: "Casement Window Template",
        modelStrategy: "Continuous",
        measurementUnit: "mm",
        baseConfiguration: {
          width: 1880,
          height: 1380,
        },
      },
      components: [
        {
          componentId: "comp_frame",
          componentKey: "cw_frame",
          componentName: "Outer Frame",
          componentType: "Frame",
          presentationCategory: "Framing",
          baseQuantity: 1,
          dimensionBinding: "PERIMETER",
          isRemovable: false,
          componentData: {},
        },
        {
          componentId: "comp_stays",
          componentKey: "cw_friction_stays",
          componentName: "Friction Stays",
          componentType: "Hardware",
          presentationCategory: "Hardware",
          baseQuantity: 1,
          dimensionBinding: "FIXED",
          isRemovable: false,
          componentData: {},
        },
        {
          componentId: "comp_handles",
          componentKey: "cw_handles",
          componentName: "Casement Handles",
          componentType: "Hardware",
          presentationCategory: "Hardware",
          baseQuantity: 1,
          dimensionBinding: "FIXED",
          isRemovable: false,
          componentData: {},
        },
      ],
      parameters: [],
      rules: [],
    };

    // Build at narrow width: 800mm (scaleX = 800 / 1880 ≈ 0.4255)
    const resolved: ResolvedStructure = {
      templateId: "tpl-casement",
      productId: "casement-window",
      resolvedValues: { width: 800, height: 1380 },
      numericValuesMm: { width: 800, height: 1380 },
      componentQuantities: { cw_frame: 1, cw_friction_stays: 1, cw_handles: 1 },
      pricingModifiers: [],
    };"""

new_code = """      template: {
        templateId: "tpl-casement",
        templateName: "Casement Window Template",
        modelStrategy: "Parametric",
        measurementUnit: "mm",
        baseConfiguration: {
          width: 1880,
          height: 1380,
        },
      },
      components: [
        {
          componentId: "comp_frame",
          componentKey: "cw_frame",
          componentName: "Outer Frame",
          componentType: "Frame",
          presentationCategory: "Framing",
          baseQuantity: 1,
          dimensionBinding: "PERIMETER",
          isRemovable: false,
          componentData: {},
          model: {
            assetId: "asset_frame",
            r2ObjectKey: "models/cw_frame.glb",
            url: "https://test.local/cw_frame.glb",
            fileName: "CW_Frame.glb",
            sourceDimensionsMm: { width: 1880, height: 1380, depth: 60 },
          },
        },
        {
          componentId: "comp_stays",
          componentKey: "cw_friction_stays",
          componentName: "Friction Stays",
          componentType: "Hardware",
          presentationCategory: "Hardware",
          baseQuantity: 1,
          dimensionBinding: "FIXED",
          isRemovable: false,
          componentData: {},
          model: {
            assetId: "asset_stays",
            r2ObjectKey: "models/cw_stays.glb",
            url: "https://test.local/cw_stays.glb",
            fileName: "CW_Friction_Stays.glb",
            sourceDimensionsMm: { width: 1880, height: 1380, depth: 20 },
          },
        },
        {
          componentId: "comp_handles",
          componentKey: "cw_handles",
          componentName: "Casement Handles",
          componentType: "Hardware",
          presentationCategory: "Hardware",
          baseQuantity: 1,
          dimensionBinding: "FIXED",
          isRemovable: false,
          componentData: {},
          model: {
            assetId: "asset_handles",
            r2ObjectKey: "models/cw_handles.glb",
            url: "https://test.local/cw_handles.glb",
            fileName: "CW_Handles.glb",
            sourceDimensionsMm: { width: 394, height: 130, depth: 50 },
          },
        },
      ],
      parameters: [],
      rules: [],
    };

    // Build at narrow width: 800mm (scaleX = 800 / 1880 ≈ 0.4255)
    const resolved: ResolvedStructure = {
      resolvedValues: { width: 800, height: 1380 },
      numericValuesMm: { width: 800, height: 1380 },
      componentQuantities: { cw_frame: 1, cw_friction_stays: 1, cw_handles: 1 },
      appliedRuleIds: [],
    };"""

if old_code in c:
    c = c.replace(old_code, new_code, 1)
    with open('tests/unit/casementHardwarePlacement.test.ts', 'w', encoding='utf-8', newline='\n') as f:
        f.write(c)
    print('SUCCESS')
else:
    print('NOT FOUND')


import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoDetectComponentSettings, suggestCandidateMaterials, isHeavyCommercialProfile } from '../../src/lib/admin/products/autoDetection';
import type { RawMaterial } from '../../src/lib/pricing/types';

const material = (id: string, description: string, price = 100): RawMaterial => ({
  id, material_code: id, description, category: 'Aluminum', finish_type: 'Analok',
  billing_unit: 'm', unit_price: price, waste_allowance: 0.12, is_active: true,
});
const materials = [material('heavy', '1-3/4" x 3" Aluminum Tube', 300), material('jw', 'Jalousie Head Section'), material('798', 'Series 798 Double Head'), material('38', 'Series 38 Outer Frame'), material('cab', '1" x 2" Tube', 140)];

test('QAD-TC100.6: fixture families select compatible profiles and exclude commercial tubing', () => {
  for (const [productType, expected] of [['Jalousie Window', 'jw'], ['Sliding Window', '798'], ['Casement Window', '38'], ['Modular Cabinet', 'cab'], ['Commercial Storefront', 'heavy']]) {
    const result = suggestCandidateMaterials('Framing', materials, undefined, 'WIDTH', { productType });
    assert.equal(result.defaultRawMaterialId, expected);
    if (productType !== 'Commercial Storefront') assert.ok(!result.materialBindings.some(binding => binding.rawMaterialId === 'heavy'));
  }
});
test('QAD-TC100.6: an unsuitable-only catalog leaves the default unassigned', () => {
  assert.equal(suggestCandidateMaterials('Framing', [materials[0]], undefined, 'WIDTH', { productType: 'Jalousie' }).defaultRawMaterialId, null);
});
test('QAD-TC100.7: classification uses profile identity rather than expensive residential finishes', () => {
  assert.ok(isHeavyCommercialProfile(materials[0]));
  assert.equal(isHeavyCommercialProfile(material('798', 'Series 798 Double Head', 350)), false);
});
test('QAD-TC100.4: structural rail stays permanent and projecting sill stays optional', () => {
  const bottom = autoDetectComponentSettings('JW_Frame_Bottom.glb');
  const sill = autoDetectComponentSettings('JW_Window_Sill.glb');
  assert.equal(bottom.componentLabel, 'Bottom Frame Rail');
  assert.equal(bottom.isRemovable, false);
  assert.equal(bottom.togglePropertyKey, null);
  assert.equal(sill.componentLabel, 'Projecting Exterior Sill');
  assert.equal(sill.isRemovable, true);
});

test('QAD-TC100.6: broad Window catalog types resolve their profile family from the product name', () => {
  const result = suggestCandidateMaterials('Framing', materials, undefined, 'WIDTH', { productType: 'Window', productName: 'Jalousie Window', modelStrategy: 'Parametric' });
  assert.equal(result.defaultRawMaterialId, 'jw');
  assert.ok(!result.materialBindings.some(binding => binding.rawMaterialId === 'heavy'));
});

import {
  ADMIN_PRODUCT_TYPE_ORDER,
  type AdminProductItem,
  type ProductStatusFilter,
  type ProductTypeFilter,
} from "./productData";

export type AdminProductFilterCriteria = {
  searchQuery: string;
  selectedType: ProductTypeFilter;
  selectedStatus: ProductStatusFilter;
};

export function deriveProductTypeOptions(
  products: readonly AdminProductItem[],
): string[] {
  const presentTypes = new Set(
    products.map((product) => product.type.trim()).filter(Boolean),
  );
  const canonicalTypes = ADMIN_PRODUCT_TYPE_ORDER.filter((type) =>
    presentTypes.delete(type),
  );
  const unexpectedTypes = [...presentTypes].sort((left, right) =>
    left.localeCompare(right),
  );

  return [...canonicalTypes, ...unexpectedTypes];
}

export function filterAdminProducts(
  products: readonly AdminProductItem[],
  criteria: AdminProductFilterCriteria,
): AdminProductItem[] {
  const query = criteria.searchQuery.trim().toLocaleLowerCase();
  const selectedType = criteria.selectedType?.trim() || null;

  return products.filter((product) => {
    const matchesSearch =
      query.length === 0 ||
      [product.id, product.name, product.type, product.description].some((value) =>
        value.toLocaleLowerCase().includes(query),
      );
    const matchesProductType =
      selectedType === null || product.type.trim() === selectedType;
    const matchesStatus =
      criteria.selectedStatus === null || product.status === criteria.selectedStatus;

    return matchesSearch && matchesProductType && matchesStatus;
  });
}

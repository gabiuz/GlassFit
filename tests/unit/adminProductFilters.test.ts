import assert from "node:assert";
import { describe, it } from "node:test";
import {
  deriveProductTypeOptions,
  filterAdminProducts,
} from "../../src/features/admin/products/productFilters";
import type { AdminProductItem } from "../../src/features/admin/products/productData";

const products: AdminProductItem[] = [
  {
    id: "window-published",
    name: "Sliding Window",
    type: "Window",
    description: "Two panel aluminum fixture",
    basePrice: "P10,000.00",
    status: "Published",
  },
  {
    id: "door-draft",
    name: "Sliding Door",
    type: "Door",
    description: "Wide patio opening",
    basePrice: "P20,000.00",
    status: "Draft",
  },
  {
    id: "cabinet-published",
    name: "Base Cabinet",
    type: "Cabinet",
    description: "Kitchen storage",
    basePrice: "P15,000.00",
    status: "Published",
  },
];

describe("QAD-TC51: Admin Product Type and Status Filters", () => {
  it("derives unique present types in canonical order without mutating products", () => {
    const input = [products[2], products[0], products[1], products[0]];
    const snapshot = [...input];

    assert.deepStrictEqual(deriveProductTypeOptions(input), ["Window", "Door", "Cabinet"]);
    assert.deepStrictEqual(input, snapshot);
  });

  it("trims types, removes empty values, and appends unknown values in locale order", () => {
    const input: AdminProductItem[] = [
      { ...products[0], type: "  Window  " },
      { ...products[1], type: "Skylight" },
      { ...products[2], type: "Awning" },
      { ...products[2], id: "empty-type", type: "   " },
    ];

    assert.deepStrictEqual(deriveProductTypeOptions(input), [
      "Window",
      "Awning",
      "Skylight",
    ]);
  });

  it("returns no type options for an empty product list", () => {
    assert.deepStrictEqual(deriveProductTypeOptions([]), []);
  });

  it("filters by normalized search text across all searchable fields", () => {
    assert.deepStrictEqual(
      filterAdminProducts(products, {
        searchQuery: "  SLIDING  ",
        selectedType: null,
        selectedStatus: null,
      }).map((product) => product.id),
      ["window-published", "door-draft"],
    );
  });

  it("filters by exact trimmed product type", () => {
    assert.deepStrictEqual(
      filterAdminProducts(products, {
        searchQuery: "",
        selectedType: " Window ",
        selectedStatus: null,
      }).map((product) => product.id),
      ["window-published"],
    );
  });

  it("filters by normalized client status", () => {
    assert.deepStrictEqual(
      filterAdminProducts(products, {
        searchQuery: "",
        selectedType: null,
        selectedStatus: "Draft",
      }).map((product) => product.id),
      ["door-draft"],
    );
  });

  it("combines search, product type, and status with logical AND", () => {
    assert.deepStrictEqual(
      filterAdminProducts(products, {
        searchQuery: "sliding",
        selectedType: "Window",
        selectedStatus: "Published",
      }).map((product) => product.id),
      ["window-published"],
    );
    assert.deepStrictEqual(
      filterAdminProducts(products, {
        searchQuery: "sliding",
        selectedType: "Window",
        selectedStatus: "Draft",
      }),
      [],
    );
  });

  it("does not mutate the input while filtering", () => {
    const snapshot = products.map((product) => ({ ...product }));

    filterAdminProducts(products, {
      searchQuery: "window",
      selectedType: "Window",
      selectedStatus: "Published",
    });

    assert.deepStrictEqual(products, snapshot);
  });
});

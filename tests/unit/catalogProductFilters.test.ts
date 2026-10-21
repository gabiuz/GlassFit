import assert from "node:assert";
import { describe, it } from "node:test";
import {
  filterProductList,
  calculateActiveFilters,
  MIN_PRICE,
  MAX_PRICE,
  type FilterState,
} from "../../src/features/product/components/ProductFilterContext";
import type { CatalogProduct } from "../../src/lib/products/types";

const mockProducts: CatalogProduct[] = [
  {
    id: "prod-001",
    name: "Sliding Window Deluxe",
    type: "Window",
    description: "Heavy duty aluminum extrusion with clear tempered glass",
    basePrice: 15000,
    rendererKey: "window",
    imageUrl: "/images/sliding-window.jpg",
    imageUrls: ["/images/sliding-window.jpg"],
    previewGlbUrl: null,
  },
  {
    id: "prod-002",
    name: "French Patio Door",
    type: "Door",
    description: "Elegant double-pane swing door for outdoor living",
    basePrice: 32000,
    rendererKey: null,
    imageUrl: "/images/french-door.jpg",
    imageUrls: ["/images/french-door.jpg"],
    previewGlbUrl: null,
  },
  {
    id: "prod-003",
    name: "Aluminum Kitchen Base Cabinet",
    type: "Cabinet",
    description: "Moisture-resistant modular aluminum cabinet",
    basePrice: 22000,
    rendererKey: "cabinet",
    imageUrl: "/images/kitchen-cabinet.jpg",
    imageUrls: ["/images/kitchen-cabinet.jpg"],
    previewGlbUrl: null,
  },
  {
    id: "prod-004",
    name: "Frameless Shower Enclosure",
    type: "Enclosure",
    description: "Minimalist 10mm tempered glass enclosure",
    basePrice: 45000,
    rendererKey: null,
    imageUrl: "/images/shower-enclosure.jpg",
    imageUrls: ["/images/shower-enclosure.jpg"],
    previewGlbUrl: null,
  },
];

const baseState: FilterState = {
  searchQuery: "",
  range: [MIN_PRICE, MAX_PRICE],
  selectedCategory: "All",
  anodized: [],
  powderCoated: [],
  glass: [],
  checkedDoors: [],
  materialFinish: [],
  aluminumProfile: [],
  glassProfile: [],
  glassThickness: [],
};

describe("QAD-TC52: Catalog Product Search and Filter", () => {
  it("returns all products when search query is empty and no filters are set", () => {
    const results = filterProductList(mockProducts, baseState);
    assert.strictEqual(results.length, 4);
  });

  it("filters products by partial name case-insensitively", () => {
    const results = filterProductList(mockProducts, {
      ...baseState,
      searchQuery: "sliding",
    });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, "prod-001");
  });

  it("filters products by fixture type", () => {
    const results = filterProductList(mockProducts, {
      ...baseState,
      searchQuery: "Door",
    });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, "prod-002");
  });

  it("filters products by display category label", () => {
    const results = filterProductList(mockProducts, {
      ...baseState,
      searchQuery: "Windows",
    });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, "prod-001");
  });

  it("filters products by keywords in description", () => {
    const results = filterProductList(mockProducts, {
      ...baseState,
      searchQuery: "tempered glass",
    });
    // prod-001 (clear tempered glass) and prod-004 (10mm tempered glass)
    assert.strictEqual(results.length, 2);
    assert.deepStrictEqual(
      results.map((p) => p.id),
      ["prod-001", "prod-004"]
    );
  });

  it("supports multi-term search across different product fields", () => {
    // "aluminum" in description/name, "window" in type/name
    const results = filterProductList(mockProducts, {
      ...baseState,
      searchQuery: "aluminum window",
    });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, "prod-001");
  });

  it("returns empty array when search query matches no products", () => {
    const results = filterProductList(mockProducts, {
      ...baseState,
      searchQuery: "nonexistent fixture xyz",
    });
    assert.strictEqual(results.length, 0);
  });

  it("ignores surrounding whitespace in search query", () => {
    const results = filterProductList(mockProducts, {
      ...baseState,
      searchQuery: "   cabinet   ",
    });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, "prod-003");
  });

  it("combines search query with category filter via logical AND", () => {
    // Search for "aluminum" matches prod-001 (Sliding Window) and prod-003 (Kitchen Cabinet)
    // When category is restricted to "Cabinets", only prod-003 matches
    const results = filterProductList(mockProducts, {
      ...baseState,
      searchQuery: "aluminum",
      selectedCategory: "Cabinets",
    });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, "prod-003");
  });

  it("combines search query with price range filter via logical AND", () => {
    // Both prod-001 (15000) and prod-004 (45000) match "tempered glass"
    // Restricting range to [10000, 20000] leaves only prod-001
    const results = filterProductList(mockProducts, {
      ...baseState,
      searchQuery: "tempered glass",
      range: [10000, 20000],
    });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, "prod-001");
  });

  it("increments active filters count when search query is present", () => {
    assert.strictEqual(calculateActiveFilters(baseState), 0);

    const withSearch = calculateActiveFilters({
      ...baseState,
      searchQuery: "window",
    });
    assert.strictEqual(withSearch, 1);

    const withSearchAndCategory = calculateActiveFilters({
      ...baseState,
      searchQuery: "window",
      selectedCategory: "Windows",
    });
    assert.strictEqual(withSearchAndCategory, 2);
  });

  it("does not mutate the source product array while filtering", () => {
    const snapshot = JSON.stringify(mockProducts);
    filterProductList(mockProducts, {
      ...baseState,
      searchQuery: "sliding",
      range: [0, 50000],
    });
    assert.strictEqual(JSON.stringify(mockProducts), snapshot);
  });
});

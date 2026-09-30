export type AdminProductStatus = "Published" | "Draft";

export const ADMIN_PRODUCT_TYPE_ORDER = [
  "Window",
  "Door",
  "Partition",
  "Cabinet",
  "Enclosure",
  "Railing",
  "Other",
] as const;

export type ProductTypeFilter = string | null;
export type ProductStatusFilter = AdminProductStatus | null;

export type AdminProductItem = {
  id: string;
  name: string;
  type: string;
  description: string;
  basePrice: string;
  status: AdminProductStatus;
};

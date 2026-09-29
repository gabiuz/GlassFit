export type AdminProductStatus = "Published" | "Draft";

export type AdminProductItem = {
  id: string;
  name: string;
  type: string;
  description: string;
  basePrice: string;
  status: AdminProductStatus;
};


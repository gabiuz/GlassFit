export type AdminProductStatus = "Published" | "Draft";

export type AdminProductItem = {
  id: string;
  name: string;
  type: string;
  description: string;
  basePrice: string;
  status: AdminProductStatus;
};

export const initialAdminProducts: AdminProductItem[] = [
  {
    id: "PD_001",
    name: "Aluminum Sliding Window",
    type: "Window",
    description: "Double-track aluminum sliding window",
    basePrice: "₱ 12,500.00",
    status: "Published",
  },
  {
    id: "PD_002",
    name: "Aluminum Sliding Window",
    type: "Window",
    description: "Single-track casement variant",
    basePrice: "₱ 9,800.00",
    status: "Draft",
  },
  {
    id: "PD_003",
    name: "Aluminum Sliding Window",
    type: "Window",
    description: "Triple-track with glass louver",
    basePrice: "₱ 15,200.00",
    status: "Published",
  },
  {
    id: "PD_004",
    name: "Aluminum Sliding Window",
    type: "Window",
    description: "Heavy-duty commercial grade",
    basePrice: "₱ 18,000.00",
    status: "Draft",
  },
  {
    id: "PD_005",
    name: "Aluminum Sliding Window",
    type: "Window",
    description: "Residential slim-frame design",
    basePrice: "₱ 11,300.00",
    status: "Draft",
  },
  {
    id: "PD_006",
    name: "Aluminum Sliding Window",
    type: "Window",
    description: "Standard powder-coated finish",
    basePrice: "₱ 10,500.00",
    status: "Draft",
  },
  {
    id: "PD_007",
    name: "Aluminum Sliding Window",
    type: "Window",
    description: "Premium anodized aluminum frame",
    basePrice: "₱ 16,700.00",
    status: "Draft",
  },
  {
    id: "PD_008",
    name: "Aluminum Sliding Window",
    type: "Window",
    description: "Economy model with basic locking",
    basePrice: "₱ 7,900.00",
    status: "Draft",
  },
  {
    id: "PD_009",
    name: "Aluminum Sliding Window",
    type: "Window",
    description: "Frosted glass privacy window",
    basePrice: "₱ 13,400.00",
    status: "Published",
  },
  {
    id: "PD_010",
    name: "Aluminum Sliding Window",
    type: "Window",
    description: "Tinted glass with thermal insulation",
    basePrice: "₱ 19,500.00",
    status: "Draft",
  },
];

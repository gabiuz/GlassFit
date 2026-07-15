export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  tags: string[];
  description: string;
  image: string;
  doorStyle?: string;
  materials: string[];
  aluminumFinish?: string;
  powderCoatedFinish?: string;
  glassFinish?: string;
  aluminumProfile?: string;
  glassProfile?: string;
  thickness?: string;
}

export const mockProducts: Product[] = [
  {
    id: "prod-1",
    name: "Aluminum Sliding Window",
    category: "Windows",
    price: 15000,
    tags: ["Aluminum", "Frosted"],
    description: "A customizable aluminum-framed window suitable for residential and commercial spaces.",
    image: "/product_card_placeholder.png",
    materials: ["Aluminum"],
    aluminumFinish: "Natural/Silver",
    aluminumProfile: "Deluxe",
  },
  {
    id: "prod-2",
    name: "French Glass Door",
    category: "Doors",
    price: 32000,
    tags: ["Glass", "Tempered"],
    description: "An elegant double-door glass installation designed to create a bright and open transition.",
    image: "/product_card_placeholder.png",
    doorStyle: "French Doors",
    materials: ["Glass", "Aluminum"],
    aluminumFinish: "Analok (Champagne/Gold)",
    glassFinish: "Clear",
    glassProfile: "Tempered Glass",
    thickness: "6 mm",
  },
  {
    id: "prod-3",
    name: "Standard Sliding Patio Door",
    category: "Doors",
    price: 24500,
    tags: ["Aluminum", "Sliding"],
    description: "Durable and smooth sliding doors with natural finish aluminum frames.",
    image: "/product_card_placeholder.png",
    doorStyle: "Sliding Doors",
    materials: ["Aluminum", "Glass"],
    aluminumFinish: "Natural/Silver",
    glassFinish: "Clear",
    thickness: "6 mm",
  },
  {
    id: "prod-4",
    name: "Tempered Glass Shower Enclosure",
    category: "Shower Enclosure",
    price: 18000,
    tags: ["Glass", "Tempered"],
    description: "Sleek and modern frameless design for luxury shower areas.",
    image: "/product_card_placeholder.png",
    materials: ["Glass"],
    glassFinish: "Smoke",
    glassProfile: "Tempered Glass",
    thickness: "10 mm",
  },
  {
    id: "prod-5",
    name: "Powder-Coated White Swing Door",
    category: "Doors",
    price: 12500,
    tags: ["White", "Swing"],
    description: "Clean aesthetic white powder-coated swing door with frosted glass panel.",
    image: "/product_card_placeholder.png",
    doorStyle: "Swing Doors",
    materials: ["Aluminum", "Glass"],
    powderCoatedFinish: "White",
    glassFinish: "Clear",
    thickness: "3 mm",
  },
  {
    id: "prod-6",
    name: "Analok Gold Kitchen Cabinet",
    category: "Cabinets",
    price: 45000,
    tags: ["Analok", "Cabinet"],
    description: "High-end modular cabinets finished in premium analok champagne gold coating.",
    image: "/product_card_placeholder.png",
    materials: ["Aluminum", "Glass"],
    aluminumFinish: "Analok (Champagne/Gold)",
    glassFinish: "Clear",
    aluminumProfile: "High - End",
    thickness: "3 mm",
  },
  {
    id: "prod-7",
    name: "Matte Gray Partition Wall",
    category: "Partition",
    price: 28000,
    tags: ["Partition", "Office"],
    description: "Sturdy aluminum partition walls in modern matte gray coating.",
    image: "/product_card_placeholder.png",
    materials: ["Aluminum"],
    aluminumFinish: "Matte Gray",
    aluminumProfile: "Tubular",
  },
  {
    id: "prod-8",
    name: "Double Swing Screen Door",
    category: "Doors",
    price: 9500,
    tags: ["Screen", "Aluminum"],
    description: "Mesh screen doors keeping pests away while letting in ventilation.",
    image: "/product_card_placeholder.png",
    doorStyle: "Screen Doors",
    materials: ["Aluminum"],
    aluminumFinish: "Black",
    aluminumProfile: "Deluxe",
  },
  {
    id: "prod-9",
    name: "Exterior Storefront Window Setup",
    category: "Exterior Installation",
    price: 49900,
    tags: ["Commercial", "Exterior"],
    description: "Heavy-duty exterior storefront installations with thick glass profiles.",
    image: "/product_card_placeholder.png",
    materials: ["Glass", "Aluminum"],
    aluminumFinish: "Bronze/Brown",
    glassFinish: "Bronze",
    glassProfile: "Reflective Glass",
    thickness: "12 mm",
  }
];

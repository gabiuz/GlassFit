"use server";

import { getProductStructuralDefinition } from "@/lib/visualization/structuralData";

export async function loadWorkspaceProductDefinition(productId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productId)) {
    throw new Error("Invalid product selection.");
  }
  try {
    const definition = await getProductStructuralDefinition(productId);
    if (definition.product.productId !== productId) throw new Error("Product mismatch.");
    return definition;
  } catch {
    throw new Error("This product is unavailable for visualization. Please try again.");
  }
}

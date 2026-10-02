import { loadWorkspaceProductDefinition } from "@/app/visualize/actions";
import type { ProductStructuralDefinition } from "./types";

const definitions = new Map<string, ProductStructuralDefinition>();
const pending = new Map<string, Promise<ProductStructuralDefinition>>();
const key = (sessionId: string, productId: string) => `${sessionId}:${productId}`;

export function seedWorkspaceDefinition(sessionId: string, definition: ProductStructuralDefinition) {
  definitions.set(key(sessionId, definition.product.productId), definition);
}

export function clearWorkspaceDefinitions() {
  definitions.clear();
  pending.clear();
}

export async function getWorkspaceDefinition(sessionId: string, productId: string) {
  const cacheKey = key(sessionId, productId);
  const cached = definitions.get(cacheKey);
  if (cached) return cached;
  const existing = pending.get(cacheKey);
  if (existing) return existing;
  const request = loadWorkspaceProductDefinition(productId).then((definition) => {
    if (definition.product.productId !== productId) throw new Error("Product definition mismatch.");
    if (pending.get(cacheKey) === request) definitions.set(cacheKey, definition);
    return definition;
  }).finally(() => {
    if (pending.get(cacheKey) === request) pending.delete(cacheKey);
  });
  pending.set(cacheKey, request);
  return request;
}

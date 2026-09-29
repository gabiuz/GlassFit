type ObjectUrlApi = {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
};

type RegistryEntry = {
  objectUrl: string;
  owners: number;
};

export class VariationAssetRegistry {
  private readonly entries = new Map<string, RegistryEntry>();
  private readonly api: ObjectUrlApi;

  constructor(api: ObjectUrlApi = URL) {
    this.api = api;
  }

  acquire(cacheKey: string, blob: Blob) {
    const existing = this.entries.get(cacheKey);
    if (existing) {
      existing.owners += 1;
      return existing.objectUrl;
    }
    const objectUrl = this.api.createObjectURL(blob);
    this.entries.set(cacheKey, { objectUrl, owners: 1 });
    return objectUrl;
  }

  peek(cacheKey: string) {
    return this.entries.get(cacheKey)?.objectUrl ?? null;
  }

  release(cacheKey: string) {
    const entry = this.entries.get(cacheKey);
    if (!entry) return;
    entry.owners -= 1;
    if (entry.owners > 0) return;
    this.api.revokeObjectURL(entry.objectUrl);
    this.entries.delete(cacheKey);
  }

  revoke(cacheKey: string) {
    const entry = this.entries.get(cacheKey);
    if (!entry) return;
    this.api.revokeObjectURL(entry.objectUrl);
    this.entries.delete(cacheKey);
  }

  revokeAll() {
    for (const entry of this.entries.values()) {
      this.api.revokeObjectURL(entry.objectUrl);
    }
    this.entries.clear();
  }
}

export const variationAssetRegistry = new VariationAssetRegistry();

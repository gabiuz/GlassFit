import type {
  AluminumFinishKey,
} from "./colorVariations";
import type {
  VariationAssetPriority,
  VariationAssetRef,
} from "./types";

const DATABASE_NAME = "glassfit-visualization-assets";
const DATABASE_VERSION = 1;
const OBJECT_STORE_NAME = "variationLayers";
const DEFAULT_SESSION_BUDGET_BYTES = 64 * 1024 * 1024;
const DEFAULT_MEMORY_BUDGET_BYTES = 16 * 1024 * 1024;

export type VariationAssetRecord = {
  cacheKey: string;
  assetSessionId: string;
  overlayId: string;
  finish: AluminumFinishKey;
  fingerprint: string;
  width: number;
  height: number;
  mimeType: "image/webp" | "image/png";
  blob: Blob;
  createdAt: number;
  lastAccessedAt: number;
  priority: VariationAssetPriority;
};

export interface VariationAssetStore {
  get(ref: VariationAssetRef): Promise<Blob | null>;
  put(record: VariationAssetRecord): Promise<VariationAssetRef>;
  remove(cacheKey: string): Promise<void>;
  removeOverlay(assetSessionId: string, overlayId: string): Promise<void>;
  removeSession(assetSessionId: string): Promise<void>;
  removeExpired(cutoffEpochMs: number): Promise<number>;
}

type StoreOptions = {
  indexedDB?: IDBFactory | null;
  maxMemoryBytes?: number;
};

class VariationCacheBudgetError extends Error {}

function toAssetRef(record: VariationAssetRecord): VariationAssetRef {
  return {
    cacheKey: record.cacheKey,
    mimeType: record.mimeType,
    byteLength: record.blob.size,
    width: record.width,
    height: record.height,
    fingerprint: record.fingerprint,
  };
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
  });
}

class BrowserVariationAssetStore implements VariationAssetStore {
  private readonly indexedDBFactory: IDBFactory | null;
  private readonly memory = new Map<string, VariationAssetRecord>();
  private readonly maxMemoryBytes: number;
  private databasePromise: Promise<IDBDatabase> | null = null;
  private persistentUnavailable = false;

  constructor(options: StoreOptions) {
    this.indexedDBFactory = options.indexedDB === undefined
      ? (typeof indexedDB === "undefined" ? null : indexedDB)
      : options.indexedDB;
    this.maxMemoryBytes = options.maxMemoryBytes ?? DEFAULT_MEMORY_BUDGET_BYTES;
  }

  async get(ref: VariationAssetRef) {
    const memoryRecord = this.memory.get(ref.cacheKey);
    if (memoryRecord) {
      if (memoryRecord.fingerprint !== ref.fingerprint) return null;
      memoryRecord.lastAccessedAt = Date.now();
      return memoryRecord.blob;
    }
    if (this.persistentUnavailable || !this.indexedDBFactory) return null;
    try {
      const database = await this.openDatabase();
      const transaction = database.transaction(OBJECT_STORE_NAME, "readwrite");
      const store = transaction.objectStore(OBJECT_STORE_NAME);
      const record = await requestResult(
        store.get(ref.cacheKey),
      ) as VariationAssetRecord | undefined;
      if (!record || record.fingerprint !== ref.fingerprint) return null;
      record.lastAccessedAt = Date.now();
      store.put(record);
      await transactionComplete(transaction);
      return record.blob;
    } catch (error) {
      this.disablePersistentStore(error);
      return null;
    }
  }

  async put(record: VariationAssetRecord) {
    if (!this.persistentUnavailable && this.indexedDBFactory) {
      try {
        await this.enforcePersistentBudget(record);
        const database = await this.openDatabase();
        const transaction = database.transaction(OBJECT_STORE_NAME, "readwrite");
        transaction.objectStore(OBJECT_STORE_NAME).put(record);
        await transactionComplete(transaction);
        return toAssetRef(record);
      } catch (error) {
        if (!(error instanceof VariationCacheBudgetError)) {
          this.disablePersistentStore(error);
        }
      }
    }
    this.memory.set(record.cacheKey, record);
    this.enforceMemoryBudget(record.cacheKey);
    return toAssetRef(record);
  }

  async remove(cacheKey: string) {
    this.memory.delete(cacheKey);
    await this.removePersistentWhere((record) => record.cacheKey === cacheKey);
  }

  async removeOverlay(assetSessionId: string, overlayId: string) {
    for (const [cacheKey, record] of this.memory) {
      if (record.assetSessionId === assetSessionId && record.overlayId === overlayId) {
        this.memory.delete(cacheKey);
      }
    }
    await this.removePersistentWhere((record) => (
      record.assetSessionId === assetSessionId && record.overlayId === overlayId
    ));
  }

  async removeSession(assetSessionId: string) {
    for (const [cacheKey, record] of this.memory) {
      if (record.assetSessionId === assetSessionId) this.memory.delete(cacheKey);
    }
    await this.removePersistentWhere((record) => record.assetSessionId === assetSessionId);
  }

  async removeExpired(cutoffEpochMs: number) {
    let removed = 0;
    for (const [cacheKey, record] of this.memory) {
      if (record.lastAccessedAt < cutoffEpochMs) {
        this.memory.delete(cacheKey);
        removed += 1;
      }
    }
    removed += await this.removePersistentWhere((record) => record.lastAccessedAt < cutoffEpochMs);
    return removed;
  }

  private openDatabase() {
    if (!this.indexedDBFactory) {
      return Promise.reject(new Error("IndexedDB is unavailable."));
    }
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.indexedDBFactory!.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        const store = database.objectStoreNames.contains(OBJECT_STORE_NAME)
          ? request.transaction!.objectStore(OBJECT_STORE_NAME)
          : database.createObjectStore(OBJECT_STORE_NAME, { keyPath: "cacheKey" });
        if (!store.indexNames.contains("assetSessionId")) {
          store.createIndex("assetSessionId", "assetSessionId", { unique: false });
        }
        if (!store.indexNames.contains("overlay")) {
          store.createIndex("overlay", ["assetSessionId", "overlayId"], { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed."));
      request.onblocked = () => reject(new Error("IndexedDB open was blocked."));
    });
    return this.databasePromise;
  }

  private async getPersistentRecords() {
    const database = await this.openDatabase();
    const transaction = database.transaction(OBJECT_STORE_NAME, "readonly");
    return await requestResult(transaction.objectStore(OBJECT_STORE_NAME).getAll()) as VariationAssetRecord[];
  }

  private async enforcePersistentBudget(incoming: VariationAssetRecord) {
    const records = await this.getPersistentRecords();
    const sessionRecords = records.filter((record) => record.assetSessionId === incoming.assetSessionId);
    const existingBytes = sessionRecords.reduce((sum, record) => (
      record.cacheKey === incoming.cacheKey ? sum : sum + record.blob.size
    ), 0);
    let quotaBudget = DEFAULT_SESSION_BUDGET_BYTES;
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      if (estimate.quota) {
        const availableBytes = Math.max(0, estimate.quota - (estimate.usage ?? 0));
        quotaBudget = Math.min(quotaBudget, availableBytes * 0.2);
      }
    }
    let projectedBytes = existingBytes + incoming.blob.size;
    const evictionCandidates = sessionRecords
      .filter((record) => record.priority === "idle" && record.cacheKey !== incoming.cacheKey)
      .sort((left, right) => left.lastAccessedAt - right.lastAccessedAt);
    for (const candidate of evictionCandidates) {
      if (projectedBytes <= quotaBudget) break;
      await this.deletePersistentKey(candidate.cacheKey);
      projectedBytes -= candidate.blob.size;
    }
    if (projectedBytes > quotaBudget) {
      throw new VariationCacheBudgetError("Variation cache budget reached.");
    }
  }

  private enforceMemoryBudget(protectedKey: string) {
    let total = [...this.memory.values()].reduce((sum, record) => sum + record.blob.size, 0);
    const candidates = [...this.memory.values()]
      .filter((record) => record.cacheKey !== protectedKey && record.priority === "idle")
      .sort((left, right) => left.lastAccessedAt - right.lastAccessedAt);
    for (const candidate of candidates) {
      if (total <= this.maxMemoryBytes) break;
      this.memory.delete(candidate.cacheKey);
      total -= candidate.blob.size;
    }
    const protectedRecord = this.memory.get(protectedKey);
    if (total > this.maxMemoryBytes && protectedRecord?.priority === "idle") {
      this.memory.delete(protectedKey);
      throw new VariationCacheBudgetError("Variation memory cache budget reached.");
    }
  }

  private async deletePersistentKey(cacheKey: string) {
    if (this.persistentUnavailable || !this.indexedDBFactory) return;
    const database = await this.openDatabase();
    const transaction = database.transaction(OBJECT_STORE_NAME, "readwrite");
    transaction.objectStore(OBJECT_STORE_NAME).delete(cacheKey);
    await transactionComplete(transaction);
  }

  private async removePersistentWhere(predicate: (record: VariationAssetRecord) => boolean) {
    if (this.persistentUnavailable || !this.indexedDBFactory) return 0;
    try {
      const records = await this.getPersistentRecords();
      const matches = records.filter(predicate);
      if (matches.length === 0) return 0;
      const database = await this.openDatabase();
      const transaction = database.transaction(OBJECT_STORE_NAME, "readwrite");
      const store = transaction.objectStore(OBJECT_STORE_NAME);
      for (const record of matches) store.delete(record.cacheKey);
      await transactionComplete(transaction);
      return matches.length;
    } catch (error) {
      this.disablePersistentStore(error);
      return 0;
    }
  }

  private disablePersistentStore(error: unknown) {
    this.persistentUnavailable = true;
    this.databasePromise = null;
    if (process.env.NODE_ENV !== "production") {
      console.warn("[GlassFit] Variation asset persistence is unavailable. Using memory fallback.", error);
    }
  }
}

export function createVariationAssetStore(options: StoreOptions = {}): VariationAssetStore {
  return new BrowserVariationAssetStore(options);
}

export const variationAssetStore = createVariationAssetStore();

export const VARIATION_ASSET_EXPIRY_MS = 24 * 60 * 60 * 1000;

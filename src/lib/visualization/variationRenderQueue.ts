import type { VariationAssetPriority } from "./types";

type ScheduleIdle = (run: () => void) => void;

export type VariationRenderJob<T> = {
  cacheKey: string;
  namespace: string;
  fingerprint: string;
  priority: VariationAssetPriority;
  run: () => Promise<T>;
};

type QueueEntry = VariationRenderJob<unknown> & {
  generation: number;
  sequence: number;
  promise: Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

const PRIORITY_WEIGHT: Record<VariationAssetPriority, number> = {
  user: 3,
  visible: 2,
  idle: 1,
};

function defaultIdleScheduler(run: () => void) {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    window.requestIdleCallback(() => run(), { timeout: 500 });
    return;
  }
  setTimeout(run, 0);
}

export class VariationRenderQueue {
  private readonly scheduleIdle: ScheduleIdle;
  private readonly entries = new Map<string, QueueEntry>();
  private readonly fingerprints = new Map<string, string>();
  private readonly generations = new Map<string, number>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private sequence = 0;
  private running = false;

  constructor(options: { scheduleIdle?: ScheduleIdle } = {}) {
    this.scheduleIdle = options.scheduleIdle ?? defaultIdleScheduler;
  }

  setFingerprint(namespace: string, fingerprint: string) {
    this.fingerprints.set(namespace, fingerprint);
    for (const [cacheKey, entry] of this.entries) {
      if (entry.namespace === namespace && entry.fingerprint !== fingerprint) {
        entry.reject(new Error("Variation render job became stale."));
        this.entries.delete(cacheKey);
      }
    }
  }

  enqueue<T>(job: VariationRenderJob<T>): Promise<T> {
    const currentFingerprint = this.fingerprints.get(job.namespace);
    if (currentFingerprint && currentFingerprint !== job.fingerprint) {
      return Promise.reject(new Error("Variation render job is stale."));
    }
    const existing = this.entries.get(job.cacheKey);
    if (existing) {
      if (PRIORITY_WEIGHT[job.priority] > PRIORITY_WEIGHT[existing.priority]) {
        existing.priority = job.priority;
      }
      this.scheduleDrain();
      return existing.promise as Promise<T>;
    }
    const inFlight = this.inFlight.get(job.cacheKey);
    if (inFlight) return inFlight as Promise<T>;
    let resolvePromise!: (value: unknown) => void;
    let rejectPromise!: (reason: Error) => void;
    const promise = new Promise<unknown>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    this.entries.set(job.cacheKey, {
      ...job,
      run: job.run as () => Promise<unknown>,
      generation: this.generations.get(job.namespace) ?? 0,
      sequence: this.sequence += 1,
      promise,
      resolve: resolvePromise,
      reject: rejectPromise,
    });
    this.scheduleDrain();
    return promise as Promise<T>;
  }

  cancelNamespace(namespace: string) {
    this.generations.set(namespace, (this.generations.get(namespace) ?? 0) + 1);
    this.fingerprints.delete(namespace);
    for (const [cacheKey, entry] of this.entries) {
      if (entry.namespace !== namespace) continue;
      entry.reject(new Error("Variation render job was cancelled."));
      this.entries.delete(cacheKey);
    }
  }

  cancelNamespacePrefix(prefix: string) {
    const namespaces = new Set<string>();
    for (const namespace of this.fingerprints.keys()) {
      if (namespace === prefix || namespace.startsWith(`${prefix}:`)) namespaces.add(namespace);
    }
    for (const entry of this.entries.values()) {
      if (entry.namespace === prefix || entry.namespace.startsWith(`${prefix}:`)) {
        namespaces.add(entry.namespace);
      }
    }
    for (const namespace of namespaces) this.cancelNamespace(namespace);
  }

  private scheduleDrain() {
    if (this.running) return;
    const next = this.pickNext();
    if (!next) return;
    if (next.priority === "idle") {
      this.scheduleIdle(() => void this.drain());
    } else {
      queueMicrotask(() => void this.drain());
    }
  }

  private pickNext() {
    return [...this.entries.values()].sort((left, right) => (
      PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority]
      || left.sequence - right.sequence
    ))[0];
  }

  private async drain() {
    if (this.running) return;
    const entry = this.pickNext();
    if (!entry) return;
    if (entry.priority === "idle" && typeof document !== "undefined" && document.hidden) {
      setTimeout(() => this.scheduleDrain(), 250);
      return;
    }
    this.running = true;
    this.entries.delete(entry.cacheKey);
    this.inFlight.set(entry.cacheKey, entry.promise);
    try {
      const initialFingerprint = this.fingerprints.get(entry.namespace);
      if (initialFingerprint && initialFingerprint !== entry.fingerprint) {
        throw new Error("Variation render job became stale.");
      }
      const result = await entry.run();
      const completedFingerprint = this.fingerprints.get(entry.namespace);
      const currentGeneration = this.generations.get(entry.namespace) ?? 0;
      if (
        (completedFingerprint && completedFingerprint !== entry.fingerprint)
        || currentGeneration !== entry.generation
      ) {
        throw new Error("Variation render job became stale.");
      }
      entry.resolve(result);
    } catch (error) {
      entry.reject(error instanceof Error ? error : new Error("Variation render failed."));
    } finally {
      this.running = false;
      this.inFlight.delete(entry.cacheKey);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      this.scheduleDrain();
    }
  }
}

export const variationRenderQueue = new VariationRenderQueue();

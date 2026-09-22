import { ALUMINUM_FINISH_OPTIONS } from "@/lib/products/materialMapping";

export type RrdAluminumFinishKey =
  | "white"
  | "analok"
  | "al_1001"
  | "al_1002"
  | "al_1003"
  | "al_1004"
  | "al_1005"
  | "al_1006"
  | "al_1007"
  | "al_1008"
  | "al_1009"
  | "al_1010"
  | "al_1011"
  | "al_1012"
  | "al_1013"
  | "al_1014"
  | "al_1015"
  | "al_1016"
  | "al_1017"
  | "al_1018"
  | "al_1019"
  | "al_1020"
  | "champagne"
  | "peacock_blue";

/** New snapshots use normalized R.R.D. keys. Legacy aliases remain input compatible. */
export type AluminumFinishKey = RrdAluminumFinishKey | "black" | "silver";

export const ALUMINUM_COLOR_VARIATIONS: Array<{
  key: RrdAluminumFinishKey;
  title: string;
  label: string;
  swatchClassName: string;
  previewHex: string;
}> = ALUMINUM_FINISH_OPTIONS.map((option) => ({
  key: option.id,
  title: `${option.label} Aluminum`,
  label: option.rrdCode === "Standard"
    ? "Standard R.R.D. frame finish"
    : `${option.rrdCode} frame finish`,
  swatchClassName: option.id === "white" ? "border border-neutral-300" : "",
  previewHex: option.previewHex,
}));

const RRD_ALUMINUM_FINISHES = new Set<RrdAluminumFinishKey>([
  "white", "analok", "al_1001", "al_1002", "al_1003", "al_1004",
  "al_1005", "al_1006", "al_1007", "al_1008", "al_1009", "al_1010",
  "al_1011", "al_1012", "al_1013", "al_1014", "al_1015", "al_1016",
  "al_1017", "al_1018", "al_1019", "al_1020", "champagne", "peacock_blue",
]);

export function isRrdAluminumFinish(value: unknown): value is RrdAluminumFinishKey {
  return typeof value === "string" && RRD_ALUMINUM_FINISHES.has(value as RrdAluminumFinishKey);
}

export function normalizeAluminumFinish(
  value: unknown,
): RrdAluminumFinishKey {
  if (value === "black") return "al_1009";
  if (value === "silver") return "al_1001";
  if (isRrdAluminumFinish(value)) return value;
  return "white";
}

export function getAlternateAluminumFinish(
  finish: AluminumFinishKey,
): AluminumFinishKey {
  return ALUMINUM_COLOR_VARIATIONS.find((item) => item.key !== normalizeAluminumFinish(finish))?.key ?? "al_1009";
}

export function getVariationFinishes(activeFinish: unknown): RrdAluminumFinishKey[] {
  const active = normalizeAluminumFinish(activeFinish);
  const base = ALUMINUM_COLOR_VARIATIONS.map((item) => item.key);
  return base.includes(active) ? base : [...base, active];
}

export function getAvailableVariationFinishes(
  variationMaps: Array<Partial<Record<RrdAluminumFinishKey, string>> | undefined>,
): RrdAluminumFinishKey[] {
  if (variationMaps.length === 0) return [];
  const candidates = Array.from(new Set([
    ...ALUMINUM_COLOR_VARIATIONS.map((item) => item.key),
    ...variationMaps.flatMap((map) => Object.keys(map ?? {})),
  ])).filter(isRrdAluminumFinish);
  return candidates.filter((finish) =>
    variationMaps.every((map) => Boolean(map?.[finish])),
  );
}

export function getAluminumVariationMetadata(finish: unknown) {
  const normalized = normalizeAluminumFinish(finish);
  const base = ALUMINUM_COLOR_VARIATIONS.find((item) => item.key === normalized);
  if (base) return base;
  return {
    key: normalized,
    title: `${normalized.replaceAll("_", " ").toUpperCase()} Aluminum`,
    label: "Selected R.R.D. frame finish",
    swatchClassName: "bg-neutral-400",
    previewHex: "#A3A3A3",
  };
}

export function getAluminumVariationTitle(finish: string | null | undefined) {
  const normalized = normalizeAluminumFinish(finish);
  return (
    ALUMINUM_COLOR_VARIATIONS.find((item) => item.key === normalized)?.title ??
    "Color Variation"
  );
}

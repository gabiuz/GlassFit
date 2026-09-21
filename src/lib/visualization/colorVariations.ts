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

/** Includes the legacy workspace keys until its saved snapshots are migrated. */
export type AluminumFinishKey = RrdAluminumFinishKey | "black" | "silver";

export const ALUMINUM_COLOR_VARIATIONS: Array<{
  key: AluminumFinishKey;
  title: string;
  label: string;
  swatchClassName: string;
}> = [
  {
    key: "white",
    title: "White Aluminum",
    label: "Clean white frame finish",
    swatchClassName: "bg-white border border-neutral-300",
  },
  {
    key: "black",
    title: "Black Aluminum",
    label: "Bold dark frame finish",
    swatchClassName: "bg-neutral-950",
  },
  {
    key: "silver",
    title: "Silver Aluminum",
    label: "Natural metallic frame finish",
    swatchClassName: "bg-gradient-to-br from-neutral-100 via-neutral-400 to-neutral-200",
  },
];

export function normalizeAluminumFinish(
  value: string | null | undefined,
): AluminumFinishKey {
  const match = ALUMINUM_COLOR_VARIATIONS.find((item) => item.key === value);
  if (match) return match.key;

  return "white";
}

export function getAlternateAluminumFinish(
  finish: AluminumFinishKey,
): AluminumFinishKey {
  return ALUMINUM_COLOR_VARIATIONS.find((item) => item.key !== finish)?.key ?? "black";
}

export function getAluminumVariationTitle(finish: string | null | undefined) {
  const normalized = normalizeAluminumFinish(finish);
  return (
    ALUMINUM_COLOR_VARIATIONS.find((item) => item.key === normalized)?.title ??
    "Color Variation"
  );
}

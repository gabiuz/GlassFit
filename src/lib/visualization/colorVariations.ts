export type AluminumFinishKey = "white" | "black" | "silver";

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
  if (value === "black" || value === "silver" || value === "white") {
    return value;
  }

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

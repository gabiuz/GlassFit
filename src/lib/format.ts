/** Formats a price for client-facing Philippine Peso displays. */
export function formatPeso(amount: number): string {
  const formattedAmount = new Intl.NumberFormat("en-PH", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `₱${formattedAmount}`;
}

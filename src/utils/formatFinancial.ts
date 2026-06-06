/** Display rules: absent numbers render as "-" in the UI */

export function fmtFin(
  n: number | null | undefined,
  opts?: { digits?: number; suffix?: string; prefix?: string }
): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  const digits = opts?.digits ?? 2;
  const s =
    digits === 0
      ? n.toLocaleString("tr-TR", { maximumFractionDigits: 0 })
      : n.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${opts?.prefix ?? ""}${s}${opts?.suffix ?? ""}`;
}

export function fmtFinPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return `${n.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

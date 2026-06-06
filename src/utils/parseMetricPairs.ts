export type MetricPair = { label: string; value: string; hint?: string };

const LABEL_HINT: { test: (s: string) => boolean; hint: string }[] = [
  { test: (s) => /^(F\/K|FK|P\/E|f\/k)/i.test(s), hint: "P/E — fiyatın kâra bölümü" },
  { test: (s) => /FD\/?FAV|FAVÖK|ebitda/i.test(s), hint: "FD/FAVÖK — işletme değerinin FAVÖK’e oranı" },
  { test: (s) => /PD\/?DD|P\/B|pd\/dd/i.test(s), hint: "PD/DD — fiyatın defter değerine oranı" },
  { test: (s) => /FD\/?Sat|satış/i.test(s), hint: "FD/Satışlar — değerin satışlara oranı" },
  { test: (s) => /Cari fiyat|fiyat.*TL/i.test(s), hint: "Bülten anındaki işlem fiyatı" },
  { test: (s) => /piyasa|market cap|değer/i.test(s), hint: "Piyasa değeri (büyüklük)" },
  { test: (s) => /halka|float|açık/i.test(s), hint: "Halka açıklık payı" },
  { test: (s) => /hisse kodu|ticker/i.test(s), hint: "Borsa kısa kodu" },
  { test: (s) => /^(S1H|S1A|S3A|SY|s1h|s1a)/i.test(s), hint: "Kıyas endeksine göre göreli getiri" },
];

export function hintForMetricLabel(label: string): string | undefined {
  const t = label.trim();
  for (const { test, hint } of LABEL_HINT) {
    if (test(t)) return hint;
  }
  return undefined;
}

function splitIntoChunks(t: string): string[] {
  const byDouble = t
    .split(/\s{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byDouble.length > 1) return byDouble;

  const byKeyStart = t.split(/\s+(?=[A-ZİıĞğÜüŞşÖöÇç0-9(][A-Za-z0-9ıİğüşöçÇĞ%().\-/ &]*?:\s)/);
  if (byKeyStart.length > 1) return byKeyStart.map((s) => s.trim()).filter(Boolean);

  return byDouble;
}

export function parseKeyValueBlock(raw: string): MetricPair[] {
  const t = raw.replace(/\r\n/g, "\n").replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return [];

  const chunks = splitIntoChunks(t);
  const out: MetricPair[] = [];
  for (const chunk of chunks) {
    const i = chunk.indexOf(":");
    if (i <= 0 || i >= chunk.length - 1) continue;
    const label = chunk.slice(0, i).trim();
    const value = chunk.slice(i + 1).trim();
    if (!label || !value) continue;
    out.push({ label, value, hint: hintForMetricLabel(label) });
  }

  if (out.length) return out;
  return [{ label: "Detay", value: t, hint: undefined }];
}

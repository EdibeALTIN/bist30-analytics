import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, FileClock, Radar, TrendingUp } from "lucide-react";
import { getTechnicalAnalysis } from "../api/client";
import {
  TechnicalAnalysisResponse,
  TechnicalIndicatorRow,
  TechnicalSupportResistanceRow,
} from "../data/technical";

interface TechnicalAnalysisPageProps {
  onNavigate: (page: string) => void;
}

function formatNumber(value?: number, digits = 2): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function getStatusClass(status: string): string {
  const normalized = status?.toUpperCase() ?? "";
  if (normalized.includes("ÜST")) {
    return "text-emerald-50";
  }
  if (normalized.includes("ALT")) {
    return "text-rose-50";
  }
  return "text-slate-200";
}

function getStatusCellStyle(status: string): React.CSSProperties {
  const normalized = status?.toUpperCase() ?? "";
  if (normalized.includes("ÜST")) {
    return {
      background: "linear-gradient(90deg, rgba(16,185,129,0.24), rgba(22,163,74,0.18))",
      boxShadow: "inset 0 0 10px rgba(16,185,129,0.10)",
    };
  }
  if (normalized.includes("ALT")) {
    return {
      background: "linear-gradient(90deg, rgba(136,19,55,0.46), rgba(127,29,29,0.32))",
      boxShadow: "inset 0 0 10px rgba(127,29,29,0.18)",
    };
  }
  return {
    background: "linear-gradient(90deg, rgba(100,116,139,0.18), rgba(71,85,105,0.12))",
  };
}

function getRsiZoneLabel(rsi: number): string {
  if (rsi < 30) return "Aşırı Satım";
  if (rsi > 70) return "Aşırı Alım";
  return "Nötr Bölge";
}

function getTrendLabel(row: TechnicalIndicatorRow): { label: string; tone: string } {
  const statuses = [row.status8, row.status20, row.status50, row.status200].map((s) => s.toUpperCase());
  const aboveCount = statuses.filter((s) => s.includes("ÜST")).length;

  if (aboveCount >= 4) return { label: "Güçlü Pozitif Teknik Görünüm", tone: "text-emerald-300" };
  if (aboveCount === 3) return { label: "Pozitif Trend, Kısa Vadede Güçlü", tone: "text-green-300" };
  if (aboveCount === 2) return { label: "Karışık / Geçiş Bölgesi", tone: "text-yellow-300" };
  if (aboveCount === 1) return { label: "Zayıf Görünüm, Tepki Arayışı", tone: "text-orange-300" };
  return { label: "Negatif Teknik Görünüm", tone: "text-rose-300" };
}

function nearestLevelText(lastPrice: number, supports: number[], resistances: number[]): string {
  const validSupports = supports.filter((v) => Number.isFinite(v));
  const validResistances = resistances.filter((v) => Number.isFinite(v));
  const nearestSupport = validSupports.length
    ? validSupports.reduce((a, b) => (Math.abs(b - lastPrice) < Math.abs(a - lastPrice) ? b : a))
    : null;
  const nearestResistance = validResistances.length
    ? validResistances.reduce((a, b) => (Math.abs(b - lastPrice) < Math.abs(a - lastPrice) ? b : a))
    : null;

  const supportText = nearestSupport === null ? "destek verisi sınırlı" : `yakın destek ${formatNumber(nearestSupport)}`;
  const resistanceText =
    nearestResistance === null ? "direnç verisi sınırlı" : `yakın direnç ${formatNumber(nearestResistance)}`;
  return `${supportText}, ${resistanceText}`;
}

function buildIndexCommentary(
  indicators: TechnicalIndicatorRow[],
  srRows: TechnicalSupportResistanceRow[],
): Array<{ symbol: string; title: string; text: string; sub: string }> {
  const srMap = new Map(srRows.map((r) => [r.symbol, r]));
  return indicators.map((row) => {
    const sr = srMap.get(row.symbol);
    const trend = getTrendLabel(row);
    const last = row.lastPrice ?? 0;
    const macdSignal =
      row.macd > row.trigger
        ? "MACD çizgisinin tetik çizgisinin üzerinde kalması momentumun yukarı yönlü sürdüğüne işaret ediyor."
        : "MACD çizgisinin tetik çizgisinin altında seyretmesi kısa vadede ivmenin zayıfladığını gösteriyor.";
    const rsiSignal =
      row.rsi14 > 70
        ? "RSI aşırı alım bölgesinde; güçlü trend devam etse de kâr realizasyonu riski artabilir."
        : row.rsi14 < 30
          ? "RSI aşırı satım bölgesinde; tepki alımı olasılığı izlenebilir."
          : "RSI nötr alanda; fiyatın kırılım teyidi olmadan yön konusunda temkinli kalmak faydalı.";
    const levelText = sr
      ? nearestLevelText(last, [sr.destek1, sr.destek2, sr.destek3], [sr.direnc1, sr.direnc2, sr.direnc3])
      : "destek/direnç verisi bulunmadığı için seviye yorumu sınırlı";
    const pivotText = sr
      ? `Pivot ${formatNumber(sr.pivot)} seviyesi, kısa vadede yön tayini için ana eşik olarak öne çıkıyor.`
      : "Pivot seviyesi bulunmadığından karar bölgesi yorumu yapılamadı.";

    return {
      symbol: row.symbol,
      title: trend.label,
      sub: trend.tone,
      text: `${macdSignal} ${rsiSignal} Bu yapı içinde ${levelText}. ${pivotText}`,
    };
  });
}

function IndicatorTable({
  title,
  subtitle,
  rows,
  isIndex,
}: {
  title: string;
  subtitle: string;
  rows: TechnicalIndicatorRow[];
  isIndex: boolean;
}) {
  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-400/12 via-blue-600/10 to-indigo-700/14 border border-cyan-200/30 shadow-[0_0_20px_rgba(34,211,238,0.14)]">
      <div className="mb-4">
        <h3 className="text-cyan-200 mb-1" style={{ textShadow: "0 0 6px rgba(34,211,238,0.35)" }}>{title}</h3>
        <p className="text-gray-400">{subtitle}</p>
      </div>
      <div className="w-full overflow-x-auto rounded-xl border border-cyan-300/30 shadow-[inset_0_0_18px_rgba(34,211,238,0.10)]">
        <table className="w-full min-w-[1120px] table-fixed text-[12px] leading-5">
          <colgroup>
            <col className="w-[90px]" />
            <col className="w-[90px]" />
            <col className="w-[90px]" />
            <col className="w-[86px]" />
            <col className="w-[90px]" />
            <col className="w-[86px]" />
            <col className="w-[90px]" />
            <col className="w-[86px]" />
            <col className="w-[90px]" />
            <col className="w-[86px]" />
            <col className="w-[85px]" />
            <col className="w-[85px]" />
            <col className="w-[115px]" />
            <col className="w-[100px]" />
          </colgroup>
          <thead className="bg-gradient-to-r from-cyan-500/24 via-blue-500/24 to-indigo-600/24">
            <tr className="text-left text-[11px] uppercase tracking-wide text-cyan-100/90">
              <th className="px-2.5 py-2.5 text-yellow-50 border-b border-yellow-100/60" style={{ background: "linear-gradient(180deg, rgba(253,224,71,0.68), rgba(249,115,22,0.44))" }}>Sembol</th>
              <th className="px-2.5 py-2.5 bg-gradient-to-b from-cyan-400/55 to-sky-500/35 border-b border-cyan-100/65">{isIndex ? "Son Fiyat" : "Kapanış"}</th>
              <th className="px-2.5 py-2.5 bg-gradient-to-b from-cyan-300/65 to-cyan-500/40 border-b border-cyan-100/60">MAV(8)</th>
              <th className="px-2.5 py-2.5 bg-slate-500/16 border-b border-cyan-500/35">Durum</th>
              <th className="px-2.5 py-2.5 bg-gradient-to-b from-blue-300/62 to-blue-500/38 border-b border-blue-100/60">MAV(20)</th>
              <th className="px-2.5 py-2.5 bg-slate-500/16 border-b border-cyan-500/35">Durum</th>
              <th className="px-2.5 py-2.5 bg-gradient-to-b from-indigo-400/62 to-indigo-700/42 border-b border-indigo-100/60">MAV(50)</th>
              <th className="px-2.5 py-2.5 bg-slate-500/16 border-b border-cyan-500/35">Durum</th>
              <th className="px-2.5 py-2.5 bg-gradient-to-b from-violet-400/62 to-purple-800/44 border-b border-violet-100/60">MAV(200)</th>
              <th className="px-2.5 py-2.5 bg-slate-500/16 border-b border-cyan-500/35">Durum</th>
              <th className="px-2.5 py-2.5 bg-gradient-to-b from-fuchsia-400/62 to-indigo-600/36 border-b border-fuchsia-100/60">MACD</th>
              <th className="px-2.5 py-2.5 bg-gradient-to-b from-purple-300/62 to-purple-700/36 border-b border-purple-100/60">Trigger</th>
              <th className="px-2.5 py-2.5 bg-gradient-to-b from-cyan-300/65 to-teal-400/40 border-b border-cyan-50/60">RSI(14)</th>
              <th className="px-2.5 py-2.5 bg-gradient-to-b from-teal-300/68 to-cyan-500/42 border-b border-teal-50/60">SuperTrend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const price = isIndex ? row.lastPrice : row.close;
              return (
                <tr key={row.symbol} className="border-t border-cyan-500/10 hover:bg-cyan-400/6 transition-colors even:bg-white/[0.02]">
                  <td className="px-2.5 py-2 text-yellow-50 font-bold" style={{ background: "linear-gradient(90deg, rgba(253,224,71,0.5), rgba(249,115,22,0.34))", boxShadow: "0 0 8px rgba(251,191,36,0.22)" }}>
                    {row.symbol}
                  </td>
                  <td className="px-2.5 py-2" style={{ background: "linear-gradient(90deg, rgba(34,211,238,0.24), rgba(56,189,248,0.16))" }}>{formatNumber(price)}</td>
                  <td className="px-2.5 py-2" style={{ background: "linear-gradient(90deg, rgba(103,232,249,0.24), rgba(6,182,212,0.18))" }}>{formatNumber(row.mav8)}</td>
                  <td className={`px-2.5 py-2 text-[11px] font-semibold tracking-wide ${getStatusClass(row.status8)}`} style={getStatusCellStyle(row.status8)}>
                    {row.status8 || "-"}
                  </td>
                  <td className="px-2.5 py-2" style={{ background: "linear-gradient(90deg, rgba(147,197,253,0.24), rgba(59,130,246,0.16))" }}>{formatNumber(row.mav20)}</td>
                  <td className={`px-2.5 py-2 text-[11px] font-semibold tracking-wide ${getStatusClass(row.status20)}`} style={getStatusCellStyle(row.status20)}>
                    {row.status20 || "-"}
                  </td>
                  <td className="px-2.5 py-2" style={{ background: "linear-gradient(90deg, rgba(129,140,248,0.25), rgba(67,56,202,0.17))" }}>{formatNumber(row.mav50)}</td>
                  <td className={`px-2.5 py-2 text-[11px] font-semibold tracking-wide ${getStatusClass(row.status50)}`} style={getStatusCellStyle(row.status50)}>
                    {row.status50 || "-"}
                  </td>
                  <td className="px-2.5 py-2" style={{ background: "linear-gradient(90deg, rgba(167,139,250,0.26), rgba(109,40,217,0.17))" }}>{formatNumber(row.mav200)}</td>
                  <td className={`px-2.5 py-2 text-[11px] font-semibold tracking-wide ${getStatusClass(row.status200)}`} style={getStatusCellStyle(row.status200)}>
                    {row.status200 || "-"}
                  </td>
                  <td className="px-2.5 py-2" style={{ background: "linear-gradient(90deg, rgba(217,70,239,0.2), rgba(79,70,229,0.17))" }}>{formatNumber(row.macd, 3)}</td>
                  <td className="px-2.5 py-2" style={{ background: "linear-gradient(90deg, rgba(196,181,253,0.24), rgba(126,34,206,0.17))" }}>{formatNumber(row.trigger, 3)}</td>
                  <td className="px-2.5 py-2" style={{ background: "linear-gradient(90deg, rgba(34,211,238,0.24), rgba(20,184,166,0.17))" }}>
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-50 font-semibold">{formatNumber(row.rsi14, 2)}</span>
                      <span className="text-[10px] text-cyan-100/95 font-medium px-1.5 py-0.5 rounded-full bg-cyan-400/15 border border-cyan-300/25" style={{ boxShadow: "0 0 4px rgba(34,211,238,0.2)" }}>{getRsiZoneLabel(row.rsi14)}</span>
                    </div>
                  </td>
                  <td className="px-2.5 py-2 text-teal-50 font-bold" style={{ background: "linear-gradient(90deg, rgba(94,234,212,0.26), rgba(6,182,212,0.2))", boxShadow: "0 0 6px rgba(45,212,191,0.2)" }}>
                    {formatNumber(row.supertrend)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SupportResistanceTable({
  title,
  subtitle,
  rows,
  isIndex,
}: {
  title: string;
  subtitle: string;
  rows: TechnicalSupportResistanceRow[];
  isIndex: boolean;
}) {
  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-400/12 via-blue-600/10 to-indigo-700/14 border border-cyan-200/30 shadow-[0_0_20px_rgba(34,211,238,0.14)]">
      <div className="mb-4">
        <h3 className="text-cyan-200 mb-1" style={{ textShadow: "0 0 6px rgba(34,211,238,0.35)" }}>{title}</h3>
        <p className="text-gray-400">{subtitle}</p>
      </div>
      <div className="w-full overflow-x-auto rounded-xl border border-cyan-300/30 shadow-[inset_0_0_18px_rgba(34,211,238,0.10)]">
        <table className="w-full min-w-[920px] table-fixed text-[12px] leading-5">
          <colgroup>
            <col className="w-[110px]" />
            <col className="w-[110px]" />
            <col className="w-[95px]" />
            <col className="w-[95px]" />
            <col className="w-[95px]" />
            <col className="w-[95px]" />
            <col className="w-[105px]" />
            <col className="w-[105px]" />
            <col className="w-[105px]" />
          </colgroup>
          <thead className="bg-gradient-to-r from-cyan-500/24 via-blue-500/24 to-indigo-600/24">
            <tr className="text-left text-[11px] uppercase tracking-wide text-cyan-100/90">
              <th className="px-2.5 py-2.5 text-yellow-50 border-b border-yellow-100/60" style={{ background: "linear-gradient(180deg, rgba(253,224,71,0.68), rgba(249,115,22,0.44))" }}>{isIndex ? "Sembol" : "Hisse"}</th>
              <th className="px-2.5 py-2.5 bg-gradient-to-b from-cyan-400/55 to-sky-500/35 border-b border-cyan-100/65">{isIndex ? "Son Fiyat" : "Kapanış"}</th>
              <th className="px-2.5 py-2.5 text-rose-50 bg-gradient-to-b from-rose-300/60 to-rose-500/36 border-b border-rose-100/60">Destek 1</th>
              <th className="px-2.5 py-2.5 text-rose-50 bg-gradient-to-b from-rose-400/68 to-red-500/42 border-b border-rose-100/65">Destek 2</th>
              <th className="px-2.5 py-2.5 text-rose-50 bg-gradient-to-b from-rose-500/74 to-red-600/48 border-b border-rose-100/70">Destek 3</th>
              <th className="px-2.5 py-2.5 text-cyan-50 bg-gradient-to-b from-cyan-400/60 to-violet-500/35 border-b border-cyan-50/60">Pivot</th>
              <th className="px-2.5 py-2.5 text-emerald-50 bg-gradient-to-b from-emerald-300/60 to-emerald-500/36 border-b border-emerald-100/60">Direnç 1</th>
              <th className="px-2.5 py-2.5 text-emerald-50 bg-gradient-to-b from-emerald-400/68 to-green-500/42 border-b border-emerald-100/65">Direnç 2</th>
              <th className="px-2.5 py-2.5 text-emerald-50 bg-gradient-to-b from-emerald-500/74 to-green-600/48 border-b border-emerald-100/70">Direnç 3</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.symbol} className="border-t border-cyan-500/10 hover:bg-cyan-400/6 transition-colors even:bg-white/[0.02]">
                <td className="px-2.5 py-2 text-yellow-50 font-bold" style={{ background: "linear-gradient(90deg, rgba(253,224,71,0.5), rgba(249,115,22,0.34))", boxShadow: "0 0 8px rgba(251,191,36,0.22)" }}>{row.symbol}</td>
                <td className="px-2.5 py-2" style={{ background: "linear-gradient(90deg, rgba(34,211,238,0.24), rgba(56,189,248,0.16))" }}>{formatNumber(isIndex ? row.lastPrice : row.close)}</td>
                <td className="px-2.5 py-2" style={{ background: "linear-gradient(90deg, rgba(253,164,175,0.26), rgba(244,63,94,0.18))" }}>{formatNumber(row.destek1)}</td>
                <td className="px-2.5 py-2" style={{ background: "linear-gradient(90deg, rgba(251,113,133,0.32), rgba(239,68,68,0.22))" }}>{formatNumber(row.destek2)}</td>
                <td className="px-2.5 py-2" style={{ background: "linear-gradient(90deg, rgba(225,29,72,0.36), rgba(190,18,60,0.28))" }}>{formatNumber(row.destek3)}</td>
                <td className="px-2.5 py-2 text-cyan-50 font-semibold" style={{ background: "linear-gradient(90deg, rgba(56,189,248,0.28), rgba(139,92,246,0.2))", boxShadow: "0 0 4px rgba(56,189,248,0.2)" }}>{formatNumber(row.pivot)}</td>
                <td className="px-2.5 py-2" style={{ background: "linear-gradient(90deg, rgba(110,231,183,0.26), rgba(34,197,94,0.18))" }}>{formatNumber(row.direnc1)}</td>
                <td className="px-2.5 py-2" style={{ background: "linear-gradient(90deg, rgba(52,211,153,0.32), rgba(34,197,94,0.22))" }}>{formatNumber(row.direnc2)}</td>
                <td className="px-2.5 py-2" style={{ background: "linear-gradient(90deg, rgba(22,163,74,0.36), rgba(21,128,61,0.28))" }}>{formatNumber(row.direnc3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TechnicalAnalysisPage({ onNavigate: _onNavigate }: TechnicalAnalysisPageProps) {
  const [data, setData] = useState<TechnicalAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (reportDate?: string) => {
    setLoading(true);
    setError("");
    try {
      const result = await getTechnicalAnalysis(reportDate);
      setData(result);
    } catch {
      setError("Teknik analiz verileri yüklenemedi. Lütfen backend servisini kontrol edin.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const indexCommentaries = useMemo(() => {
    if (!data) return [];
    return buildIndexCommentary(data.indexIndicators, data.indexSupportResistance);
  }, [data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#0f1538] to-[#1a1f4e] pt-24 pb-12">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(6, 182, 212, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.03) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />

      <div className="relative z-10 w-full max-w-[48rem] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div
          className="p-5 rounded-2xl border border-cyan-400/20"
          style={{
            background:
              "linear-gradient(135deg, rgba(12,28,76,0.72), rgba(9,16,55,0.78))",
            boxShadow: "0 0 16px rgba(34,211,238,0.10), inset 0 0 12px rgba(56,189,248,0.06)",
          }}
        >
          <h1
            className="text-cyan-100 font-black tracking-tight"
            style={{
              fontSize: "clamp(2.1rem, 5.2vw, 3.6rem)",
              lineHeight: 1.05,
              textShadow: "0 0 8px rgba(125,211,252,0.35)",
            }}
          >
            Teknik Analiz
          </h1>
          <p className="mt-3 text-cyan-200/80 max-w-3xl">
            BIST-30 ve endeksler için hareketli ortalama, momentum ve destek/direnç verilerinin renk kodlu teknik görünümü.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/30">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 flex items-center gap-2">
              <FileClock className="w-4 h-4" />
              {data?.selectedDate ? `Seçili Rapor: ${data.selectedDate}` : "Seçili Rapor: -"}
            </div>
            <div className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-200">
              BIST-30 Kapsamı: {data?.summary.bist30Count ?? 0}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <CalendarDays className="w-5 h-5 text-cyan-300" />
            <label className="text-gray-300">Rapor Tarihi</label>
            <select
              value={data?.selectedDate ?? ""}
              onChange={(e) => void load(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#0f1538] border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
              disabled={loading}
            >
              {(data?.availableDates ?? []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && <div className="text-gray-300">Teknik analiz verileri yükleniyor...</div>}
        {error && <div className="text-rose-300">{error}</div>}

        {!loading && !error && data && (
          <>
            <IndicatorTable
              title="Endeks Teknik Gösterge Tablosu"
              subtitle="Seçili tarihteki ana endeksler için hareketli ortalama, MACD ve RSI görünümü"
              rows={data.indexIndicators}
              isIndex
            />

            <SupportResistanceTable
              title="Endeks Destek / Direnç Tablosu"
              subtitle="Endeks bazında destek, pivot ve direnç seviyeleri"
              rows={data.indexSupportResistance}
              isIndex
            />

            <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/8 to-cyan-600/8 border border-emerald-500/25 shadow-xl shadow-emerald-900/20">
              <h3 className="text-emerald-300 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Endeks Görünüm Özeti
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {indexCommentaries.map((comment) => (
                  <div key={comment.symbol} className="p-4 rounded-xl bg-[#0f1538]/70 border border-cyan-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-amber-300">{comment.symbol}</div>
                      <div className={`text-sm ${comment.sub}`}>{comment.title}</div>
                    </div>
                    <p className="text-gray-300 leading-relaxed">{comment.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <IndicatorTable
              title="BIST-30 Teknik Gösterge Tablosu"
              subtitle="BIST-30 hisseleri için kapanış, ortalamalar, MACD ve RSI verileri"
              rows={data.bist30Indicators}
              isIndex={false}
            />

            <SupportResistanceTable
              title="BIST-30 Destek / Direnç Tablosu"
              subtitle="BIST-30 hisselerinin teknik seviye haritası"
              rows={data.bist30SupportResistance}
              isIndex={false}
            />

            <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/8 to-blue-700/8 border border-cyan-500/25">
              <h3 className="text-cyan-300 mb-4 flex items-center gap-2">
                <Radar className="w-5 h-5" />
                Göstergelerin Yorumlanması
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#0f1538]/70 border border-cyan-500/20">
                  <h4 className="text-cyan-200 mb-2">MACD ve Trigger</h4>
                  <p className="text-gray-300 leading-relaxed">
                    MACD, kısa ve orta dönem hareketli ortalamalar arasındaki farktan türetilen bir ivme göstergesidir.
                    Trigger çizgisi MACD’nin sinyal referansıdır. MACD’nin Trigger’ın üzerine çıkması alım ivmesinin güçlendiğini,
                    altına inmesi ise satış baskısının arttığını anlatır. Ancak tek başına kesin karar verdirmez; destek/direnç ve
                    trend yapısıyla birlikte okunmalıdır.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#0f1538]/70 border border-cyan-500/20">
                  <h4 className="text-cyan-200 mb-2">RSI (14) Okuması</h4>
                  <p className="text-gray-300 leading-relaxed">
                    RSI 0-100 arasında hareket eder. 30 altı bölge genel olarak aşırı satım, 70 üzeri bölge aşırı alım sinyali
                    olarak değerlendirilir. 30-70 bandı nötrdür ve çoğu zaman trend teyidi için başka göstergelere ihtiyaç vardır.
                    RSI bir olasılık göstergesidir; tek başına kesin dönüş garantisi vermez.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#0f1538]/70 border border-cyan-500/20">
                  <h4 className="text-cyan-200 mb-2">Destek Bölgeleri</h4>
                  <p className="text-gray-300 leading-relaxed">
                    Destek, fiyatın aşağı yönlü hareketinde alıcıların devreye girmeye eğilimli olduğu alandır. Fiyat desteğe
                    yaklaştığında tepki alımı görülebilir. Desteğin hacimli şekilde kırılması ise zayıflığın derinleştiğini ve bir
                    alt destek bölgesinin test edilebileceğini düşündürür.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#0f1538]/70 border border-cyan-500/20">
                  <h4 className="text-cyan-200 mb-2">Direnç Bölgeleri</h4>
                  <p className="text-gray-300 leading-relaxed">
                    Direnç, fiyatın yükselişinde satış baskısının arttığı alanı ifade eder. Direnç yakınında kâr realizasyonları
                    görülebilir. Direncin güçlü biçimde aşılması, yükselişin yeni bir banda taşınabileceğine dair pozitif bir teknik
                    teyit niteliği taşır.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#0f1538]/70 border border-cyan-500/20">
                  <h4 className="text-cyan-200 mb-2">Pivot Seviyesi</h4>
                  <p className="text-gray-300 leading-relaxed">
                    Pivot, gün içi ve kısa vadeli yön kararında merkezi denge noktasıdır. Fiyatın pivot üzerinde kalması
                    alıcıların, pivot altında kalması satıcıların daha baskın olabileceğine işaret eder. Pivot; destek ve dirençle
                    birlikte, senaryo bazlı işlem planı oluştururken kritik referanstır.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#0f1538]/70 border border-cyan-500/20">
                  <h4 className="text-cyan-200 mb-2">Ortalama Hizalanması ve Sinyal Bütünlüğü</h4>
                  <p className="text-gray-300 leading-relaxed">
                    Fiyatın 8/20/50/200 ortalamalarının çoğunun üzerinde olması teknik yapının güçlü kaldığını, kısa vadede bazı
                    ortalamaların altında kalırken uzun vadeli ortalamaların üzerinde kalınması ise düzeltme içindeki ana trend
                    devamını gösterebilir. En sağlıklı yaklaşım, MACD, RSI ve seviye kırılımlarını birlikte okuyarak çoklu teyit
                    aramaktır.
                  </p>
                </div>
              </div>

              <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-100">
                Teknik göstergeler karar destek araçlarıdır; tek başına kesin sonuç üretmez. Nihai yatırım kararlarında risk
                yönetimi, haber akışı ve şirketin temel görünümü mutlaka birlikte değerlendirilmelidir.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

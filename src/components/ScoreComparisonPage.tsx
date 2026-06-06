import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, FileClock, GitCompare, Info, Radar } from "lucide-react";
import { getScoreComparison, getScoreComparisonDates } from "../api/client";
import { ScoreComparisonResponse } from "../data/scoreComparison";
import "./ScoreComparisonPage.css";

interface ScoreComparisonPageProps {
  onNavigate: (page: string) => void;
}

function fmt(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "Bu raporda veri yok";
  return value.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtPct(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "Bu raporda veri yok";
  return `%${value.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function mutedOrValue(text: string): React.ReactNode {
  if (text === "Bu raporda veri yok") {
    return <span className="text-gray-500 italic text-[11px]">{text}</span>;
  }
  return text;
}

function zebraRowClass(index: number): string {
  return index % 2 === 0 ? "sc-table-zebra-0" : "sc-table-zebra-1";
}

function diffLabel(diff: number | null): string {
  if (diff === null) return "Kıyas yok";
  if (Math.abs(diff) <= 7) return "Uyumlu";
  if (diff > 0) return "İç Puan Üstte";
  return "Dış Skor Üstte";
}

function tipTone(diff: number | null): string {
  if (diff === null) return "text-slate-300";
  if (Math.abs(diff) <= 7) return "text-cyan-200";
  if (diff > 0) return "text-emerald-100";
  return "text-amber-100";
}

/** Rozet: neon cyan / teal / amber geçişleri */
function badgeStyle(diff: number | null): React.CSSProperties {
  if (diff === null) {
    return {
      background: "linear-gradient(140deg, rgba(100, 116, 139, 0.35) 0%, rgba(40, 45, 70, 0.55) 40%, rgba(15, 18, 35, 0.95) 100%)",
      border: "1px solid rgba(148, 163, 184, 0.42)",
      color: "#f1f5f9",
      boxShadow: "0 6px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07)",
    };
  }
  if (Math.abs(diff) <= 7) {
    return {
      background: "linear-gradient(140deg, rgba(94, 234, 212, 0.35) 0%, rgba(6, 182, 212, 0.22) 38%, rgba(15, 23, 42, 0.92) 100%)",
      border: "1px solid rgba(56, 232, 255, 0.55)",
      color: "#ecfeff",
      boxShadow: "0 0 22px rgba(34, 211, 238, 0.35), inset 0 1px 0 rgba(255,255,255,0.1)",
    };
  }
  if (diff > 0) {
    return {
      background: "linear-gradient(140deg, rgba(52, 211, 153, 0.4) 0%, rgba(16, 185, 129, 0.25) 35%, rgba(6, 78, 95, 0.35) 65%, rgba(15, 23, 42, 0.95) 100%)",
      border: "1px solid rgba(110, 231, 183, 0.55)",
      color: "#ecfdf5",
      boxShadow: "0 0 24px rgba(45, 212, 191, 0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
    };
  }
  return {
    background: "linear-gradient(140deg, rgba(251, 191, 36, 0.35) 0%, rgba(245, 158, 11, 0.22) 40%, rgba(180, 83, 9, 0.2) 70%, rgba(15, 23, 42, 0.95) 100%)",
    border: "1px solid rgba(252, 211, 77, 0.5)",
    color: "#fffbeb",
    boxShadow: "0 0 22px rgba(251, 191, 36, 0.22), inset 0 1px 0 rgba(255,255,255,0.07)",
  };
}

/** Yorum satırı: aynı durumda rozetle aynı renk ailesi */
function commentStyle(diff: number | null): React.CSSProperties {
  if (diff === null) {
    return {
      background: "linear-gradient(135deg, rgba(71, 85, 105, 0.18) 0%, rgba(30, 27, 55, 0.45) 50%, rgba(15, 18, 32, 0.88) 100%)",
      border: "1px solid rgba(148, 163, 184, 0.32)",
      boxShadow: "0 10px 32px rgba(0,0,0,0.38)",
    };
  }
  if (Math.abs(diff) <= 7) {
    return {
      background: "linear-gradient(135deg, rgba(34, 211, 238, 0.18) 0%, rgba(59, 130, 246, 0.12) 45%, rgba(15, 23, 42, 0.88) 100%)",
      border: "1px solid rgba(56, 232, 255, 0.38)",
      boxShadow: "0 10px 32px rgba(34, 211, 238, 0.15)",
    };
  }
  if (diff > 0) {
    return {
      background: "linear-gradient(135deg, rgba(45, 212, 191, 0.2) 0%, rgba(16, 185, 129, 0.12) 42%, rgba(15, 23, 42, 0.9) 100%)",
      border: "1px solid rgba(110, 231, 183, 0.42)",
      boxShadow: "0 10px 32px rgba(45, 212, 191, 0.16)",
    };
  }
  return {
    background: "linear-gradient(135deg, rgba(251, 191, 36, 0.16) 0%, rgba(244, 114, 182, 0.08) 50%, rgba(15, 23, 42, 0.9) 100%)",
    border: "1px solid rgba(252, 211, 77, 0.35)",
    boxShadow: "0 10px 32px rgba(251, 191, 36, 0.12)",
  };
}

/** Tüm yüzen ipuçları: opak koyu zemin — alttaki tablo/kart yazısı süzülmesin */
const tooltipPanelStyle: React.CSSProperties = {
  backgroundColor: "#03040a",
  background: "linear-gradient(160deg, #050811 0%, #03040a 50%, #0a0a12 100%)",
  border: "1px solid rgba(94, 234, 212, 0.45)",
  boxShadow: "0 0 24px rgba(34, 211, 238, 0.12), 0 12px 40px rgba(0, 0, 0, 0.85)",
};

/** Ana iki kutu: cyan (iç yatırım) + mor (dış quant) */
const internalScoreHeroStyle: React.CSSProperties = {
  background: "linear-gradient(145deg, rgba(94, 234, 212, 0.22) 0%, rgba(34, 211, 238, 0.14) 28%, rgba(37, 99, 235, 0.12) 58%, rgba(15, 23, 42, 0.94) 100%)",
  border: "1px solid rgba(56, 232, 255, 0.48)",
  boxShadow: "0 0 28px rgba(34, 211, 238, 0.22), inset 0 1px 0 rgba(255,255,255,0.08)",
};

const quantHeroStyle: React.CSSProperties = {
  background: "linear-gradient(145deg, rgba(196, 181, 253, 0.28) 0%, rgba(139, 92, 246, 0.22) 32%, rgba(168, 85, 247, 0.12) 55%, rgba(15, 23, 42, 0.94) 100%)",
  border: "1px solid rgba(192, 132, 252, 0.52)",
  boxShadow: "0 0 28px rgba(167, 139, 250, 0.28), inset 0 1px 0 rgba(255,255,255,0.07)",
};

const piotroskiBoxStyle: React.CSSProperties = {
  background: "linear-gradient(145deg, rgba(56, 189, 248, 0.25) 0%, rgba(59, 130, 246, 0.14) 45%, rgba(15, 23, 42, 0.94) 100%)",
  border: "1px solid rgba(125, 211, 252, 0.45)",
  boxShadow: "0 0 20px rgba(14, 165, 233, 0.2), inset 0 1px 0 rgba(255,255,255,0.05)",
};

const diptenBoxStyle: React.CSSProperties = {
  background: "linear-gradient(145deg, rgba(45, 212, 191, 0.2) 0%, rgba(6, 182, 212, 0.16) 40%, rgba(15, 23, 42, 0.94) 100%)",
  border: "1px solid rgba(94, 234, 212, 0.42)",
  boxShadow: "0 0 20px rgba(34, 211, 238, 0.16), inset 0 1px 0 rgba(255,255,255,0.05)",
};

const magicFormulaBoxStyle: React.CSSProperties = {
  background: "linear-gradient(145deg, rgba(167, 139, 250, 0.3) 0%, rgba(236, 72, 153, 0.14) 48%, rgba(15, 23, 42, 0.95) 100%)",
  border: "1px solid rgba(216, 180, 254, 0.5)",
  boxShadow: "0 0 22px rgba(192, 132, 252, 0.25), inset 0 1px 0 rgba(255,255,255,0.06)",
};

/** Zirveden: fuşya–mor geçiş */
const zirvedenBoxStyle: React.CSSProperties = {
  background: "linear-gradient(145deg, rgba(244, 114, 182, 0.2) 0%, rgba(192, 132, 252, 0.22) 40%, rgba(88, 28, 135, 0.25) 72%, rgba(15, 23, 42, 0.95) 100%)",
  border: "1px solid rgba(244, 114, 182, 0.42)",
  boxShadow: "0 0 22px rgba(236, 72, 153, 0.18), inset 0 1px 0 rgba(255,255,255,0.05)",
};

function InfoLine({ title, text, tip: _unused }: { title: string; text: string; tip: string }) {
  return (
    <div className="text-sm leading-relaxed text-gray-200">
      <p>
        <span className="font-semibold text-cyan-100">{title}</span>
        {": "}
        {text}
      </p>
    </div>
  );
}

/** Karşılaştırma kartındaki küçük metrik kutuları — başlık üzerine gelince grafik stili ipucu */
function MetricWithTip({
  label,
  value,
  tip,
  style,
  valueClassName = "text-white/95",
}: {
  label: string;
  value: React.ReactNode;
  tip: string;
  style?: React.CSSProperties;
  valueClassName?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="p-2 rounded-md relative z-0 overflow-visible" style={style}>
      <div className="relative z-10 inline-block w-full">
        <div
          className="text-gray-300/90 text-[11px] font-medium cursor-help border-b border-dotted border-white/30 w-fit pr-0.5"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {label}
        </div>
        {hovered && (
          <div
            role="tooltip"
            className="absolute left-0 bottom-full z-[9999] mb-2 w-max max-w-[16rem] rounded-lg px-2.5 py-2 pointer-events-none"
            style={tooltipPanelStyle}
          >
            <div className="text-white text-[11px] font-semibold">{label}</div>
            <div className="text-cyan-200/95 text-[10px] leading-relaxed mt-1">
              <span className="text-cyan-500/90">Kısa okuma: </span>
              {tip}
            </div>
          </div>
        )}
      </div>
      <div className={`text-sm font-semibold mt-0.5 ${valueClassName}`}>{value}</div>
    </div>
  );
}

function comparisonInsightHint(diff: number | null): string {
  if (diff === null) {
    return "Bazı metrikler yoksa özet kısır; önce üstteki büyük puanlara bakın.";
  }
  if (Math.abs(diff) <= 7) {
    return "Skorlar yakın; tam fark yukarıdaki Yatırım/Quant büyük kutularındadır, bu satır yönü özetler.";
  }
  if (diff > 0) {
    return "Otomatik metin: iç puan quant’tan yüksek; ayrıntı rakamlarda, kutu sözlü özet (üstteki rozetle aynı yeşil aile = lehte).";
  }
  return "Dış quant önde; sarı-amber vurgu dikkat ister—farkı Piotroski ve dip/zirve küçük kutuları açıklar.";
}

/** Yorum satırı: üzerine gelince satır metninden farklı kısa okuma; rozetle aynı renk ailesi (duruma göre) */
function ComparisonInsightBox({ insight, diff }: { insight: string; diff: number | null }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const onEnter = () => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      const w = 300;
      const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
      setPos({ left, top: r.top });
    }
    setOpen(true);
  };

  return (
    <>
      <div
        ref={ref}
        className={`mt-3 text-sm leading-relaxed rounded-md px-2 py-1.5 cursor-help ${tipTone(diff)}`}
        style={commentStyle(diff)}
        onMouseEnter={onEnter}
        onMouseLeave={() => setOpen(false)}
      >
        {insight}
      </div>
      {open &&
        createPortal(
          <div
            className="rounded-lg px-2.5 py-2 w-max max-w-[18rem] pointer-events-none"
            style={{
              ...tooltipPanelStyle,
              position: "fixed",
              zIndex: 10000,
              left: pos.left,
              top: pos.top,
              transform: "translateY(calc(-100% - 8px))",
            }}
          >
            <div className="text-white text-[11px] font-semibold">Karşılaştırma özeti</div>
            <div className="text-cyan-200/95 text-[10px] leading-relaxed mt-1">
              <span className="text-cyan-500/90">Kısa okuma: </span>
              {comparisonInsightHint(diff)}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

type ThAccent = "default" | "violet" | "fuchsia" | "cyan";

function thUnderlineClass(accent: ThAccent): string {
  switch (accent) {
    case "violet":
      return "border-b border-dotted border-indigo-300/75";
    case "fuchsia":
      return "border-b border-dotted border-fuchsia-300/70";
    case "cyan":
      return "border-b border-dotted border-cyan-300/65";
    default:
      return "border-b border-dotted border-cyan-200/45";
  }
}

/**
 * Tablo başlıkları: yatay scroll alanı kırpmasın diye ipucu body'ye portal ile, fixed konum.
 */
function ThWithTip({
  label,
  tip,
  className = "",
  accent = "default",
}: {
  label: string;
  tip: string;
  className?: string;
  accent?: ThAccent;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  const onEnter = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const w = 272;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    setPos({ left, top: r.top });
    setOpen(true);
  };

  const tooltip =
    open &&
    createPortal(
      <div
        role="tooltip"
        className="rounded-lg px-2.5 py-2 w-max max-w-[17rem] pointer-events-none"
        style={{
          ...tooltipPanelStyle,
          position: "fixed",
          zIndex: 10000,
          left: pos.left,
          top: pos.top,
          transform: "translateY(calc(-100% - 8px))",
        }}
      >
        <div className="text-white text-[11px] font-semibold uppercase tracking-wide">{label}</div>
        <div className="text-cyan-200 text-[10px] leading-relaxed mt-1">
          <span className="text-cyan-400/90">Kısa okuma: </span>
          {tip}
        </div>
      </div>,
      document.body
    );

  return (
    <>
      <th className={`px-3 py-2 text-left ${className}`.trim()}>
        <span
          className={`inline-block cursor-help max-w-[10rem] leading-tight ${thUnderlineClass(accent)}`}
          onMouseEnter={(e) => onEnter(e.currentTarget)}
          onMouseLeave={() => setOpen(false)}
        >
          {label}
        </span>
      </th>
      {tooltip}
    </>
  );
}

export function ScoreComparisonPage({ onNavigate: _onNavigate }: ScoreComparisonPageProps) {
  const [data, setData] = useState<ScoreComparisonResponse | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /** Zaman filtresi yalnızca haftalık rapor tarihi (navbar finans dönemi burada kullanılmaz). */
  const load = async (reportDate?: string) => {
    setLoading(true);
    setError("");
    try {
      const [datesResp, result] = await Promise.all([
        getScoreComparisonDates(),
        getScoreComparison(reportDate),
      ]);
      setAvailableDates(datesResp.availableDates ?? []);
      setSelectedDate(result.selectedReportDate ?? datesResp.latestDate ?? "");
      setData(result);
    } catch {
      setError("Skor karşılaştırma verileri yüklenemedi. Lütfen backend servisini kontrol edin.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(undefined);
  }, []);

  const topComparisons = useMemo(() => data?.comparisons.slice(0, 18) ?? [], [data]);

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

      <div className="relative z-10 max-w-[88rem] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/14 via-indigo-500/10 to-fuchsia-500/12 border border-cyan-400/25 shadow-[0_0_40px_-12px_rgba(34,211,238,0.2)]">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-sky-300 to-fuchsia-200 drop-shadow-[0_0_28px_rgba(34,211,238,0.35)]">
            Skor Karşılaştırma Merkezi
          </h1>
          <p className="text-gray-300 mt-2">
            İç algoritma puanı ile haftalık dış skor setlerini ve dip/zirve metriklerini birlikte karşılaştırın.
            <span className="block text-gray-500 text-sm mt-2">
              Zaman filtresi: yalnızca aşağıdaki <strong className="text-gray-400">haftalık rapor tarihi</strong>. Üst menüdeki
              finansal dönem seçimi bu sayfayı etkilemez (QPS/dip tabloları haftalık tablolardır).
            </span>
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 flex items-center gap-2">
              <FileClock className="w-4 h-4" />
              {data?.selectedReportDate ? `Seçili Rapor: ${data.selectedReportDate}` : "Seçili Rapor: -"}
            </div>
            <div className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-200 flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              {data ? `QPS: ${data.sources.qpsTable ?? "Yok"} | Dip/Zirve: ${data.sources.dipTable ?? "Yok"}` : "Tablo bilgisi yükleniyor"}
            </div>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <label className="text-gray-300 text-sm whitespace-nowrap" htmlFor="score-comparison-report-date">
                Haftalık rapor tarihi
              </label>
              <select
                id="score-comparison-report-date"
                value={
                  selectedDate && availableDates.includes(selectedDate)
                    ? selectedDate
                    : availableDates[0] ?? ""
                }
                onChange={(e) => void load(e.target.value)}
                className="max-w-[12rem] sm:max-w-none px-3 py-2 rounded-lg bg-[#0f1538] border border-cyan-500/30 text-white focus:outline-none focus:border-cyan-400"
                disabled={loading || availableDates.length === 0}
              >
                {availableDates.length === 0 ? (
                  <option value="">Veritabanında haftalık tablo yok</option>
                ) : (
                  availableDates.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>

        {loading && <div className="text-gray-300">Skor karşılaştırma verileri yükleniyor...</div>}
        {error && <div className="text-cyan-200/95">{error}</div>}

        {!loading && !error && data && !data.summary.hasData && (
          <div className="p-5 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-100">
            Bu rapor döneminde görüntülenecek karşılaştırma verisi bulunamadı.
          </div>
        )}

        {!loading && !error && data && data.summary.hasData && (
          <>
            <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-blue-500/8 to-violet-500/10 border border-cyan-400/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 to-sky-300 mb-1">Temel Skor Tablosu (BIST-30)</h3>
                <p className="text-gray-400 mb-4">qps_bist30 tablosundan haftalık dış skor seti</p>
                <div className="overflow-x-auto rounded-xl border border-cyan-400/20 bg-[#05070d]/40">
                  <table className="w-full min-w-[980px] text-[12px]">
                    <thead className="bg-gradient-to-r from-cyan-500/25 via-blue-600/20 to-violet-500/22 text-cyan-50 uppercase text-[11px] shadow-[inset_0_-1px_0_rgba(34,211,238,0.15)]">
                      <tr>
                        <ThWithTip label="Kod" tip="Satır anahtarı: dip/zirve ve karşılaştırma kartlarıyla aynı kodu eşleştirir." />
                        <ThWithTip
                          label="Değer"
                          tip="Bu sütun sadece haftalık QPS değer skoru; yorum metni rehberde, burada ham sayı."
                        />
                        <ThWithTip
                          label="Karlılık"
                          tip="Dış modelin karlılık alt skoru; sektörel rekabette üst/alt çeyrek fikri verir."
                        />
                        <ThWithTip
                          label="Büyüme"
                          tip="Büyüme oranlarından türetilmiş toplu skor; fiyat büyümesi (momentum) değil."
                        />
                        <ThWithTip
                          label="Momentum"
                          tip="Piyasa eğilimi ağırlıklı; temel büyüme skorundan farklı bir eksen."
                        />
                        <ThWithTip
                          label="Quant"
                          tip="Dört alt skorun tek endekste birleşimi; zayıf kolon varsa toplamı sorgulayın."
                          accent="cyan"
                        />
                        <ThWithTip
                          label="Piotroski F"
                          tip="Tam sayı 0-9: mutlak eşik yerine aynı sektördeki sıra daha anlamlı."
                        />
                        <ThWithTip
                          label="Magic Formula"
                          tip="Bileşik dış formül skoru; yüksek büyüme hisselerinde tabanı düşük gösterebilir."
                          accent="violet"
                        />
                      </tr>
                    </thead>
                    <tbody>
                      {data.qpsRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-8 text-center text-gray-500 italic">
                            Bu haftalık rapor için QPS satırı yok — veritabanında uygun haftalık tablo eksik olabilir veya hisse kodları
                            eşleşmiyor. Yalnızca üstteki haftalık rapor tarihinden seçim yapın.
                          </td>
                        </tr>
                      ) : (
                        data.qpsRows.map((row, rowIndex) => (
                          <tr
                            key={row.code}
                            className={`border-t border-cyan-400/10 transition-colors duration-150 ${zebraRowClass(rowIndex)}`}
                          >
                            <td className="px-3 py-2 text-cyan-100 font-semibold sc-table-code-cell">{row.code}</td>
                            <td className="px-3 py-2">{mutedOrValue(fmt(row.valueScore, 1))}</td>
                            <td className="px-3 py-2">{mutedOrValue(fmt(row.profitabilityScore, 1))}</td>
                            <td className="px-3 py-2">{mutedOrValue(fmt(row.growthScore, 1))}</td>
                            <td className="px-3 py-2">{mutedOrValue(fmt(row.momentumScore, 1))}</td>
                            <td className="px-3 py-2 text-cyan-200">{mutedOrValue(fmt(row.quantScore, 1))}</td>
                            <td className="px-3 py-2">{mutedOrValue(fmt(row.piotroskiFScore, 1))}</td>
                            <td className="px-3 py-2">{mutedOrValue(fmt(row.magicFormula, 1))}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-500/10 via-indigo-500/8 to-cyan-500/8 border border-violet-400/25 overflow-visible shadow-[0_0_32px_-14px_rgba(167,139,250,0.25)]">
                <h4 className="text-transparent bg-clip-text bg-gradient-to-r from-violet-200 to-fuchsia-200 mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Skor Rehberi
                </h4>
                <div className="space-y-2 text-gray-300">
                  <InfoLine
                    title="Değer Skoru"
                    text="Hisse senedinin mevcut fiyatının, şirketin temel değerlerine kıyasla cazip olup olmadığını gösterir. F/K, F/DD ve F/Satış gibi değerleri inceler. 0-100 arasındadır."
                    tip="Sektör medyanı ve geçmiş çeyreklerle kıyaslamadan tek başına ‘ucuz’ demek risklidir."
                  />
                  <InfoLine
                    title="Karlılık Skoru"
                    text="Özsermaye Karlılığı, Aktif Karlılık, ROIC ve marjlar gibi karlılığı ölçen değerlere bakar. Şirketin ne kadar karlı olduğunu ve kaynaklarını ne kadar verimli kullandığını gösterir. 0-100 arasındadır."
                    tip="Marj sürprizi dönemlerinde skor gecikebilir; haber akışıyla çelişiyorsa dip notlarına bakın."
                  />
                  <InfoLine
                    title="Büyüme Skoru"
                    text="Şirketin gelirlerinin, karının ve finansal göstergelerinin ne kadar hızlı büyüdüğünü gösterir. 0-100 arasındadır."
                    tip="Tek başına fiyat yönü vermez; momentum skoru ve haber akışıyla çapraz kontrol edin."
                  />
                  <InfoLine
                    title="Momentum Skoru"
                    text="Hisse senedinin fiyat hareketlerinin yönünü ve hızını ölçer. Fiyat, hacim ve RSI gibi teknik eğilim göstergelerini yansıtır. 0-100 arasındadır."
                    tip="Kısa vade ‘trend’ göstergesi; uzun vade tezinde temel skorlara geri dönün."
                  />
                  <InfoLine
                    title="Quant Skoru"
                    text="Yukarıdaki 4 puanlama yönteminin sonuçlarının ağırlıklı ortalamasıdır."
                    tip="Altındaki dört skordan biri çok zayıfsa toplam puan yanıltıcı olabilir."
                  />
                  <InfoLine
                    title="Piotroski F"
                    text="Joseph Piotroski tarafından geliştirilen finansal kalite göstergesidir. Şirketlerin finansal sağlamlığını 0 (zayıf) - 9 (güçlü) arasında puanlar."
                    tip="Tek seferlik muhasebe düzeltmesi puanı şişirebilir; yıllık rapor dipnotlarına bakın."
                  />
                  <InfoLine
                    title="Magic Formula"
                    text="Joel Greenblatt yaklaşımıyla kazanç verimi ve sermaye getirisi birlikte değerlendirilir. 0-100 arasında bileşik bir değer alınır."
                    tip="Yüksek büyüme / yüksek çarpan hisselerinde taban puanı sığ kalabilir; sektör filtresi kullanın."
                  />
                  <p className="text-gray-400 text-xs pt-1">
                    Soldaki temel skor tablosunda sütun başlıklarının üzerine gelince kısa ipucu açılır.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 p-5 rounded-2xl bg-gradient-to-br from-teal-500/8 via-cyan-500/9 to-blue-500/10 border border-teal-400/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-teal-200 via-cyan-200 to-blue-300 mb-1">Dip / Zirve Uzaklık Tablosu (BIST-30)</h3>
                <p className="text-gray-400 mb-4">dip_zirve_bist30 tablosundan haftalık fiyat mesafe metrikleri</p>
                <div className="overflow-x-auto rounded-xl border border-cyan-400/20 bg-[#05070d]/40">
                  <table className="w-full min-w-[1200px] text-[12px]">
                    <thead className="bg-gradient-to-r from-teal-500/22 via-cyan-500/20 to-indigo-500/22 text-cyan-50 uppercase text-[11px] shadow-[inset_0_-1px_0_rgba(45,212,191,0.12)]">
                      <tr>
                        <ThWithTip label="Kod" tip="Aynı kod karşılaştırma bölümündeki iç/dış puan satırına bağlanır." />
                        <ThWithTip
                          label="Dip"
                          tip="Dönem kapanışınca kütükteki minimum işlem; anlık en düşük tick olmayabilir."
                          accent="violet"
                        />
                        <ThWithTip label="Zirve" tip="Dönem maksimumu; bölünme günlerinde önceki satırlarla tutarlı mı kontrol edin." />
                        <ThWithTip label="Ağ. Orta" tip="Hacim ağırlıklı; düşük likidite günlerinde çarpıklaşma olabilir." />
                        <ThWithTip label="Önceki Kapanış" tip="Bir periyot önceki resmi kapanış; oran formüllerinde payda." />
                        <ThWithTip label="Kapanış" tip="Rapor penceresinin son işlem günü kapanışı; spot değil." />
                        <ThWithTip label="% Getiri" tip="Bir periyotluk dönüş; endeks getirisiyle fark, göreli performans fikrini verir." />
                        <ThWithTip
                          label="Dipten Uzaklık %"
                          tip="Dip–kapanış farkı yüzde olarak; 0’a yakınsa dip bölgedesiniz (tablo türevi)."
                          accent="cyan"
                        />
                        <ThWithTip
                          label="Zirveden Uzaklık %"
                          tip="Zirve–kapanış mesafesi; 0’a yakınsa tavanda sıkışık okunur (tablo türevi)."
                          accent="fuchsia"
                        />
                        <ThWithTip
                          label="Dibe Göre Getiri %"
                          tip="Hipotetik getiri: ‘dibe kilitli kalsaydım’ senaryo payı; yatırım tavsiyesi değil."
                        />
                        <ThWithTip
                          label="Zirveye Göre Getiri %"
                          tip="Hipotetik tavan payı: ‘zirveye tutunsaydım’ senaryosu; tavsiye değil, ölçektir."
                          accent="fuchsia"
                        />
                      </tr>
                    </thead>
                    <tbody>
                      {data.dipRows.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="px-3 py-8 text-center text-gray-500 italic">
                            Bu haftalık rapor için dip/zirve satırı yok — dip_zirve_bist30_* tablosu eksik veya kod eşleşmesi yok.
                          </td>
                        </tr>
                      ) : (
                        data.dipRows.map((row, rowIndex) => (
                          <tr
                            key={row.code}
                            className={`border-t border-teal-500/12 transition-colors duration-150 ${zebraRowClass(rowIndex)}`}
                          >
                            <td className="px-3 py-2 text-cyan-100 font-semibold sc-table-code-cell">{row.code}</td>
                            <td className="px-3 py-2">{mutedOrValue(fmt(row.dip, 2))}</td>
                            <td className="px-3 py-2">{mutedOrValue(fmt(row.zirve, 2))}</td>
                            <td className="px-3 py-2">{mutedOrValue(fmt(row.agOrta, 2))}</td>
                            <td className="px-3 py-2">{mutedOrValue(fmt(row.oncekiKapanis, 2))}</td>
                            <td className="px-3 py-2">{mutedOrValue(fmt(row.kapanis, 2))}</td>
                            <td className="px-3 py-2">{mutedOrValue(fmtPct(row.pctGetiri, 2))}</td>
                            <td className="px-3 py-2">{mutedOrValue(fmtPct(row.dipDistancePct, 2))}</td>
                            <td className="px-3 py-2">{mutedOrValue(fmtPct(row.topDistancePct, 2))}</td>
                            <td className="px-3 py-2">{mutedOrValue(fmtPct(row.dipBasedReturnPct, 2))}</td>
                            <td className="px-3 py-2">{mutedOrValue(fmtPct(row.topBasedReturnPct, 2))}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/8 to-cyan-600/12 border border-emerald-400/22 overflow-visible shadow-[0_0_28px_-14px_rgba(45,212,191,0.2)]">
                <h4 className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 to-teal-200 mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Dip/Zirve Rehberi
                </h4>
                <div className="space-y-2 text-gray-300">
                  <InfoLine title="Dip" text="Seçilen dönem içinde hissenin gördüğü en düşük fiyat seviyesidir." tip="Yeni dip kırılımı olursa tablo bir sonraki hafta güncellenir; stop seviyesi gibi düşünmeyin." />
                  <InfoLine title="Zirve" text="Seçilen dönem içinde hissenin gördüğü en yüksek fiyat seviyesidir." tip="Hacimsiz wick zirvesi yanıltıcı olabilir; haftalık kapanışla doğrulayın." />
                  <InfoLine title="Ağırlıklı Ortalama" text="İşlem hacmi ve adet etkisiyle oluşan dönemsel denge fiyatını ifade eder." tip="Aşırı tek günlük hacim ortalamayı çekebilir; volatil günlerde dikkat." />
                  <InfoLine title="Önceki Kapanış" text="Bir önceki kapanış fiyatıdır; günlük/haftalık değişimin başlangıç referansıdır." tip="Bölünme (split) günlerinde oran zıplar; dönemle uyumlu mu kontrol edin." />
                  <InfoLine title="Kapanış" text="Seçilen dönemin son kapanış fiyatıdır." tip="Gün içi fiyat değil; haftalık/rapor kapanışıdır." />
                  <InfoLine title="% Getiri" text="Kapanışın önceki kapanışa göre yüzde değişimini gösterir." tip="Endeks hareketiyle karşılaştırmak göreli gücü gösterir (alfa düşüncesi)." />
                  <InfoLine title="Dipten Uzaklık %" text="Kapanışın dip seviyesinden ne kadar uzaklaştığını gösterir." tip="Düşük % = dip bölgesine yapışıklık; yüksek % = ciddi ralli sonrası." />
                  <InfoLine title="Zirveden Uzaklık %" text="Kapanışın zirve seviyesine uzaklığını yüzdesel olarak ifade eder." tip="Düşük % = tavan dibinde; yüksek % = sert düzeltme sonrası olağan." />
                  <InfoLine title="Dibe/Zirveye Göre Getiri %" text="Dibe ve zirveye göre göreli getiri marjını gösterir." tip="Stop/kâr alanı senaryosu kurarken eşik fiyat türetmek içindir, öneri değildir." />
                  <p className="text-gray-400 text-xs pt-1">
                    Soldaki dip/zirve tablosunda sütun başlıklarının üzerine gelince kısa ipucu açılır.
                  </p>
                </div>
              </div>
            </section>

            <section className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/12 via-blue-500/10 to-pink-500/10 border border-cyan-400/25 shadow-[0_0_48px_-20px_rgba(34,211,238,0.18)]">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-blue-200 to-fuchsia-200 text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3 drop-shadow-[0_0_20px_rgba(34,211,238,0.25)]">
                  <GitCompare className="w-5 h-5" />
                  Yatırım Puanı vs Quant Karşılaştırması
                </h3>
                <div className="px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 text-sm">
                  Uyumlu Hisse: {data.summary.alignedCount} / {data.summary.comparedCount}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {topComparisons.map((row) => {
                  const diff =
                    row.internalScore !== null && row.quantScore !== null
                      ? row.internalScore - row.quantScore
                      : null;
                  return (
                    <div
                      key={row.code}
                      className="p-4 rounded-xl overflow-visible border border-cyan-400/20 bg-gradient-to-br from-[#060a14]/95 via-[#101828]/92 to-[#1a1040]/45 shadow-[0_16px_48px_-24px_rgba(0,0,0,0.55),0_0_32px_-12px_rgba(56,232,255,0.08)]"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="text-cyan-200 font-semibold">{row.code}</div>
                          <div className="text-gray-200 text-sm">{row.name}</div>
                          <div className="text-gray-400 text-xs">{row.sector}</div>
                        </div>
                        <div className="px-2 py-1 rounded-md text-xs font-medium border shrink-0" style={badgeStyle(diff)}>
                          {diffLabel(diff)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="p-3 rounded-lg" style={internalScoreHeroStyle}>
                          <div className="text-cyan-200/90 text-xs">Yatırım Puanı</div>
                          <div className="text-cyan-100 text-xl font-bold drop-shadow-sm">{mutedOrValue(fmt(row.internalScore, 1))}</div>
                        </div>
                        <div className="p-3 rounded-lg" style={quantHeroStyle}>
                          <div className="text-fuchsia-200/95 text-xs">Quant Skoru</div>
                          <div className="text-purple-50 text-xl font-bold drop-shadow-[0_0_12px_rgba(236,72,153,0.25)]">{mutedOrValue(fmt(row.quantScore, 1))}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <MetricWithTip
                          label="Piotroski"
                          value={mutedOrValue(fmt(row.piotroskiFScore, 1))}
                          tip="Aynı hafta QPS satırındaki Piotroski; çeyreklik bilanço sürprizine tekrar bakın."
                          style={piotroskiBoxStyle}
                          valueClassName="text-sky-200"
                        />
                        <MetricWithTip
                          label="Magic Formula"
                          value={mutedOrValue(fmt(row.magicFormula, 1))}
                          tip="Dış Magic skoru: momentum veya büyüme kartlarındaki sinyalle çelişirse nedenini arayın."
                          style={magicFormulaBoxStyle}
                          valueClassName="text-fuchsia-100 drop-shadow-[0_0_10px_rgba(244,114,182,0.35)]"
                        />
                        <MetricWithTip
                          label="Dipten Uzaklık"
                          value={mutedOrValue(fmtPct(row.dipDistancePct, 1))}
                          tip="Haftalık dip_zirve tablosu ile aynı rapor; alttaki yorum cümlesinden bağımsız ham mesafe %."
                          style={diptenBoxStyle}
                          valueClassName="text-cyan-100"
                        />
                        <MetricWithTip
                          label="Zirveden Uzaklık"
                          value={mutedOrValue(fmtPct(row.topDistancePct, 1))}
                          tip="Tavan mesafesi; hedge/pozisyon büyüklüğü düşüncesi için alt metinle değil, seviyeyle okuyun."
                          style={zirvedenBoxStyle}
                          valueClassName="text-fuchsia-100"
                        />
                      </div>

                      <ComparisonInsightBox insight={row.insight} diff={diff} />
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 p-4 rounded-xl border border-cyan-400/20 bg-gradient-to-r from-cyan-500/8 via-blue-500/6 to-violet-500/8 text-gray-300 flex items-start gap-2 shadow-inner shadow-black/20">
                <Radar className="w-4 h-4 text-cyan-300 mt-0.5" />
                <p>
                  Bu alan, iç puan ile dış quant puanını ilk bakışta kıyaslamak için kart düzeninde tasarlanmıştır. Eksik metrikler
                  olduğunda değer yerine “Bu raporda veri yok” notu gösterilir.
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

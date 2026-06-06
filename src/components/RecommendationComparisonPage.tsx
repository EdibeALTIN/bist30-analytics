import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownWideNarrow,
  Building2,
  CalendarClock,
  ChevronDown,
  Layers,
  LineChart,
  Search,
  TrendingUp,
} from "lucide-react";
import { getRecommendationComparison } from "../api/client";
import {
  ComparisonPanel,
  FreshnessRow,
  HalkReportSnapshot,
  InstitutionOverviewCard,
  RecommendationComparisonResponse,
  StockComparisonRow,
} from "../data/recommendationComparison";

interface Props {
  onNavigate: (page: string) => void;
}

/** Hisseler ve diğer iç sayfalarla aynı gradient + global ızgara arka planı */
function RecommendationPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#0f1538] to-[#1a1f4e] relative">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.03) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/** Kart gövdesi — StockCard ile uyumlu; border ayrıca kurum rengi için eklenebilir */
const CARD_BG = "bg-gradient-to-br from-cyan-500/5 to-blue-600/5 backdrop-blur-sm";
const CARD_SURFACE = `${CARD_BG} border border-cyan-500/20`;

type InstitutionFilter = "halk" | "isyatirim" | "ziraat";
type SortKey = "potential" | "target" | "latest" | "reco" | "rank";
type RecoFilter = "all" | "AL" | "STRONG_AL" | "TUT" | "SAT" | "UNKNOWN";

type InstKey = "halk" | "isyatirim" | "ziraat";

function panelInstitutionKey(kind: string): InstitutionFilter {
  if (kind === "halk") return "halk";
  if (kind === "isyatirim") return "isyatirim";
  return "ziraat";
}

function panelToInstKey(panel: ComparisonPanel): InstKey {
  return panelInstitutionKey(panel.kind) as InstKey;
}

const INSTITUTION_THEME: Record<
  InstKey,
  {
    border: string;
    glow: string;
    topAccent: string;
    badge: string;
    badgeSoft: string;
    filterActive: string;
    filterIdle: string;
    potText: string;
    labelMuted: string;
    pillInstBar: string;
  }
> = {
  halk: {
    border: "border-cyan-400/45",
    glow: "shadow-[0_0_28px_-10px_rgba(34,211,238,0.45)]",
    topAccent: "from-cyan-400 via-sky-400 to-blue-500",
    badge: "bg-cyan-500/20 text-cyan-100 border-cyan-400/40",
    badgeSoft: "bg-cyan-500/10 text-cyan-200/90 border-cyan-400/25",
    pillInstBar: "border-l-2 border-cyan-400/70",
    filterActive: "bg-cyan-500/20 border-cyan-400/50 text-cyan-100 ring-1 ring-cyan-400/30",
    filterIdle: "bg-white/[0.04] border-white/10 text-slate-400 hover:border-cyan-500/25",
    potText: "text-cyan-200",
    labelMuted: "text-cyan-200/70",
  },
  isyatirim: {
    border: "border-emerald-400/40",
    glow: "shadow-[0_0_28px_-10px_rgba(52,211,153,0.4)]",
    topAccent: "from-emerald-400 via-teal-400 to-emerald-600",
    badge: "bg-emerald-500/20 text-emerald-100 border-emerald-400/40",
    badgeSoft: "bg-emerald-500/10 text-emerald-200/90 border-emerald-400/25",
    pillInstBar: "border-l-2 border-emerald-400/70",
    filterActive: "bg-emerald-500/20 border-emerald-400/50 text-emerald-100 ring-1 ring-emerald-400/30",
    filterIdle: "bg-white/[0.04] border-white/10 text-slate-400 hover:border-emerald-500/25",
    potText: "text-emerald-200",
    labelMuted: "text-emerald-200/70",
  },
  ziraat: {
    border: "border-rose-500/45",
    glow: "shadow-[0_0_28px_-10px_rgba(244,63,94,0.38)]",
    topAccent: "from-rose-500 via-red-500 to-rose-700",
    badge: "bg-rose-500/20 text-rose-100 border-rose-400/40",
    badgeSoft: "bg-rose-500/10 text-rose-200/90 border-rose-400/25",
    pillInstBar: "border-l-2 border-rose-500/75",
    filterActive: "bg-rose-500/20 border-rose-400/50 text-rose-100 ring-1 ring-rose-400/30",
    filterIdle: "bg-white/[0.04] border-white/10 text-slate-400 hover:border-rose-500/25",
    potText: "text-rose-200",
    labelMuted: "text-rose-200/70",
  },
};

function parseReportTs(raw: string | null | undefined): number {
  if (!raw) return 0;
  const s = String(raw).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00`).getTime();
  const tr = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s);
  if (tr) return new Date(`${tr[3]}-${tr[2].padStart(2, "0")}-${tr[1].padStart(2, "0")}T12:00:00`).getTime();
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

function maxTargetPrice(panels: ComparisonPanel[]): number | null {
  const nums = panels.map((p) => p.targetPrice).filter((x): x is number => x != null);
  if (!nums.length) return null;
  return Math.max(...nums);
}

function latestStockTimestamp(stock: StockComparisonRow): number {
  return Math.max(0, ...stock.panels.map((p) => parseReportTs(p.reportDate)));
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `%${n.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺`;
}

function fmtDateLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  const ts = parseReportTs(raw);
  if (!ts) return raw;
  return new Date(ts).toLocaleDateString("tr-TR");
}

/** Öneri metnini hedef fiyatla birleşmiş ham stringlerden arındırır; alanlar ayrı gösterilir. */
function displayRecommendation(panel: ComparisonPanel): string {
  const bucket = panel.recommendationBucket;
  const raw = panel.recommendation?.trim();

  const fromBucket = (): string | null => {
    if (bucket === "STRONG_AL") return "GÜÇLÜ AL";
    if (bucket === "AL") return "AL";
    if (bucket === "TUT") return "TUT";
    if (bucket === "SAT") return "SAT";
    return null;
  };

  if (!raw) {
    return fromBucket() ?? "Veri yok";
  }

  let t = raw.replace(/\s+/g, " ").trim();
  t = t.replace(/[\s]*[\d]+([.,][\d]+)?\s*₺\s*$/u, "").trim();
  t = t.replace(/^([A-ZÇĞİÖŞÜa-zçğıöşü]+)[\s]*([\d]+([.,][\d]+)?)\s*₺?$/iu, "$1").trim();
  if (!t) {
    return fromBucket() ?? "Veri yok";
  }
  return t;
}

function recoTone(bucket: string): { ring: string; text: string; bg: string } {
  if (bucket === "STRONG_AL" || bucket === "AL") {
    return {
      ring: "ring-emerald-400/40",
      text: "text-emerald-100",
      bg: "bg-emerald-500/20",
    };
  }
  if (bucket === "TUT") {
    return { ring: "ring-amber-400/40", text: "text-amber-100", bg: "bg-amber-500/18" };
  }
  if (bucket === "SAT") {
    return { ring: "ring-rose-400/40", text: "text-rose-100", bg: "bg-rose-500/18" };
  }
  return { ring: "ring-slate-500/35", text: "text-slate-300", bg: "bg-slate-700/30" };
}

function recoSummaryCompact(panels: ComparisonPanel[]): string | null {
  let strong = 0;
  let al = 0;
  let tut = 0;
  let sat = 0;
  for (const p of panels) {
    if (p.recommendationBucket === "STRONG_AL") strong++;
    else if (p.recommendationBucket === "AL") al++;
    else if (p.recommendationBucket === "TUT") tut++;
    else if (p.recommendationBucket === "SAT") sat++;
  }
  const parts: string[] = [];
  if (strong) parts.push(`${strong} GÜÇLÜ AL`);
  if (al) parts.push(`${al} AL`);
  if (tut) parts.push(`${tut} TUT`);
  if (sat) parts.push(`${sat} SAT`);
  return parts.length ? parts.join(" · ") : null;
}

function rankOrWeightLine(panel: ComparisonPanel): string {
  if (panel.rank != null) return `#${panel.rank} (BIST30)`;
  const extra = panel.extra as Record<string, unknown> | undefined;
  const w = extra?.portfolioWeightPct ?? extra?.weightPct;
  if (typeof w === "number" && !Number.isNaN(w)) return `Ağırlık %${w.toFixed(1)}`;
  if (panel.note?.includes("ağırlık") || panel.note?.includes("Ağırlık")) {
    const m = /%?\s*([\d.,]+)/.exec(panel.note);
    if (m) return `Ağırlık %${m[1]}`;
  }
  return "—";
}

function MiniPanel({
  panel,
  freshnessHint,
}: {
  panel: ComparisonPanel;
  freshnessHint: FreshnessRow | undefined;
}) {
  const inst = panelToInstKey(panel);
  const th = INSTITUTION_THEME[inst];
  const tone = recoTone(panel.recommendationBucket);
  const cadence = freshnessHint?.cadenceLabel;
  const recoDisplay = displayRecommendation(panel);

  return (
    <div className={`relative rounded-xl overflow-hidden ${CARD_BG} border ${th.border} ${th.glow}`}>
      <div className={`h-0.5 w-full bg-gradient-to-r ${th.topAccent} opacity-90`} />
      <div className="p-4 sm:p-4">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div>
            <div className={`text-[10px] uppercase tracking-wider font-semibold ${th.labelMuted}`}>Kurum</div>
            <div className="text-sm font-bold text-white leading-tight">{panel.institutionLabel}</div>
            {panel.subLabel && (
              <div className="text-[11px] text-slate-500 mt-1">{panel.subLabel}</div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Öneri</div>
            <span
              className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold border border-white/10 ring-1 ${tone.ring} ${tone.bg} ${tone.text} pl-2 ${th.pillInstBar}`}
            >
              {recoDisplay}
            </span>
          </div>
        </div>

        <dl className="space-y-3 text-xs">
          <div className="flex justify-between gap-3 border-b border-white/[0.06] pb-2.5">
            <dt className="text-slate-500 shrink-0">Hedef fiyat</dt>
            <dd className="text-right text-white font-semibold tabular-nums">
              {panel.targetPrice != null ? fmtMoney(panel.targetPrice) : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-white/[0.06] pb-2.5">
            <dt className="text-slate-500 shrink-0">Potansiyel getiri</dt>
            <dd className={`text-right font-semibold tabular-nums ${th.potText}`}>
              {panel.potentialReturnPct != null ? fmtPct(panel.potentialReturnPct) : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-white/[0.06] pb-2.5">
            <dt className="text-slate-500 shrink-0">Referans fiyat</dt>
            <dd className="text-right text-slate-200 tabular-nums">
              {panel.referencePrice != null ? fmtMoney(panel.referencePrice) : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-white/[0.06] pb-2.5">
            <dt className="text-slate-500 shrink-0">Rapor tarihi</dt>
            <dd className="text-right text-slate-300 tabular-nums text-[11px]">
              {panel.reportDate ? fmtDateLabel(panel.reportDate) : "—"}
              {cadence && (
                <span className="block text-[10px] text-slate-500 mt-0.5">{cadence}</span>
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500 shrink-0">Sıra / portföy</dt>
            <dd className="text-right text-slate-200 text-[11px] font-medium">{rankOrWeightLine(panel)}</dd>
          </div>
        </dl>
        {panel.note && (
          <p className="mt-3 text-[11px] text-slate-500 leading-snug border-t border-white/[0.06] pt-3">
            {panel.note}
          </p>
        )}
      </div>
    </div>
  );
}

function SummaryMetricCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "cyan",
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: "cyan" | "emerald" | "violet" | "amber";
}) {
  const iconBox =
    accent === "cyan"
      ? "bg-cyan-500/12 border-cyan-400/25 text-cyan-300"
      : accent === "emerald"
        ? "bg-emerald-500/12 border-emerald-400/25 text-emerald-300"
        : accent === "violet"
          ? "bg-violet-500/12 border-violet-400/25 text-violet-300"
          : "bg-amber-500/12 border-amber-400/25 text-amber-200";

  return (
    <div
      className={`group relative rounded-2xl overflow-hidden ${CARD_SURFACE} shadow-[0_12px_40px_-18px_rgba(0,0,0,0.5)] hover:border-cyan-500/40 transition-all duration-300`}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-white/[0.04] to-transparent pointer-events-none" />
      <div className="relative p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`w-11 h-11 rounded-xl border flex items-center justify-center ${iconBox}`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide leading-tight">
            {label}
          </span>
        </div>
        <div className="text-2xl sm:text-[1.65rem] font-bold text-white tracking-tight">{value}</div>
        {sub && <p className="mt-2 text-xs text-slate-500 leading-relaxed">{sub}</p>}
      </div>
    </div>
  );
}

function labelForHalkSnapshot(s: HalkReportSnapshot): string {
  if (s.reportDateIso) return fmtDateLabel(s.reportDateIso);
  if (s.reportDateLabel) return s.reportDateLabel;
  return `#${s.reportId}`;
}

function HalkHistoricalPickerCard({
  snapshots,
  selectedReportId,
  onSelectReportId,
  busy,
}: {
  snapshots: HalkReportSnapshot[];
  selectedReportId: number | null;
  onSelectReportId: (id: number | null) => void;
  busy: boolean;
}) {
  const hasSnapshots = snapshots.length > 0;
  const latestSnap = snapshots[0];
  const autoOptionLabel = latestSnap != null ? labelForHalkSnapshot(latestSnap) : "—";

  const selectedSnap =
    selectedReportId === null ? null : snapshots.find((s) => s.reportId === selectedReportId) ?? null;

  const treatAsAutomatic =
    selectedReportId === null ||
    (latestSnap != null && selectedReportId === latestSnap.reportId);

  const olderSnapshots = snapshots.length > 1 ? snapshots.slice(1) : [];

  /** Boş seçenek ile en güncel batch aynı id ise çift seçenek yok; seçimi otomatikte göster. */
  const selectValue =
    treatAsAutomatic
      ? ""
      : snapshots.some((s) => s.reportId === selectedReportId) && selectedReportId != null
        ? String(selectedReportId)
        : "";

  const orphanedSelection =
    !treatAsAutomatic &&
    selectedReportId != null &&
    !snapshots.some((s) => s.reportId === selectedReportId);

  const Icon = CalendarClock;
  const iconBox = "bg-amber-500/12 border-amber-400/25 text-amber-200";

  const selectControlValue =
    orphanedSelection && selectedReportId != null ? String(selectedReportId) : selectValue;

  const selectTitle =
    treatAsAutomatic
      ? autoOptionLabel
      : selectedSnap
        ? labelForHalkSnapshot(selectedSnap)
        : selectedReportId != null
          ? `Rapor #${selectedReportId}`
          : autoOptionLabel;

  return (
    <div
      className={`group relative rounded-2xl overflow-hidden w-full ${CARD_SURFACE} shadow-[0_12px_40px_-18px_rgba(0,0,0,0.5)] border border-amber-500/25 transition-all duration-300`}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-amber-500/[0.06] to-transparent pointer-events-none" />
      <div className="relative p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${iconBox}`}>
            <Icon className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide leading-tight">
            Halk rapor tarihi
          </span>
        </div>

        <label className="block">
          <span className="sr-only">Geçmiş Halk önerisi raporu</span>
          <div className="relative">
            <select
              aria-label="Halk raporu için tarih seçin"
              value={selectControlValue}
              disabled={!hasSnapshots || busy}
              onChange={(e) => {
                const raw = e.target.value;
                onSelectReportId(raw === "" ? null : Number(raw));
              }}
              className="w-full cursor-pointer rounded-xl bg-[#080d1a]/95 hover:bg-[#0c1222] disabled:opacity-50 disabled:pointer-events-none border border-amber-500/35 text-[15px] sm:text-base font-semibold text-white tracking-tight py-3 pl-4 pr-12 shadow-inner shadow-black/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/35 appearance-none truncate"
              title={selectTitle}
            >
              <option value="">{hasSnapshots ? autoOptionLabel : "Rapor kaydı yok"}</option>
              {olderSnapshots.map((s) => (
                <option key={s.reportId} value={s.reportId}>
                  {labelForHalkSnapshot(s)}
                </option>
              ))}
              {orphanedSelection && selectedReportId != null ? (
                <option value={selectedReportId}>{`Rapor #${selectedReportId}`}</option>
              ) : null}
            </select>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-300/85"
            />
          </div>
        </label>

        {busy ? (
          <p className="text-xs text-slate-500 leading-relaxed mt-[-4px]">Kayıtlar yenileniyor…</p>
        ) : (
          <p className="text-xs text-slate-500 leading-relaxed mt-[-4px]">
            İş/Ziraat verisi bu listeden bağımsızdır; yalnızca Halk satırları seçilen tarihe göre güncellenir.
          </p>
        )}
      </div>
    </div>
  );
}

export function RecommendationComparisonPage({ onNavigate }: Props) {
  const [data, setData] = useState<RecommendationComparisonResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refetchBusy, setRefetchBusy] = useState(false);
  const [halkReportId, setHalkReportId] = useState<number | null>(null);
  const loadSucceededOnceRef = useRef(false);

  const [search, setSearch] = useState("");
  const [sector, setSector] = useState<string>("all");
  const [recoFilter, setRecoFilter] = useState<RecoFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("potential");
  const [instFilters, setInstFilters] = useState<Record<InstitutionFilter, boolean>>({
    halk: false,
    isyatirim: false,
    ziraat: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!loadSucceededOnceRef.current) setLoading(true);
        else setRefetchBusy(true);
        setError("");
        const res = await getRecommendationComparison(halkReportId);
        if (!cancelled) {
          setData(res);
          loadSucceededOnceRef.current = true;
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Veri yüklenemedi";
          if (!loadSucceededOnceRef.current) setError(msg);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefetchBusy(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [halkReportId]);

  const freshnessById = useMemo(() => {
    const m = new Map<string, FreshnessRow>();
    data?.freshness.forEach((f) => m.set(f.id, f));
    return m;
  }, [data]);

  const sectors = useMemo(() => {
    const s = new Set<string>();
    data?.stocks.forEach((st) => {
      if (st.sector) s.add(st.sector);
    });
    return ["all", ...Array.from(s).sort((a, b) => a.localeCompare(b, "tr"))];
  }, [data]);

  const anyInstFilter = instFilters.halk || instFilters.isyatirim || instFilters.ziraat;

  const filteredStocks = useMemo(() => {
    if (!data) return [];
    let rows = data.stocks.slice();

    const q = search.trim().toUpperCase();
    if (q) {
      rows = rows.filter(
        (s) => s.code.includes(q) || (s.name && s.name.toUpperCase().includes(q))
      );
    }
    if (sector !== "all") {
      rows = rows.filter((s) => s.sector === sector);
    }
    if (recoFilter !== "all") {
      rows = rows.filter((s) => s.panels.some((p) => p.recommendationBucket === recoFilter));
    }
    if (anyInstFilter) {
      rows = rows.filter((s) =>
        s.panels.some((p) => {
          const k = panelInstitutionKey(p.kind);
          return instFilters[k];
        })
      );
    }

    const sorted = rows.sort((a, b) => {
      if (sortKey === "potential") {
        const av = a.maxPotentialPct ?? -1e9;
        const bv = b.maxPotentialPct ?? -1e9;
        return bv - av;
      }
      if (sortKey === "target") {
        const at = maxTargetPrice(a.panels) ?? -1e9;
        const bt = maxTargetPrice(b.panels) ?? -1e9;
        return bt - at;
      }
      if (sortKey === "latest") {
        return latestStockTimestamp(b) - latestStockTimestamp(a);
      }
      if (sortKey === "reco") {
        return b.recoStrengthMax - a.recoStrengthMax;
      }
      const ar = a.sortRank ?? 9999;
      const br = b.sortRank ?? 9999;
      return ar - br;
    });
    return sorted;
  }, [data, search, sector, recoFilter, sortKey, instFilters, anyInstFilter]);

  const toggleInst = (k: InstitutionFilter) => {
    setInstFilters((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  if (loading && !data) {
    return (
      <RecommendationPageShell>
        <div className="pt-24 pb-20 px-4 max-w-7xl mx-auto text-center text-slate-400">
          Kurum önerileri yükleniyor…
        </div>
      </RecommendationPageShell>
    );
  }

  if (!data) {
    return (
      <RecommendationPageShell>
        <div className="pt-24 pb-20 px-4 max-w-7xl mx-auto">
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 px-4 py-3 text-rose-200 text-sm">
            {error || "Veri bulunamadı."}
          </div>
        </div>
      </RecommendationPageShell>
    );
  }

  return (
    <RecommendationPageShell>
    <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Page header — matches app bg, no grid box */}
      <header className="mb-10 sm:mb-12 border-b border-white/[0.08] pb-8 sm:pb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3">
          Kurum Önerileri ve Hedef Fiyatlar
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-3xl leading-relaxed mb-4">
          Halk Yatırım, İş Yatırım ve Ziraat Yatırım kaynaklı hedef fiyat, öneri ve potansiyel getiri
          verilerini hisse bazında karşılaştırır.
        </p>
        <p className="text-xs sm:text-sm text-slate-500 max-w-3xl leading-relaxed border-l-2 border-cyan-500/35 pl-4">
          Halk Yatırım verisi haftalık güncellenir; diğer kaynakların güncelliği rapor tarihine göre gösterilir.
        </p>
      </header>

      {/* Summary — only meaningful KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-12">
        <SummaryMetricCard
          icon={Layers}
          label="Karşılaştırılan hisse"
          value={data.summary.totalStocks.toLocaleString("tr-TR")}
          accent="cyan"
        />
        <SummaryMetricCard
          icon={Building2}
          label="Birden fazla kurumda görünen hisse"
          value={data.summary.multiInstitutionStocks.toLocaleString("tr-TR")}
          sub="En az iki kurumda kaydı olan kodlar."
          accent="violet"
        />
        <SummaryMetricCard
          icon={TrendingUp}
          label="En yüksek potansiyel"
          value={
            data.summary.topPotential ? (
              <button
                type="button"
                onClick={() => onNavigate(`stock-${data.summary.topPotential!.code}`)}
                className="text-left hover:text-cyan-300 transition-colors"
              >
                {data.summary.topPotential.code}{" "}
                <span className="text-lg text-cyan-200 font-bold">
                  {fmtPct(data.summary.topPotential.potentialPct)}
                </span>
              </button>
            ) : (
              "—"
            )
          }
          sub={
            data.summary.topPotential
              ? `Kaynak: ${data.summary.topPotential.sourceLabel}`
              : "Potansiyel getiri verisi yok."
          }
          accent="emerald"
        />
        <HalkHistoricalPickerCard
          snapshots={data.meta.halkReportSnapshots ?? []}
          selectedReportId={halkReportId}
          onSelectReportId={setHalkReportId}
          busy={refetchBusy}
        />
      </section>

      {/* Institution overview */}
      <section className="mb-12">
        <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-cyan-400" />
              Kurum bazlı özet
            </h2>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Kayıt hacmi, son rapor ve öne çıkan kodlar — hızlı bağlam.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {data.institutionOverview.map((io: InstitutionOverviewCard) => {
            const inst = io.id as InstKey;
            const th = INSTITUTION_THEME[inst] ?? INSTITUTION_THEME.halk;
            return (
              <article
                key={io.id}
                className={`rounded-2xl border ${th.border} ${th.glow} ${CARD_BG} p-6 flex flex-col relative overflow-hidden`}
              >
                <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${th.topAccent}`} />
                <div className="flex items-center justify-between gap-2 mb-4 pt-1">
                  <h3 className="text-lg font-bold text-white">{io.label}</h3>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-md border font-semibold ${th.badge}`}>
                    {io.recordCount} kayıt
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-4 flex-1">{io.description}</p>
                <dl className="grid grid-cols-2 gap-3 text-xs border-t border-white/[0.07] pt-4">
                  <div>
                    <dt className="text-slate-500">Son rapor</dt>
                    <dd className="text-slate-200 font-medium">{fmtDateLabel(io.latestReportDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Ort. potansiyel</dt>
                    <dd className={`font-semibold tabular-nums ${th.potText}`}>
                      {io.avgPotentialPct != null ? fmtPct(io.avgPotentialPct) : "—"}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-slate-500 mb-1.5">Öne çıkan kodlar</dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {io.standoutCodes.length ? (
                        io.standoutCodes.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => onNavigate(`stock-${c}`)}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold border transition-colors ${th.badgeSoft} hover:brightness-125`}
                          >
                            {c}
                          </button>
                        ))
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      </section>

      {/* Filters */}
      <section className={`mb-8 rounded-2xl p-4 sm:p-5 shadow-inner shadow-black/20 ${CARD_SURFACE}`}>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mr-2">
            Kurum
          </span>
          {(
            [
              ["halk", "Halk", "halk" as const],
              ["isyatirim", "İş", "isyatirim" as const],
              ["ziraat", "Ziraat", "ziraat" as const],
            ] as const
          ).map(([k, label, inst]) => (
            <button
              key={k}
              type="button"
              onClick={() => toggleInst(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                instFilters[k] ? INSTITUTION_THEME[inst].filterActive : INSTITUTION_THEME[inst].filterIdle
              }`}
            >
              {label}
            </button>
          ))}
          <span className="text-[10px] text-slate-500 ml-1">Tümü için filtreyi temizleyin</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hisse kodu veya ad…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#0f1538]/45 border border-cyan-500/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25"
            />
          </div>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="w-full py-2.5 px-3 rounded-xl bg-[#0f1538]/45 border border-cyan-500/15 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/25"
          >
            {sectors.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "Tüm sektörler" : s}
              </option>
            ))}
          </select>
          <select
            value={recoFilter}
            onChange={(e) => setRecoFilter(e.target.value as RecoFilter)}
            className="w-full py-2.5 px-3 rounded-xl bg-[#0f1538]/45 border border-cyan-500/15 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/25"
          >
            <option value="all">Tüm öneriler</option>
            <option value="STRONG_AL">Güçlü AL</option>
            <option value="AL">AL</option>
            <option value="TUT">TUT / Nötr</option>
            <option value="SAT">SAT</option>
            <option value="UNKNOWN">Belirsiz</option>
          </select>
          <div className="flex items-center gap-2">
            <ArrowDownWideNarrow className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-full py-2.5 px-3 rounded-xl bg-[#0f1538]/45 border border-cyan-500/15 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/25"
            >
              <option value="potential">Potansiyel getiri</option>
              <option value="target">Hedef fiyat</option>
              <option value="latest">En güncel rapor</option>
              <option value="reco">Öneri gücü</option>
              <option value="rank">Halk BIST30 sırası</option>
            </select>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-3">
          Gösterilen: <span className="text-slate-300 font-medium">{filteredStocks.length}</span> /{" "}
          {data.stocks.length} hisse
        </p>
      </section>

      {/* Stock comparison */}
      <section className="mb-14">
        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          <LineChart className="w-5 h-5 text-emerald-400" />
          Hisse bazlı karşılaştırma
        </h2>
        <p className="text-sm text-slate-500 mb-8 max-w-3xl leading-relaxed">
          Aynı hisse için kurum panelleri yan yana; kaynakta kayıt yoksa ilgili panel listelenmez.
        </p>
        <div className="flex flex-col gap-8">
          {filteredStocks.map((stock) => {
            const recoLine = recoSummaryCompact(stock.panels);
            return (
              <article
                key={stock.code}
                className={`rounded-2xl ${CARD_SURFACE} shadow-[0_16px_56px_-20px_rgba(0,0,0,0.45)] overflow-hidden hover:border-cyan-500/35 transition-colors`}
              >
                <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-emerald-500 to-rose-500 opacity-85" />
                <div className="px-5 py-4 sm:px-7 sm:py-5 border-b border-white/[0.06] flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onNavigate(`stock-${stock.code}`)}
                      className="text-2xl font-bold text-white tracking-tight hover:text-cyan-300 transition-colors font-mono"
                    >
                      {stock.code}
                    </button>
                    <div className="text-sm text-slate-400 mt-0.5">{stock.name}</div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {stock.sector && (
                        <span className="text-[10px] uppercase font-semibold tracking-wide px-2.5 py-1 rounded-lg bg-violet-500/15 text-violet-200 border border-violet-400/30">
                          {stock.sector}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-white/[0.06] text-slate-300 border border-white/10">
                        {stock.institutionCount} kurumda veri
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right shrink-0">
                    {recoLine && (
                      <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                        <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">
                          Öneri özeti
                        </div>
                        <div className="text-xs font-bold text-slate-100 tracking-tight">{recoLine}</div>
                      </div>
                    )}
                    {stock.maxPotentialPct != null && (
                      <div>
                        <div className="text-[9px] text-slate-500 uppercase font-semibold">En yüksek potansiyel</div>
                        <div className="text-lg font-bold text-cyan-200 tabular-nums">
                          {fmtPct(stock.maxPotentialPct)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="px-5 sm:px-7 py-2.5 border-b border-white/[0.05] bg-cyan-500/[0.03]">
                  <p className="text-xs text-slate-500 leading-relaxed flex gap-2 items-start">
                    <Activity className="w-3.5 h-3.5 text-cyan-500/60 shrink-0 mt-0.5" />
                    <span>{stock.insight}</span>
                  </p>
                </div>
                <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                  {stock.panels.map((panel, idx) => {
                    const fid =
                      panel.kind === "halk"
                        ? "halk"
                        : panel.kind === "isyatirim"
                          ? "isyatirim"
                          : "ziraat";
                    return (
                      <MiniPanel
                        key={`${stock.code}-${panel.kind}-${idx}`}
                        panel={panel}
                        freshnessHint={freshnessById.get(fid)}
                      />
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Highlights — ranking boards */}
      <section className="mb-8">
        <h2 className="text-xl font-bold text-white mb-2">Öne çıkanlar</h2>
        <p className="text-sm text-slate-500 mb-8 max-w-2xl leading-relaxed">
          Kurum kaynaklarına göre derlenmiş sıralı panolar; hızlı tarama için.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          <HighlightBoard
            title="Halk Yatırım — BIST30 sıralaması"
            subtitle="Sıra, potansiyel getiri"
            rows={data.highlights.halkBist30Ranking.map((r) => ({
              code: r.code,
              rank: r.rank,
              reco: null,
              target: null,
              pot: r.potentialReturnPct,
              badge: "Halk",
            }))}
            onNavigate={onNavigate}
            accent="cyan"
          />
          <HighlightBoard
            title="İş Yatırım — En çok önerilen"
            subtitle="Hedef, potansiyel ve ağırlık"
            rows={data.highlights.isyatirimEncok.map((raw) => {
              const code = String(raw.code ?? "");
              return {
                code,
                rank: null,
                reco: null,
                target: (raw.targetPrice as number) ?? (raw.hedef as number) ?? null,
                pot: (raw.potentialReturnPct as number) ?? (raw.pot as number) ?? null,
                badge: "İş",
                extra: raw.weightPct != null ? `Ağırlık %${raw.weightPct}` : undefined,
              };
            })}
            onNavigate={onNavigate}
            accent="emerald"
          />
          <HighlightBoard
            title="Ziraat — Öneri portföyü"
            subtitle="Öneri, hedef ve portföy ağırlığı"
            rows={data.highlights.ziraatPortfoy.map((raw) => {
              const code = String(raw.code ?? "");
              return {
                code,
                rank: null,
                reco: (raw.oneri as string) ?? null,
                target: (raw.targetPrice as number) ?? (raw.hedef_hisse_fiyati_tl as number) ?? null,
                pot: (raw.potentialReturnPct as number) ?? (raw.potansiyel_getiri_pct as number) ?? null,
                badge: "Portföy",
                extra:
                  raw.portfolioWeightPct != null
                    ? `Ağırlık %${Number(raw.portfolioWeightPct).toFixed(1)}`
                    : undefined,
              };
            })}
            onNavigate={onNavigate}
            accent="rose"
          />
          <HighlightBoard
            title="Ziraat — Genel takip listesi"
            subtitle="Öneri, hedef ve rapor tarihi"
            rows={data.highlights.ziraatGenelTakip.map((raw) => {
              const code = String(raw.code ?? "");
              return {
                code,
                rank: null,
                reco: (raw.recommendationRaw as string) ?? (raw.oneri as string) ?? null,
                target: (raw.targetPrice as number) ?? (raw.hedef_fiyat_tl as number) ?? null,
                pot: null,
                badge: "Takip",
                extra: raw.reportDate ? String(raw.reportDate) : undefined,
              };
            })}
            onNavigate={onNavigate}
            accent="rose"
          />
        </div>
      </section>

      <footer className="text-center text-[11px] text-slate-600 border-t border-white/[0.06] pt-8">
        Öneri metinleri kaynak kurum raporlarından aktarılmıştır; yatırım tavsiyesi değildir.
      </footer>
    </div>
    </RecommendationPageShell>
  );
}

function HighlightBoard({
  title,
  subtitle,
  rows,
  onNavigate,
  accent,
}: {
  title: string;
  subtitle: string;
  rows: {
    code: string;
    rank: number | null;
    reco: string | null;
    target: number | null;
    pot: number | null;
    badge: string;
    extra?: string;
  }[];
  onNavigate: (p: string) => void;
  accent: "cyan" | "emerald" | "rose";
}) {
  const th =
    accent === "cyan"
      ? {
          border: "border-cyan-500/35",
          head: "from-cyan-600/90 to-sky-700/80",
          glow: "shadow-[0_0_40px_-16px_rgba(34,211,238,0.35)]",
          rank: "text-cyan-300",
          pot: "text-cyan-200",
        }
      : accent === "emerald"
        ? {
            border: "border-emerald-500/35",
            head: "from-emerald-600/85 to-teal-800/80",
            glow: "shadow-[0_0_40px_-16px_rgba(52,211,153,0.32)]",
            rank: "text-emerald-300",
            pot: "text-emerald-200",
          }
        : {
            border: "border-rose-500/35",
            head: "from-rose-600/85 to-red-900/75",
            glow: "shadow-[0_0_40px_-16px_rgba(244,63,94,0.3)]",
            rank: "text-rose-300",
            pot: "text-rose-200",
          };

  return (
    <div
      className={`rounded-2xl border ${th.border} ${th.glow} ${CARD_BG} overflow-hidden flex flex-col`}
    >
      <div className={`px-5 py-4 bg-gradient-to-r ${th.head} border-b border-white/10 shrink-0`}>
        <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
        <p className="text-[11px] text-white/70 mt-1">{subtitle}</p>
      </div>
      <div className="overflow-x-auto max-h-72 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-10 px-4">Kayıt yok.</p>
        ) : (
          <table className="w-full min-w-[320px] table-fixed border-separate border-spacing-0">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.04]">
                <th className="w-10 py-2.5 pl-3 pr-1 text-left text-[9px] uppercase tracking-wider font-semibold text-slate-500">
                  #
                </th>
                <th className="py-2.5 pr-2 text-left text-[9px] uppercase tracking-wider font-semibold text-slate-500">
                  Kod
                </th>
                <th className="w-[22%] py-2.5 px-1 text-right text-[9px] uppercase tracking-wider font-semibold text-slate-500">
                  Öneri
                </th>
                <th className="w-[22%] py-2.5 px-1 text-right text-[9px] uppercase tracking-wider font-semibold text-slate-500">
                  Hedef
                </th>
                <th className="w-[18%] py-2.5 pl-1 pr-3 text-right text-[9px] uppercase tracking-wider font-semibold text-slate-500">
                  Pot.
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {rows.map((r, i) => (
                <tr key={`${r.code}-${i}`} className="hover:bg-white/[0.04] transition-colors">
                  <td className="align-middle py-2 pl-3 pr-1">
                    <span className={`text-[11px] font-bold tabular-nums ${th.rank}`}>
                      {r.rank != null ? `#${r.rank}` : "—"}
                    </span>
                  </td>
                  <td className="align-middle py-2 pr-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <button
                        type="button"
                        onClick={() => onNavigate(`stock-${r.code}`)}
                        className="font-mono text-sm font-bold text-white hover:text-cyan-300 text-left shrink-0"
                      >
                        {r.code}
                      </button>
                      <span className="text-[9px] px-1.5 py-0.5 rounded border border-white/10 text-slate-500 whitespace-nowrap">
                        {r.badge}
                      </span>
                    </div>
                    {r.extra ? (
                      <div className="text-[9px] text-slate-500 mt-1 leading-tight truncate" title={r.extra}>
                        {r.extra}
                      </div>
                    ) : null}
                  </td>
                  <td className="align-middle py-2 px-1 text-right">
                    <span
                      className="text-[10px] text-slate-300 tabular-nums block truncate"
                      title={r.reco ?? undefined}
                    >
                      {r.reco?.trim() ? r.reco : "—"}
                    </span>
                  </td>
                  <td className="align-middle py-2 px-1 text-right whitespace-nowrap">
                    <span className="text-[10px] text-slate-200 tabular-nums">
                      {r.target != null ? fmtMoney(r.target) : "—"}
                    </span>
                  </td>
                  <td className="align-middle py-2 pl-1 pr-3 text-right whitespace-nowrap">
                    <span className={`text-[10px] font-semibold tabular-nums ${th.pot}`}>
                      {r.pot != null ? fmtPct(r.pot) : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

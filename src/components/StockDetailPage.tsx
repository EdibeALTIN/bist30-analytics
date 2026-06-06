import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, TrendingUp, Shield, Zap, Award, History } from "lucide-react";
import { getStock, getStockHistory, getStocks } from "../api/client";
import { Stock } from "../data/stocks";
import { StockChartPoint } from "../data/stockHistory";
import { useFinancialPeriod } from "../contexts/FinancialPeriodContext";
import { fmtFin, fmtFinPct } from "../utils/formatFinancial";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

interface StockDetailPageProps {
  stockCode: string;
  onNavigate: (page: string) => void;
}

type HistoryChip = { id: number; donem: string; tarih: string };

export function StockDetailPage({ stockCode, onNavigate }: StockDetailPageProps) {
  const { donem: ctxDonem } = useFinancialPeriod();
  const [stock, setStock] = useState<Stock | null>(null);
  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRecordId, setSelectedRecordId] = useState<number | null>(null);
  const [historySeries, setHistorySeries] = useState<StockChartPoint[]>([]);
  const [historyChips, setHistoryChips] = useState<HistoryChip[]>([]);

  useEffect(() => {
    setSelectedRecordId(null);
  }, [ctxDonem, stockCode]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const stockFetch =
      selectedRecordId != null
        ? getStock(stockCode, { recordId: selectedRecordId })
        : getStock(stockCode, ctxDonem ? { donem: ctxDonem } : undefined);

    Promise.all([stockFetch, getStocks(ctxDonem)])
      .then(([detail, list]) => {
        if (!active) return;
        setStock(detail);
        setAllStocks(list);
        setError("");
      })
      .catch(() => {
        if (!active) return;
        setError("Hisse detayı yüklenemedi.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [stockCode, selectedRecordId, ctxDonem]);

  useEffect(() => {
    let active = true;
    getStockHistory(stockCode)
      .then((h) => {
        if (!active) return;
        const asc = [...h.chartSeries].reverse();
        setHistorySeries(asc);
        setHistoryChips(
          (h.items as Record<string, unknown>[]).map((raw) => ({
            id: Number(raw.id),
            donem: raw.donem != null ? String(raw.donem).trim() : "",
            tarih: raw.tarih != null ? String(raw.tarih).trim() : "",
          }))
        );
      })
      .catch(() => {
        if (active) {
          setHistorySeries([]);
          setHistoryChips([]);
        }
      });
    return () => {
      active = false;
    };
  }, [stockCode]);

  const sectorStocks = useMemo(() => {
    if (!stock) return [];
    return allStocks.filter((s) => s.sector === stock.sector);
  }, [allStocks, stock]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#0f1538] to-[#1a1f4e] pt-24 pb-12">
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-gray-300">
          Hisse detayı yükleniyor...
        </div>
      </div>
    );
  }

  if (error || !stock) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#0f1538] to-[#1a1f4e] pt-24 pb-12">
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => onNavigate("stocks")}
            className="mb-6 flex items-center gap-2 text-gray-400 hover:text-cyan-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Geri Dön
          </button>
          <div className="text-red-400">{error || "Hisse bulunamadı."}</div>
        </div>
      </div>
    );
  }

  const numAvg = (vals: (number | null | undefined)[]) => {
    const nums = vals.filter((x): x is number => x != null && !Number.isNaN(x));
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  };

  const sectorAverage = {
    score: sectorStocks.length
      ? Math.round(sectorStocks.reduce((sum, s) => sum + s.score, 0) / sectorStocks.length)
      : 0,
    pe: numAvg(sectorStocks.map((s) => s.pe)),
    roe: numAvg(sectorStocks.map((s) => s.roe)),
    roa: numAvg(sectorStocks.map((s) => s.roa)),
    ebitdaMargin: numAvg(sectorStocks.map((s) => s.ebitdaMargin)),
  };

  const nz = (v: number | null | undefined, fb = 0) => (v == null || Number.isNaN(v) ? fb : v);

  const radarData = [
    { metric: "F/K", value: Math.min(100, (15 - nz(stock.pe, 15)) * 10), fullMark: 100 },
    { metric: "ROE", value: Math.min(100, nz(stock.roe) * 3), fullMark: 100 },
    { metric: "ROA", value: Math.min(100, nz(stock.roa) * 8), fullMark: 100 },
    { metric: "Büyüme", value: Math.min(100, nz(stock.quarterlyNetIncomeGrowth) * 1.5), fullMark: 100 },
    { metric: "Likidite", value: Math.min(100, nz(stock.currentRatio) * 50), fullMark: 100 },
  ];

  const comparisonData = [
    { name: stock.code, score: stock.score, roe: nz(stock.roe), pe: nz(stock.pe) },
    {
      name: "Sektör Ort.",
      score: sectorAverage.score,
      roe: nz(sectorAverage.roe),
      pe: nz(sectorAverage.pe),
    },
  ];

  const peVal = stock.pe;
  const valuationCat =
    peVal == null ? 0 : peVal < 8 ? 30 : peVal < 12 ? 20 : peVal < 20 ? 15 : 10;
  const scoreBreakdown = [
    { category: "Değerleme", score: Math.min(30, valuationCat), max: 30 },
    {
      category: "Karlılık",
      score: Math.min(
        25,
        stock.roe == null ? 0 : stock.roe > 20 ? 25 : stock.roe > 15 ? 18 : 12
      ),
      max: 25,
    },
    {
      category: "Büyüme",
      score: Math.min(
        25,
        stock.quarterlyNetIncomeGrowth == null
          ? 0
          : stock.quarterlyNetIncomeGrowth > 40
            ? 25
            : stock.quarterlyNetIncomeGrowth > 30
              ? 20
              : 15
      ),
      max: 25,
    },
    {
      category: "Likidite",
      score: Math.min(
        20,
        stock.currentRatio == null
          ? 0
          : stock.currentRatio > 1.5
            ? 20
            : stock.currentRatio > 1.2
              ? 15
              : 10
      ),
      max: 20,
    },
  ];

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (stock.roe != null && stock.roe > 20) strengths.push("Yüksek karlılık (ROE)");
  if (stock.quarterlyNetIncomeGrowth != null && stock.quarterlyNetIncomeGrowth > 30)
    strengths.push("Güçlü büyüme trendi");
  if (stock.pe != null && stock.pe < 10) strengths.push("Cazip değerleme");
  if (stock.debtToEquity != null && stock.debtToEquity < 1.5) strengths.push("Düşük borç seviyesi");

  if (stock.roe != null && stock.roe < 12) weaknesses.push("Düşük karlılık");
  if (stock.quarterlyNetIncomeGrowth != null && stock.quarterlyNetIncomeGrowth < 15)
    weaknesses.push("Yavaş büyüme");
  if (stock.pe != null && stock.pe > 15) weaknesses.push("Yüksek değerleme");
  if (stock.debtToEquity != null && stock.debtToEquity > 2) weaknesses.push("Yüksek borç seviyesi");

  const sectorComparison = stock.sectorComparison;
  const hasComparisonValues =
    sectorComparison?.stockPotentialReturn !== null &&
    sectorComparison?.stockPotentialReturn !== undefined &&
    sectorComparison?.sectorAveragePotentialReturn !== null &&
    sectorComparison?.sectorAveragePotentialReturn !== undefined;

  const getBadge = (difference: number | null | undefined) => {
    if (difference === null || difference === undefined) return { label: "Veri Sınırlı", cls: "bg-slate-500/20 text-slate-300 border border-slate-500/30" };
    if (difference > 3) return { label: "Sektör Üstü", cls: "bg-green-500/20 text-green-300 border border-green-500/30" };
    if (difference < -3) return { label: "Sektör Altı", cls: "bg-red-500/20 text-red-300 border border-red-500/30" };
    return { label: "Sektöre Paralel", cls: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30" };
  };

  const comparisonBadge = getBadge(sectorComparison?.differenceFromSector);

  const comparisonChartData = hasComparisonValues
    ? [
        { name: stock.code, getiri: Number(sectorComparison?.stockPotentialReturn ?? 0) },
        { name: "Sektör Ort.", getiri: Number(sectorComparison?.sectorAveragePotentialReturn ?? 0) },
      ]
    : [];

  const formatPct = (value: number | null | undefined) =>
    value === null || value === undefined ? "-" : `%${value.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

  const interpretationText = (() => {
    if (!hasComparisonValues) {
      return "Sektörel karşılaştırma verisi bu rapor dönemi için bulunamadı.";
    }

    const diff = Number(sectorComparison?.differenceFromSector ?? 0);
    const sectorName = sectorComparison?.stockSector ?? stock.sector;
    if (diff > 0.5) {
      return `${stock.code} hissesinin potansiyel getirisi, ${sectorName} sektörü ortalamasının üzerinde seyrediyor. Bu görünüm, hisse tarafında görece daha güçlü bir beklentiye işaret ediyor.`;
    }
    if (diff < -0.5) {
      return `${stock.code} hissesinin potansiyel getirisi, ${sectorName} sektörü ortalamasının gerisinde kalıyor. Karşılaştırmalı olarak sektöre göre daha temkinli bir beklenti öne çıkıyor.`;
    }
    return `${stock.code} hissesinin potansiyel getirisi, ${sectorName} sektörü ortalamasına yakın bir görünüm sergiliyor. Hisse-sektör dengesi açısından paralel bir fiyatlama beklentisi izleniyor.`;
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#0f1538] to-[#1a1f4e] pt-24 pb-12">
      <div className="absolute inset-0" style={{
        backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.03) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(6, 182, 212, 0.03) 1px, transparent 1px)`,
        backgroundSize: '50px 50px'
      }}></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={() => onNavigate("stocks")}
          className="mb-6 flex items-center gap-2 text-gray-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Geri Dön
        </button>

        {/* Header */}
        <div className="mb-8 p-8 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/30">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="bg-gradient-to-r from-cyan-200 to-blue-300 bg-clip-text text-transparent">
                  {stock.code}
                </h1>
                <div className={`px-4 py-2 rounded-lg ${
                  stock.recommendation === "AL" 
                    ? "bg-green-500/20 text-green-300 border border-green-500/30" 
                    : stock.recommendation === "TUT"
                    ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                    : "bg-red-500/20 text-red-300 border border-red-500/30"
                }`}>
                  {stock.recommendation}
                </div>
              </div>
              <h3 className="text-gray-300 mb-2">{stock.name}</h3>
              <div className="text-gray-400">{stock.sector}</div>
              {(stock.donem || stock.tarih) && (
                <div className="text-cyan-400/80 text-sm mt-2">
                  Seçili kayıt: {stock.donem ?? "-"}
                  {(stock.donem && stock.tarih) ? " · " : ""}
                  {stock.tarih ?? ""}
                  {stock.recordId != null ? ` (id ${stock.recordId})` : ""}
                </div>
              )}
            </div>

            <div className="flex items-center gap-8">
              <div>
                <div className="text-gray-400 mb-2">Güncel Fiyat</div>
                <div className="text-white">₺{stock.price.toFixed(2)}</div>
                <div className={stock.change >= 0 ? "text-green-400" : "text-red-400"}>
                  {stock.change >= 0 ? "+" : ""}{stock.change.toFixed(2)}%
                </div>
              </div>

              <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-2xl shadow-cyan-500/40">
                <div className="text-center">
                  <div className="text-white mb-1">{stock.score}</div>
                  <div className="text-cyan-100">Puan</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 p-4 rounded-2xl bg-white/5 border border-cyan-500/25">
          <div className="flex items-center gap-2 text-cyan-200 mb-3">
            <History className="w-5 h-5 shrink-0" />
            <span className="text-sm md:text-base">Dönem / geçmiş kayıtları</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => setSelectedRecordId(null)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                selectedRecordId === null
                  ? "bg-cyan-500/25 border-cyan-400/50 text-cyan-100"
                  : "border-cyan-500/25 text-gray-400 hover:border-cyan-400/40"
              }`}
            >
              Navbar ile hizalı: {ctxDonem ? ctxDonem : "Güncel"}
            </button>
            {historyChips.map((h) => {
              const lbl = [h.donem, h.tarih].filter(Boolean).join(" · ") || `#${h.id}`;
              const active = selectedRecordId === h.id;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setSelectedRecordId(h.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                    active
                      ? "bg-purple-500/25 border-purple-400/50 text-purple-100"
                      : "border-purple-500/20 text-gray-400 hover:border-purple-400/35"
                  }`}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
          {historySeries.length > 1 ? (
            <div className="space-y-6">
              <div>
                <h4 className="text-gray-300 text-sm mb-2">Çarpanlar (dönemler)</h4>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={historySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                    <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} interval={0} angle={-20} height={54} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} width={42} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f1538", border: "1px solid #06b6d4", borderRadius: "8px" }}
                      formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(2) : "-")}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="fk" name="F/K" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    <Line type="monotone" dataKey="pdDd" name="PD/DD" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h4 className="text-gray-300 text-sm mb-2">Marjlar ve piyasa değeri (TL)</h4>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={historySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                    <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} interval={0} angle={-20} height={54} />
                    <YAxis yAxisId="l" tick={{ fill: "#94a3b8", fontSize: 10 }} width={40} />
                    <YAxis yAxisId="r" orientation="right" tick={{ fill: "#94a3b8", fontSize: 10 }} width={48} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f1538", border: "1px solid #06b6d4", borderRadius: "8px" }}
                      formatter={(value: unknown) =>
                        typeof value === "number" ? value.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : "-"
                      }
                    />
                    <Legend />
                    <Line
                      yAxisId="l"
                      type="monotone"
                      dataKey="netKarMarji"
                      name="Net kar marjı %"
                      stroke="#34d399"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                    <Line
                      yAxisId="l"
                      type="monotone"
                      dataKey="favokMarji"
                      name="FAVÖK marjı %"
                      stroke="#fbbf24"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                    <Line
                      yAxisId="r"
                      type="monotone"
                      dataKey="piyasaDegeriTl"
                      name="Piyasa değeri TL"
                      stroke="#f472b6"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Birden fazla döneme ait kayıt bulununca zaman serisi grafikleri burada görünür.</p>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Left Column - Financial Metrics */}
          <div className="lg:col-span-2 space-y-6">
            {/* Valuation Metrics */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-blue-600/5 border border-cyan-500/20">
              <h3 className="mb-4 text-cyan-300">Değerleme Metrikleri</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                  <div className="text-gray-400 mb-2">F/K Oranı</div>
                  <div className="text-white">{fmtFin(stock.pe, { digits: 2 })}</div>
                  <div className="text-cyan-400 mt-1">Price/Earnings</div>
                </div>
                <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                  <div className="text-gray-400 mb-2">PEG Oranı</div>
                  <div className="text-white">{fmtFin(stock.peg, { digits: 2 })}</div>
                  <div className="text-cyan-400 mt-1">P/E to Growth</div>
                </div>
                <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                  <div className="text-gray-400 mb-2">PD/DD Oranı</div>
                  <div className="text-white">{fmtFin(stock.pb, { digits: 2 })}</div>
                  <div className="text-cyan-400 mt-1">Price to Book</div>
                </div>
              </div>
            </div>

            {/* Profitability */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-blue-600/5 border border-cyan-500/20">
              <h3 className="mb-4 text-cyan-300">Karlılık Metrikleri</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="text-gray-400 mb-2">ROE</div>
                  <div className="text-white">{fmtFinPct(stock.roe)}</div>
                  <div className="text-green-400 mt-1">Özkaynak Karlılığı</div>
                </div>
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="text-gray-400 mb-2">ROA</div>
                  <div className="text-white">{fmtFinPct(stock.roa)}</div>
                  <div className="text-green-400 mt-1">Aktif Karlılığı</div>
                </div>
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="text-gray-400 mb-2">FAVÖK Marjı</div>
                  <div className="text-white">{fmtFinPct(stock.ebitdaMargin)}</div>
                  <div className="text-green-400 mt-1">EBITDA Margin</div>
                </div>
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="text-gray-400 mb-2">Net kar marjı</div>
                  <div className="text-white">{fmtFinPct(stock.netProfitMargin ?? null)}</div>
                  <div className="text-green-400 mt-1">Net margin</div>
                </div>
              </div>
            </div>

            {/* Growth & Liquidity */}
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-indigo-600/10 border border-purple-500/20">
                <h3 className="mb-4 text-purple-300">Büyüme</h3>
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <div className="text-gray-400 mb-2">Çeyreklik Net Kâr Büyümesi</div>
                  <div className="text-white">{fmtFinPct(stock.quarterlyNetIncomeGrowth)}</div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-gradient-to-br from-orange-500/10 to-amber-600/10 border border-orange-500/20">
                <h3 className="mb-4 text-orange-300">Likidite & Borç</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cari Oran</span>
                    <span className="text-white">{fmtFin(stock.currentRatio, { digits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Borç/Özkaynak</span>
                    <span className="text-white">{fmtFin(stock.debtToEquity, { digits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Nakit Oranı</span>
                    <span className="text-white">{fmtFin(stock.cashRatio, { digits: 2 })}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sectoral Comparison Chart */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-blue-600/5 border border-cyan-500/20">
              <h3 className="mb-4 text-cyan-300">Sektörel Karşılaştırma - {stock.sector}</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="mb-4 text-gray-300">Puan Karşılaştırması</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                      <XAxis dataKey="name" stroke="#6ee7b7" />
                      <YAxis stroke="#6ee7b7" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f1538",
                          border: "1px solid #06b6d4",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="score" fill="#06b6d4" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h4 className="mb-4 text-gray-300">Sektör İçi Sıralama</h4>
                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                    {[...sectorStocks]
                      .sort((a, b) => b.score - a.score)
                      .map((s, i) => (
                        <div
                          key={s.code}
                          className={`p-3 rounded-lg ${
                            s.code === stock.code
                              ? "bg-cyan-500/20 border border-cyan-500/40"
                              : "bg-white/5 border border-cyan-500/10"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  s.code === stock.code
                                    ? "bg-cyan-500/30 text-cyan-300"
                                    : "bg-white/10 text-gray-400"
                                }`}
                              >
                                #{i + 1}
                              </div>
                              <span className={s.code === stock.code ? "text-cyan-300" : "text-gray-300"}>
                                {s.code}
                              </span>
                            </div>
                            <div className={s.code === stock.code ? "text-cyan-300" : "text-white"}>
                              {s.score}/100
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Score & Recommendation */}
          <div className="space-y-6">
            {/* Investment Score */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/30">
              <div className="flex items-center gap-2 mb-4">
                <Award className="w-5 h-5 text-cyan-400" />
                <h3 className="text-cyan-300">Yatırım Puanı</h3>
              </div>
              
              <div className="mb-6">
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#1e3a5f" />
                    <PolarAngleAxis dataKey="metric" stroke="#6ee7b7" />
                    <PolarRadiusAxis stroke="#6ee7b7" />
                    <Radar 
                      name="Puan" 
                      dataKey="value" 
                      stroke="#06b6d4" 
                      fill="#06b6d4" 
                      fillOpacity={0.6} 
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                {scoreBreakdown.map(item => (
                  <div key={item.category}>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-400">{item.category}</span>
                      <span className="text-cyan-300">{item.score}/{item.max}</span>
                    </div>
                    <div className="h-2 bg-cyan-500/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-400 to-blue-600 rounded-full"
                        style={{ width: `${(item.score / item.max) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Strengths */}
            {strengths.length > 0 && (
              <div className="p-6 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-600/10 border border-green-500/20">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-green-400" />
                  <h3 className="text-green-300">Güçlü Yönler</h3>
                </div>
                <ul className="space-y-2">
                  {strengths.map((strength, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <TrendingUp className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />
                      <span className="text-gray-300">{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Weaknesses */}
            {weaknesses.length > 0 && (
              <div className="p-6 rounded-2xl bg-gradient-to-br from-red-500/10 to-rose-600/10 border border-red-500/20">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-red-400" />
                  <h3 className="text-red-300">Zayıf Yönler</h3>
                </div>
                <ul className="space-y-2">
                  {weaknesses.map((weakness, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-4 h-4 text-red-400 mt-1 flex-shrink-0">⚠</span>
                      <span className="text-gray-300">{weakness}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Investment Recommendation */}
            <div className={`p-6 rounded-2xl border ${
              stock.recommendation === "AL"
                ? "bg-gradient-to-br from-green-500/10 to-emerald-600/10 border-green-500/30"
                : stock.recommendation === "TUT"
                ? "bg-gradient-to-br from-yellow-500/10 to-orange-600/10 border-yellow-500/30"
                : "bg-gradient-to-br from-red-500/10 to-rose-600/10 border-red-500/30"
            }`}>
              <h3 className={
                stock.recommendation === "AL" ? "text-green-300 mb-4" :
                stock.recommendation === "TUT" ? "text-yellow-300 mb-4" :
                "text-red-300 mb-4"
              }>
                Yatırım Önerisi: {stock.recommendation}
              </h3>
              
              <div className="space-y-3">
                <div>
                  <div className="text-gray-400 mb-1">Hedef Fiyat</div>
                  <div className="text-white">₺{stock.targetPrice.toFixed(2)}</div>
                  <div className={stock.targetPrice > stock.price ? "text-green-400" : "text-red-400"}>
                    {((stock.targetPrice - stock.price) / stock.price * 100).toFixed(1)}% potansiyel
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-700">
                  <div className="text-gray-300">
                    {stock.recommendation === "AL" && 
                      "Güçlü finansal göstergeler ve büyüme potansiyeli ile alım fırsatı sunuyor."
                    }
                    {stock.recommendation === "TUT" && 
                      "Mevcut seviyede tutmak uygun. Gelişmeleri takip edin."
                    }
                    {stock.recommendation === "SAT" && 
                      "Zayıf performans ve yüksek risk göstergeleri nedeniyle pozisyon azaltılabilir."
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 p-6 rounded-2xl bg-gradient-to-br from-cyan-500/8 to-blue-600/10 border border-cyan-500/30">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
            <div>
              <h3 className="text-cyan-300 mb-2">Sektörel Getiri Ortalaması Karşılaştırması</h3>
              <p className="text-gray-400">
                Bu bölümde hissenin potansiyel getirisi ile sektör ortalaması aynı rapor dönemi içinde karşılaştırılır.
              </p>
            </div>
            <div className={`px-3 py-2 rounded-lg ${comparisonBadge.cls}`}>
              {comparisonBadge.label}
            </div>
          </div>

          {hasComparisonValues ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-4 rounded-xl bg-white/5 border border-cyan-500/20">
                <h4 className="text-gray-300 mb-3">Getiri Karşılaştırma Grafiği</h4>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={comparisonChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                    <XAxis dataKey="name" stroke="#6ee7b7" />
                    <YAxis stroke="#6ee7b7" />
                    <Tooltip
                      formatter={(value: number) => [`%${value.toFixed(1)}`, "Potansiyel Getiri"]}
                      contentStyle={{
                        backgroundColor: "#0f1538",
                        border: "1px solid #06b6d4",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="getiri" radius={[8, 8, 0, 0]}>
                      {comparisonChartData.map((item) => (
                        <Cell key={item.name} fill={item.name === stock.code ? "#06b6d4" : "#8b5cf6"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
                  <div className="text-gray-400 mb-1">Hisse Potansiyel Getirisi</div>
                  <div className="text-cyan-300">{formatPct(sectorComparison?.stockPotentialReturn)}</div>
                </div>
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                  <div className="text-gray-400 mb-1">Sektör Ortalama Potansiyel Getirisi</div>
                  <div className="text-purple-300">{formatPct(sectorComparison?.sectorAveragePotentialReturn)}</div>
                </div>
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <div className="text-gray-400 mb-1">Fark</div>
                  <div
                    className={
                      Number(sectorComparison?.differenceFromSector ?? 0) >= 0 ? "text-green-300" : "text-red-300"
                    }
                  >
                    {sectorComparison?.differenceFromSector === null || sectorComparison?.differenceFromSector === undefined
                      ? "-"
                      : `${sectorComparison.differenceFromSector >= 0 ? "+" : ""}${sectorComparison.differenceFromSector.toLocaleString("tr-TR", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })} puan`}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-200">
              Sektörel karşılaştırma verisi bu rapor dönemi için bulunamadı.
            </div>
          )}

          <div className="mt-5 p-4 rounded-xl bg-white/5 border border-cyan-500/20 text-gray-300">
            {interpretationText}
            {sectorComparison?.reportId !== null && sectorComparison?.reportId !== undefined && (
              <span className="text-gray-400"> (Rapor ID: {sectorComparison.reportId})</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useFinancialPeriod } from "../contexts/FinancialPeriodContext";
import { getSectors, getStocks } from "../api/client";
import { SectorSummary, Stock } from "../data/stocks";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { fmtFinPct } from "../utils/formatFinancial";

interface SectoralPageProps {
  onNavigate: (page: string) => void;
}

export function SectoralPage({ onNavigate }: SectoralPageProps) {
  const [selectedSector, setSelectedSector] = useState("");
  const [sectors, setSectors] = useState<SectorSummary[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { donem } = useFinancialPeriod();

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getSectors(donem), getStocks(donem)])
      .then(([sectorData, stockData]) => {
        if (!active) return;
        setSectors(sectorData);
        setStocks(stockData);
        setSelectedSector(sectorData[0]?.sector ?? "");
        setError("");
      })
      .catch(() => {
        if (!active) return;
        setError("Sektörel veriler yüklenemedi.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [donem]);

  const sectorData = useMemo(
    () =>
      sectors.map((sector) => ({
        sector: sector.sector,
        avgScore: sector.avgScore,
        count: sector.count,
      })),
    [sectors],
  );

  const selectedStocks = useMemo(
    () => stocks.filter((s) => s.sector === selectedSector).sort((a, b) => b.score - a.score),
    [selectedSector, stocks],
  );

  const selectedAverage = useMemo(
    () => sectors.find((s) => s.sector === selectedSector)?.avgScore ?? 0,
    [selectedSector, sectors],
  );

  const BAR_GRADIENTS = [
    { id: "secBar0", stops: ["#5ef8ff", "#22d3ee", "#0891b2"] },
    { id: "secBar1", stops: ["#93c5fd", "#3a86ff", "#1d4ed8"] },
    { id: "secBar2", stops: ["#e9d5ff", "#c084fc", "#7c3aed"] },
    { id: "secBar3", stops: ["#fda4d7", "#f857a6", "#be185d"] },
    { id: "secBar4", stops: ["#fcd34d", "#fb923c", "#c2410c"] },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#0f1538] to-[#1a1f4e] pt-24 pb-12">
      <div className="absolute inset-0" style={{
        backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.03) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(6, 182, 212, 0.03) 1px, transparent 1px)`,
        backgroundSize: '50px 50px'
      }}></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-4 bg-gradient-to-r from-cyan-200 to-blue-300 bg-clip-text text-transparent">
            Sektörel Analizler
          </h1>
          <p className="text-gray-400">
            Sektörlere göre hisse karşılaştırmaları ve performans analizi
          </p>
        </div>

        {/* Sector Overview Chart */}
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-blue-500/8 to-violet-500/10 border border-cyan-400/25 shadow-[0_0_40px_-16px_rgba(34,211,238,0.2)]">
          <h3 className="mb-6 text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-sky-300 to-violet-200">
            Sektör Ortalama Puanları
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sectorData}>
              <defs>
                {BAR_GRADIENTS.map((g) => (
                  <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={g.stops[0]} stopOpacity={1} />
                    <stop offset="45%" stopColor={g.stops[1]} stopOpacity={1} />
                    <stop offset="100%" stopColor={g.stops[2]} stopOpacity={0.95} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(34, 211, 238, 0.12)" vertical={false} />
              <XAxis
                dataKey="sector"
                stroke="#7dd3fc"
                tick={{ fill: "#bae6fd", fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis stroke="#7dd3fc" tick={{ fill: "#bae6fd", fontSize: 11 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  background:
                    "linear-gradient(165deg, rgba(8,12,28,0.98) 0%, rgba(15,21,42,0.98) 100%)",
                  border: "1px solid rgba(56,232,255,0.35)",
                  borderRadius: "10px",
                  boxShadow: "0 12px 40px rgba(0,0,0,0.5), 0 0 24px rgba(34,211,238,0.12)",
                  color: "#f0fdfa",
                }}
                labelStyle={{ color: "#a5f3fc" }}
              />
              <Bar dataKey="avgScore" radius={[10, 10, 4, 4]}>
                {sectorData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={`url(#${BAR_GRADIENTS[index % BAR_GRADIENTS.length].id})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sector Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {sectorData.map((sector) => (
            <button
              key={sector.sector}
              onClick={() => setSelectedSector(sector.sector)}
              className={`p-6 rounded-2xl border transition-all text-left ${
                selectedSector === sector.sector
                  ? "bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border-cyan-500/50 shadow-xl shadow-cyan-500/20"
                  : "bg-gradient-to-br from-cyan-500/5 to-blue-600/5 border-cyan-500/20 hover:border-cyan-500/40"
              }`}
            >
              <h3 className="mb-3 text-cyan-300">{sector.sector}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-gray-400 mb-1">Ortalama Puan</div>
                  <div className="text-white">{sector.avgScore}/100</div>
                </div>
                <div>
                  <div className="text-gray-400 mb-1">Hisse Sayısı</div>
                  <div className="text-white">{sector.count}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {loading && <div className="text-center text-gray-400 py-8">Sektör verileri yükleniyor...</div>}
        {error && <div className="text-center text-red-400 py-8">{error}</div>}

        {/* Selected Sector Detail */}
        {!loading && !error && selectedSector && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/30">
              <h2 className="mb-6 text-cyan-300">{selectedSector} - Detaylı Analiz</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                  <div className="text-gray-400 mb-2">Sektör Ortalaması</div>
                  <div className="text-white">{selectedAverage}/100</div>
                </div>
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="text-gray-400 mb-2">En Yüksek</div>
                  <div className="text-white">{selectedStocks[0]?.score || 0}/100</div>
                  <div className="text-green-400 mt-1">{selectedStocks[0]?.code}</div>
                </div>
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="text-gray-400 mb-2">En Düşük</div>
                  <div className="text-white">{selectedStocks[selectedStocks.length - 1]?.score || 0}/100</div>
                  <div className="text-red-400 mt-1">{selectedStocks[selectedStocks.length - 1]?.code}</div>
                </div>
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <div className="text-gray-400 mb-2">AL Tavsiyesi</div>
                  <div className="text-white">
                    {selectedStocks.filter(s => s.recommendation === "AL").length}
                  </div>
                  <div className="text-purple-400 mt-1">Hisse</div>
                </div>
              </div>

              {/* Heatmap */}
              <div className="mb-6">
                <h4 className="mb-4 text-gray-300">Performans Haritası</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {selectedStocks.map(stock => {
                    const scoreColor = 
                      stock.score >= 80 ? "from-green-400 to-emerald-500" :
                      stock.score >= 70 ? "from-cyan-400 to-blue-500" :
                      stock.score >= 60 ? "from-yellow-400 to-orange-500" :
                      "from-red-400 to-rose-500";

                    return (
                      <button
                        key={stock.code}
                        onClick={() => onNavigate(`stock-${stock.code}`)}
                        className={`p-4 rounded-xl bg-gradient-to-br ${scoreColor} hover:scale-105 transition-transform shadow-lg`}
                      >
                        <div className="text-white mb-2">{stock.code}</div>
                        <div className="text-white">{stock.score}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stock List */}
              <div>
                <h4 className="mb-4 text-gray-300">Sektör İçi Sıralama</h4>
                <div className="space-y-3">
                  {selectedStocks.map((stock, i) => (
                    <button
                      key={stock.code}
                      onClick={() => onNavigate(`stock-${stock.code}`)}
                      className="w-full p-4 rounded-xl bg-white/5 border border-cyan-500/20 hover:border-cyan-500/50 hover:bg-cyan-500/10 transition-all text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                            <span className="text-white">#{i + 1}</span>
                          </div>
                          <div>
                            <div className="text-cyan-300 mb-1">{stock.code}</div>
                            <div className="text-gray-400">{stock.name}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <div className="text-gray-400 mb-1">Puan</div>
                            <div className="text-white">{stock.score}/100</div>
                          </div>

                          <div className="text-right">
                            <div className="text-gray-400 mb-1">ROE</div>
                            <div className="text-white">{fmtFinPct(stock.roe)}</div>
                          </div>

                          <div className="text-right">
                            <div className="text-gray-400 mb-1">Büyüme</div>
                            <div className={stock.quarterlyNetIncomeGrowth > 0 ? "text-green-400" : "text-red-400"}>
                              {stock.quarterlyNetIncomeGrowth > 0 && "+"}
                              {stock.quarterlyNetIncomeGrowth.toFixed(1)}%
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-gray-400 mb-1">Fiyat</div>
                            <div className="text-white">₺{stock.price.toFixed(2)}</div>
                          </div>

                          <div className={`px-3 py-1 rounded-lg ${
                            stock.recommendation === "AL" 
                              ? "bg-green-500/20 text-green-300 border border-green-500/30" 
                              : stock.recommendation === "TUT"
                              ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                              : "bg-red-500/20 text-red-300 border border-red-500/30"
                          }`}>
                            {stock.recommendation}
                          </div>

                          {stock.change >= 0 ? (
                            <TrendingUp className="w-5 h-5 text-green-400" />
                          ) : (
                            <TrendingDown className="w-5 h-5 text-red-400" />
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { getStocks } from "../api/client";
import { Stock } from "../data/stocks";
import { StockCard } from "./StockCard";
import { Filter } from "lucide-react";
import { useFinancialPeriod } from "../contexts/FinancialPeriodContext";

interface StocksPageProps {
  onNavigate: (page: string) => void;
}

export function StocksPage({ onNavigate }: StocksPageProps) {
  const [selectedSector, setSelectedSector] = useState<string>("all");
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { donem } = useFinancialPeriod();

  useEffect(() => {
    let active = true;
    setLoading(true);
    getStocks(donem)
      .then((data) => {
        if (!active) return;
        setStocks(data);
        setError("");
      })
      .catch(() => {
        if (!active) return;
        setError("Veriler yüklenemedi. Lütfen backend servisini kontrol edin.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [donem]);

  const sectors = useMemo(
    () =>
      Array.from(new Set(stocks.map((s) => s.sector)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "tr")),
    [stocks],
  );

  const filteredStocks =
    selectedSector === "all"
      ? stocks
      : stocks.filter((stock) => stock.sector === selectedSector);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#0f1538] to-[#1a1f4e] pt-24 pb-12">
      <div className="absolute inset-0" style={{
        backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.03) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(6, 182, 212, 0.03) 1px, transparent 1px)`,
        backgroundSize: '50px 50px'
      }}></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
          <h1 className="mb-4 bg-gradient-to-r from-cyan-200 to-blue-300 bg-clip-text text-transparent">
            BIST-30 Hisseleri
          </h1>
          <p className="text-gray-400">
            Tüm BIST-30 şirketlerinin finansal analizi ve yatırım skorları
          </p>
          </div>
          <div className="text-sm text-gray-500">
            Gösterilen:{" "}
            <span className="text-cyan-300">{donem ? `Dönem ${donem}` : "Şirket başına güncel dönem"}</span>
          </div>
        </div>

        {/* Sector Filter */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-cyan-400" />
            <span className="text-gray-300">Sektör Filtresi</span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedSector("all")}
              className={`px-4 py-2 rounded-lg transition-all ${
                selectedSector === "all"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/20"
                  : "bg-white/5 text-gray-400 border border-cyan-500/20 hover:border-cyan-500/40 hover:text-cyan-300"
              }`}
            >
              Tümü ({stocks.length})
            </button>
            
            {sectors.map((sector) => {
              const count = stocks.filter((s) => s.sector === sector).length;
              if (count === 0) return null;
              
              return (
                <button
                  key={sector}
                  onClick={() => setSelectedSector(sector)}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    selectedSector === sector
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/20"
                      : "bg-white/5 text-gray-400 border border-cyan-500/20 hover:border-cyan-500/40 hover:text-cyan-300"
                  }`}
                >
                  {sector} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-600/10 border border-green-500/20">
            <div className="text-gray-400 mb-1">AL Tavsiyesi</div>
            <div className="text-green-300">
              {filteredStocks.filter(s => s.recommendation === "AL").length} Hisse
            </div>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-600/10 border border-yellow-500/20">
            <div className="text-gray-400 mb-1">TUT Tavsiyesi</div>
            <div className="text-yellow-300">
              {filteredStocks.filter(s => s.recommendation === "TUT").length} Hisse
            </div>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-rose-600/10 border border-red-500/20">
            <div className="text-gray-400 mb-1">SAT Tavsiyesi</div>
            <div className="text-red-300">
              {filteredStocks.filter(s => s.recommendation === "SAT").length} Hisse
            </div>
          </div>
        </div>

        {/* Stock Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStocks.map((stock) => (
            <StockCard
              key={stock.code}
              stock={stock}
              onClick={() => onNavigate(`stock-${stock.code}`)}
            />
          ))}
        </div>

        {loading && (
          <div className="text-center py-12 text-gray-400">Hisseler yükleniyor...</div>
        )}

        {error && <div className="text-center py-12 text-red-400">{error}</div>}

        {!loading && !error && filteredStocks.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            Bu sektörde hisse bulunamadı.
          </div>
        )}
      </div>
    </div>
  );
}

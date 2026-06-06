import { useEffect, useMemo, useState } from "react";
import { ArrowRight, TrendingUp, Award, BarChart } from "lucide-react";
import { getStocks } from "../api/client";
import { Stock } from "../data/stocks";

import { useFinancialPeriod } from "../contexts/FinancialPeriodContext";

interface HeroProps {
  onNavigate: (page: string) => void;
}

export function Hero({ onNavigate }: HeroProps) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const { donem } = useFinancialPeriod();

  useEffect(() => {
    let active = true;
    getStocks(donem)
      .then((data) => {
        if (active) setStocks(data);
      })
      .catch(() => {
        if (active) setStocks([]);
      });
    return () => {
      active = false;
    };
  }, [donem]);

  const avgScore = useMemo(() => {
    if (stocks.length === 0) return 0;
    const total = stocks.reduce((sum, stock) => sum + stock.score, 0);
    return Math.round(total / stocks.length);
  }, [stocks]);

  const topStocks = useMemo(
    () => [...stocks].sort((a, b) => b.score - a.score).slice(0, 3),
    [stocks],
  );

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0e27] via-[#0f1538] to-[#1a1f4e]">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.03) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(6, 182, 212, 0.03) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}></div>
      </div>

      {/* Glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Main Hero Content */}
        <div className="text-center mb-16">
          <div className="inline-block mb-6">
            <div className="px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 backdrop-blur-sm">
              <span className="text-cyan-300">BIST-30 Analiz Platformu</span>
            </div>
          </div>
          
          <h1 className="mb-6 bg-gradient-to-r from-cyan-200 via-blue-200 to-cyan-300 bg-clip-text text-transparent">
            Yüzde Yüz Yatırım
          </h1>
          
          <p className="max-w-2xl mx-auto mb-3 text-gray-300">
            Veriye dayalı, objektif yatırım analiz platformu
          </p>
          
          <p className="max-w-xl mx-auto mb-8 text-cyan-300/70">
            Finansal tablolar konuşur, algoritma karar verir.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={() => onNavigate("stocks")}
              className="group px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl hover:shadow-2xl hover:shadow-cyan-500/50 transition-all flex items-center gap-2"
            >
              Platformu Keşfet
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => onNavigate("calculator")}
              className="px-8 py-3 bg-white/5 border border-cyan-500/30 rounded-xl hover:bg-white/10 transition-all backdrop-blur-sm"
            >
              Demo Gör
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Average Score */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/20 backdrop-blur-sm hover:border-cyan-500/40 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <BarChart className="w-5 h-5 text-cyan-400" />
              </div>
              <span className="text-gray-300">BIST-30 Ortalama</span>
            </div>
            <div className="text-cyan-300 mt-2">{avgScore}/100</div>
            <div className="text-gray-400 mt-1">Genel Puan</div>
          </div>

          {/* Market Direction */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-600/10 border border-green-500/20 backdrop-blur-sm hover:border-green-500/40 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-gray-300">Piyasa Yönü</span>
            </div>
            <div className="text-green-300 mt-2">Pozitif</div>
            <div className="text-gray-400 mt-1">Genel Trend</div>
          </div>

          {/* Top Performers */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-indigo-600/10 border border-purple-500/20 backdrop-blur-sm hover:border-purple-500/40 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Award className="w-5 h-5 text-purple-400" />
              </div>
              <span className="text-gray-300">En Yüksek AL Sayısı</span>
            </div>
            <div className="text-purple-300 mt-2">
              {topStocks.filter((s) => s.recommendation === "AL").length} Hisse
            </div>
            <div className="text-gray-400 mt-1">AL Tavsiyesi</div>
          </div>
        </div>

        {/* Top 3 Stocks */}
        <div>
          <h3 className="text-center mb-6 text-gray-300">En Yüksek Puanlı Hisseler</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {topStocks.map((stock, index) => (
              <button
                key={stock.code}
                onClick={() => onNavigate(`stock-${stock.code}`)}
                className="group p-6 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-blue-600/5 border border-cyan-500/20 backdrop-blur-sm hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/20 transition-all text-left"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                      <span className="text-white">#{index + 1}</span>
                    </div>
                    <div>
                      <div className="text-cyan-300">{stock.code}</div>
                      <div className="text-gray-500">{stock.name}</div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-gray-400 mb-1">Yatırım Puanı</div>
                    <div className="text-cyan-300">{stock.score}/100</div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-400 mb-1">Fiyat</div>
                    <div className="text-white">₺{stock.price.toFixed(2)}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className={`px-3 py-1 rounded-lg ${
                    stock.recommendation === "AL" 
                      ? "bg-green-500/20 text-green-300" 
                      : stock.recommendation === "TUT"
                      ? "bg-yellow-500/20 text-yellow-300"
                      : "bg-red-500/20 text-red-300"
                  }`}>
                    {stock.recommendation}
                  </div>
                  <div className={stock.change >= 0 ? "text-green-400" : "text-red-400"}>
                    {stock.change >= 0 ? "+" : ""}{stock.change.toFixed(2)}%
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

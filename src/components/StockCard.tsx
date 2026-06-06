import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { Stock } from "../data/stocks";
import { fmtFin, fmtFinPct } from "../utils/formatFinancial";

interface StockCardProps {
  stock: Stock;
  onClick: () => void;
}

export function StockCard({ stock, onClick }: StockCardProps) {
  const scoreColor = 
    stock.score >= 80 ? "from-green-400 to-emerald-500" :
    stock.score >= 70 ? "from-cyan-400 to-blue-500" :
    stock.score >= 60 ? "from-yellow-400 to-orange-500" :
    "from-red-400 to-rose-500";

  const scoreGlow = 
    stock.score >= 80 ? "shadow-green-500/30" :
    stock.score >= 70 ? "shadow-cyan-500/30" :
    stock.score >= 60 ? "shadow-yellow-500/30" :
    "shadow-red-500/30";

  const hist = stock.priceHistory;
  const maxPrice = hist.length ? Math.max(...hist) : 0;
  const minPrice = hist.length ? Math.min(...hist) : 0;
  const span = maxPrice - minPrice;

  return (
    <button
      onClick={onClick}
      className="group p-6 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-blue-600/5 border border-cyan-500/20 backdrop-blur-sm hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/20 transition-all text-left w-full"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-cyan-300 mb-1">{stock.code}</div>
          <div className="text-gray-400">{stock.name}</div>
          <div className="text-gray-500 mt-1">{stock.sector}</div>
          {(stock.donem || stock.tarih) && (
            <div className="text-gray-600 text-xs mt-1">
              {stock.donem ? `${stock.donem}` : ""}
              {stock.donem && stock.tarih ? " · " : ""}
              {stock.tarih ?? ""}
            </div>
          )}
        </div>
        <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
      </div>

      {/* Score */}
      <div className="mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${scoreColor} flex items-center justify-center shadow-lg ${scoreGlow}`}>
            <span className="text-white">{stock.score}</span>
          </div>
          <div>
            <div className="text-gray-400 mb-1">Yatırım Puanı</div>
            <div className="text-cyan-300">0-100 Skalası</div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-cyan-500/10">
        <div>
          <div className="text-gray-500 mb-1">F/K</div>
          <div className="text-white">{fmtFin(stock.pe, { digits: 1 })}</div>
        </div>
        <div>
          <div className="text-gray-500 mb-1">ROE</div>
          <div className="text-white">{fmtFinPct(stock.roe)}</div>
        </div>
        <div>
          <div className="text-gray-500 mb-1">Büyüme</div>
          <div className="text-white">{fmtFinPct(stock.quarterlyNetIncomeGrowth, 0)}</div>
        </div>
      </div>

      {/* Mini Trend */}
      <div className="mb-4">
        <div className="flex items-end gap-1 h-12">
          {hist.slice(-7).map((price, i) => {
            const normalizedHeight =
              hist.length === 0 || span === 0 ? 50 : Math.max(8, Math.min(100, ((price - minPrice) / span) * 100));
            
            return (
              <div
                key={i}
                className="flex-1 bg-gradient-to-t from-cyan-500/50 to-cyan-400/70 rounded-t"
                style={{ height: `${normalizedHeight}%` }}
              ></div>
            );
          })}
        </div>
      </div>

      {/* Bottom Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-white">₺{stock.price.toFixed(2)}</div>
          <div className={`flex items-center gap-1 ${stock.change >= 0 ? "text-green-400" : "text-red-400"}`}>
            {stock.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span>{Math.abs(stock.change).toFixed(2)}%</span>
          </div>
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
      </div>
    </button>
  );
}

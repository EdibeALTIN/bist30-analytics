import { useState } from "react";
import { Calculator, TrendingUp, Award, AlertCircle } from "lucide-react";
import { calculateScore } from "../api/client";
import { Recommendation, ScoreResult } from "../data/stocks";

export function CalculatorPage() {
  const [metrics, setMetrics] = useState({
    pe: "",
    peg: "",
    pb: "",
    roe: "",
    roa: "",
    ebitdaMargin: "",
    quarterlyNetIncomeGrowth: "",
    currentRatio: "",
    debtToEquity: "",
    cashRatio: ""
  });

  const [result, setResult] = useState<{
    score: number;
    recommendation: Recommendation;
    missingMetrics: string[];
    rawScore: number;
    categoryScores: Record<string, number | null>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field: string, value: string) => {
    setMetrics(prev => ({ ...prev, [field]: value }));
  };

  const handleCalculate = async () => {
    const numericMetrics = {
      pe: metrics.pe === "" ? undefined : parseFloat(metrics.pe),
      peg: metrics.peg === "" ? undefined : parseFloat(metrics.peg),
      pb: metrics.pb === "" ? undefined : parseFloat(metrics.pb),
      roe: metrics.roe === "" ? undefined : parseFloat(metrics.roe),
      roa: metrics.roa === "" ? undefined : parseFloat(metrics.roa),
      ebitdaMargin: metrics.ebitdaMargin === "" ? undefined : parseFloat(metrics.ebitdaMargin),
      quarterlyNetIncomeGrowth:
        metrics.quarterlyNetIncomeGrowth === "" ? undefined : parseFloat(metrics.quarterlyNetIncomeGrowth),
      currentRatio: metrics.currentRatio === "" ? undefined : parseFloat(metrics.currentRatio),
      debtToEquity: metrics.debtToEquity === "" ? undefined : parseFloat(metrics.debtToEquity),
      cashRatio: metrics.cashRatio === "" ? undefined : parseFloat(metrics.cashRatio)
    };
    setLoading(true);
    setError("");
    try {
      const apiResult: ScoreResult = await calculateScore(numericMetrics);
      setResult({
        score: apiResult.calibratedScore,
        recommendation: apiResult.recommendation,
        missingMetrics: apiResult.missingMetrics,
        rawScore: apiResult.rawScore,
        categoryScores: apiResult.categoryScores
      });
    } catch {
      setError("Hesaplama servisine ulaşılamadı.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMetrics({
      pe: "",
      peg: "",
      pb: "",
      roe: "",
      roa: "",
      ebitdaMargin: "",
      quarterlyNetIncomeGrowth: "",
      currentRatio: "",
      debtToEquity: "",
      cashRatio: ""
    });
    setResult(null);
    setError("");
  };

  const hasAnyMetric = Object.values(metrics).some((v) => v !== "");

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#0f1538] to-[#1a1f4e] pt-24 pb-12">
      <div className="absolute inset-0" style={{
        backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.03) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(6, 182, 212, 0.03) 1px, transparent 1px)`,
        backgroundSize: '50px 50px'
      }}></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-2xl shadow-cyan-500/40 mb-4">
            <Calculator className="w-10 h-10 text-white" />
          </div>
          <h1 className="mb-4 bg-gradient-to-r from-cyan-200 to-blue-300 bg-clip-text text-transparent">
            Manuel Puan Hesaplama
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            BIST-30 dışındaki hisseler için aynı algoritma ile yatırım puanı hesaplayın
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Input Form */}
          <div className="lg:col-span-2">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-blue-600/5 border border-cyan-500/20">
              <h3 className="mb-6 text-cyan-300">Finansal Göstergeler</h3>

              {/* Valuation Metrics */}
              <div className="mb-6">
                <h4 className="mb-4 text-gray-300">Değerleme Metrikleri</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-400 mb-2">F/K Oranı</label>
                    <input
                      type="number"
                      step="0.01"
                      value={metrics.pe}
                      onChange={(e) => handleChange("pe", e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-cyan-500/30 text-white focus:border-cyan-500 focus:outline-none transition-colors"
                      placeholder="Örn: 8.5"
                    />
                    <div className="text-gray-500 mt-1">Price/Earnings</div>
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-2">PEG Oranı</label>
                    <input
                      type="number"
                      step="0.01"
                      value={metrics.peg}
                      onChange={(e) => handleChange("peg", e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-cyan-500/30 text-white focus:border-cyan-500 focus:outline-none transition-colors"
                      placeholder="Örn: 0.9"
                    />
                    <div className="text-gray-500 mt-1">P/E to Growth</div>
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-2">PD/DD Oranı</label>
                    <input
                      type="number"
                      step="0.01"
                      value={metrics.pb}
                      onChange={(e) => handleChange("pb", e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-cyan-500/30 text-white focus:border-cyan-500 focus:outline-none transition-colors"
                      placeholder="Örn: 2.1"
                    />
                    <div className="text-gray-500 mt-1">Price to Book</div>
                  </div>
                </div>
              </div>

              {/* Profitability Metrics */}
              <div className="mb-6 pb-6 border-b border-cyan-500/20">
                <h4 className="mb-4 text-gray-300">Karlılık Metrikleri</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-400 mb-2">ROE (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={metrics.roe}
                      onChange={(e) => handleChange("roe", e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-cyan-500/30 text-white focus:border-cyan-500 focus:outline-none transition-colors"
                      placeholder="Örn: 24.5"
                    />
                    <div className="text-gray-500 mt-1">Özkaynak Karlılığı</div>
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-2">ROA (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={metrics.roa}
                      onChange={(e) => handleChange("roa", e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-cyan-500/30 text-white focus:border-cyan-500 focus:outline-none transition-colors"
                      placeholder="Örn: 8.2"
                    />
                    <div className="text-gray-500 mt-1">Aktif Karlılığı</div>
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-2">FAVÖK Marjı (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={metrics.ebitdaMargin}
                      onChange={(e) => handleChange("ebitdaMargin", e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-cyan-500/30 text-white focus:border-cyan-500 focus:outline-none transition-colors"
                      placeholder="Örn: 18.5"
                    />
                    <div className="text-gray-500 mt-1">EBITDA Margin</div>
                  </div>
                </div>
              </div>

              {/* Growth Metrics */}
              <div className="mb-6 pb-6 border-b border-cyan-500/20">
                <h4 className="mb-4 text-gray-300">Büyüme Metrikleri</h4>
                <div>
                  <label className="block text-gray-400 mb-2">Çeyreklik Net Kâr Büyümesi (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={metrics.quarterlyNetIncomeGrowth}
                    onChange={(e) => handleChange("quarterlyNetIncomeGrowth", e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-cyan-500/30 text-white focus:border-cyan-500 focus:outline-none transition-colors"
                    placeholder="Örn: 45.2"
                  />
                  <div className="text-gray-500 mt-1">Quarterly Net Income Growth</div>
                </div>
              </div>

              {/* Liquidity & Debt */}
              <div className="mb-6">
                <h4 className="mb-4 text-gray-300">Likidite ve Borç Oranları</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-400 mb-2">Cari Oran</label>
                    <input
                      type="number"
                      step="0.01"
                      value={metrics.currentRatio}
                      onChange={(e) => handleChange("currentRatio", e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-cyan-500/30 text-white focus:border-cyan-500 focus:outline-none transition-colors"
                      placeholder="Örn: 1.2"
                    />
                    <div className="text-gray-500 mt-1">Current Ratio</div>
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-2">Borç/Özkaynak</label>
                    <input
                      type="number"
                      step="0.01"
                      value={metrics.debtToEquity}
                      onChange={(e) => handleChange("debtToEquity", e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-cyan-500/30 text-white focus:border-cyan-500 focus:outline-none transition-colors"
                      placeholder="Örn: 1.8"
                    />
                    <div className="text-gray-500 mt-1">Debt to Equity</div>
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-2">Nakit Oranı</label>
                    <input
                      type="number"
                      step="0.01"
                      value={metrics.cashRatio}
                      onChange={(e) => handleChange("cashRatio", e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-cyan-500/30 text-white focus:border-cyan-500 focus:outline-none transition-colors"
                      placeholder="Örn: 0.4"
                    />
                    <div className="text-gray-500 mt-1">Cash Ratio</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={handleCalculate}
                  disabled={!hasAnyMetric || loading}
                  className={`flex-1 px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
                    hasAnyMetric && !loading
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-2xl hover:shadow-cyan-500/50 text-white"
                      : "bg-gray-500/20 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  <Calculator className="w-5 h-5" />
                  {loading ? "Hesaplanıyor..." : "Hesapla"}
                </button>
                <button
                  onClick={handleReset}
                  className="px-6 py-3 rounded-xl bg-white/5 border border-cyan-500/30 text-gray-300 hover:bg-white/10 transition-all"
                >
                  Sıfırla
                </button>
              </div>
            </div>
          </div>

          {/* Result Panel */}
          <div className="lg:col-span-1">
            {!result ? (
              <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-blue-600/5 border border-cyan-500/20 h-full flex flex-col items-center justify-center">
                <AlertCircle className="w-16 h-16 text-cyan-500/50 mb-4" />
                <p className="text-gray-400 text-center">
                  {error || "En az bir metrik girerek hesaplama yapabilirsiniz"}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Score Display */}
                <div className={`p-8 rounded-2xl border ${
                  result.score >= 75 
                    ? "bg-gradient-to-br from-green-500/20 to-emerald-600/20 border-green-500/40" 
                    : result.score >= 65
                    ? "bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border-cyan-500/40"
                    : "bg-gradient-to-br from-yellow-500/20 to-orange-600/20 border-yellow-500/40"
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <Award className={`w-6 h-6 ${
                      result.score >= 75 ? "text-green-400" :
                      result.score >= 65 ? "text-cyan-400" :
                      "text-yellow-400"
                    }`} />
                    <h3 className={
                      result.score >= 75 ? "text-green-300" :
                      result.score >= 65 ? "text-cyan-300" :
                      "text-yellow-300"
                    }>Yatırım Puanı</h3>
                  </div>
                  
                  <div className="text-center mb-6">
                    <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br ${
                      result.score >= 75 ? "from-green-400 to-emerald-600" :
                      result.score >= 65 ? "from-cyan-400 to-blue-600" :
                      "from-yellow-400 to-orange-600"
                    } shadow-2xl ${
                      result.score >= 75 ? "shadow-green-500/50" :
                      result.score >= 65 ? "shadow-cyan-500/50" :
                      "shadow-yellow-500/50"
                    }`}>
                      <div className="text-center">
                        <div className="text-white mb-1">{result.score}</div>
                        <div className="text-white/80">/ 100</div>
                      </div>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-gray-400 mb-2">Kalibre Skor / 0-100</div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r ${
                          result.score >= 75 ? "from-green-400 to-emerald-600" :
                          result.score >= 65 ? "from-cyan-400 to-blue-600" :
                          "from-yellow-400 to-orange-600"
                        } transition-all duration-1000`}
                        style={{ width: `${result.score}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-cyan-500/20">
                  <div className="text-gray-400 mb-2">Ham Skor</div>
                  <div className="text-cyan-300 mb-3">{result.rawScore.toFixed(2)}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(result.categoryScores).map(([key, value]) => (
                      <div key={key} className="text-gray-300">
                        {key}: {value === null ? "N/A" : value.toFixed(1)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendation */}
                <div className={`p-6 rounded-2xl border ${
                  result.recommendation === "AL"
                    ? "bg-gradient-to-br from-green-500/10 to-emerald-600/10 border-green-500/30"
                    : result.recommendation === "TUT"
                    ? "bg-gradient-to-br from-yellow-500/10 to-orange-600/10 border-yellow-500/30"
                    : "bg-gradient-to-br from-red-500/10 to-rose-600/10 border-red-500/30"
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <TrendingUp className={
                      result.recommendation === "AL" ? "text-green-400" :
                      result.recommendation === "TUT" ? "text-yellow-400" :
                      "text-red-400"
                    } />
                    <h3 className={
                      result.recommendation === "AL" ? "text-green-300" :
                      result.recommendation === "TUT" ? "text-yellow-300" :
                      "text-red-300"
                    }>Yatırım Önerisi</h3>
                  </div>

                  <div className={`text-center py-4 px-6 rounded-xl ${
                    result.recommendation === "AL" 
                      ? "bg-green-500/20 text-green-300" 
                      : result.recommendation === "TUT"
                      ? "bg-yellow-500/20 text-yellow-300"
                      : "bg-red-500/20 text-red-300"
                  }`}>
                    <div className="mb-2">{result.recommendation}</div>
                  </div>

                  <div className="mt-4 text-gray-300">
                    {result.recommendation === "AL" && 
                      "Güçlü finansal göstergeler, alım fırsatı sunuyor."
                    }
                    {result.recommendation === "TUT" && 
                      "Orta düzey performans, mevcut pozisyonu tutun."
                    }
                    {result.recommendation === "SAT" && 
                      "Zayıf performans göstergeleri, pozisyon azaltabilirsiniz."
                    }
                  </div>
                </div>

                {result.missingMetrics.length > 0 && (
                  <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                    <div className="text-yellow-300 mb-1">Eksik Metrikler</div>
                    <div className="text-gray-300">
                      {result.missingMetrics.join(", ")}
                    </div>
                  </div>
                )}

                {/* Info Box */}
                <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div className="text-gray-300">
                      Bu hesaplama, girilen verilere dayanarak otomatik olarak üretilmiştir. Yatırım kararlarınızda mutlaka profesyonel danışmanlık alın.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

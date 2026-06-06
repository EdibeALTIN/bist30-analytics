import { useState } from "react";
import { Navigation } from "./components/Navigation";
import { Hero } from "./components/Hero";
import { StocksPage } from "./components/StocksPage";
import { StockDetailPage } from "./components/StockDetailPage";
import { SectoralPage } from "./components/SectoralPage";
import { CalculatorPage } from "./components/CalculatorPage";
import { TechnicalAnalysisPage } from "./components/TechnicalAnalysisPage";
import { ScoreComparisonPage } from "./components/ScoreComparisonPage";
import { CompanyNewsPage } from "./components/CompanyNewsPage";
import { RecommendationComparisonPage } from "./components/RecommendationComparisonPage";

import { FinancialPeriodProvider } from "./contexts/FinancialPeriodContext";

export default function App() {
  const [currentPage, setCurrentPage] = useState("home");

  const handleNavigate = (page: string) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const stockCode = currentPage.startsWith("stock-")
    ? currentPage.replace("stock-", "")
    : null;

  return (
    <FinancialPeriodProvider>
    <div className="min-h-screen bg-[#0a0e27] text-white">
      <Navigation currentPage={currentPage} onNavigate={handleNavigate} />
      
      {currentPage === "home" && <Hero onNavigate={handleNavigate} />}
      {currentPage === "stocks" && <StocksPage onNavigate={handleNavigate} />}
      {currentPage === "sectors" && <SectoralPage onNavigate={handleNavigate} />}
      {currentPage === "technical-analysis" && <TechnicalAnalysisPage onNavigate={handleNavigate} />}
      {currentPage === "score-comparison" && <ScoreComparisonPage onNavigate={handleNavigate} />}
      {currentPage === "company-news" && <CompanyNewsPage onNavigate={handleNavigate} />}
      {currentPage === "recommendation-comparison" && (
        <RecommendationComparisonPage onNavigate={handleNavigate} />
      )}
      {currentPage === "calculator" && <CalculatorPage />}
      {stockCode && <StockDetailPage stockCode={stockCode} onNavigate={handleNavigate} />}
    </div>
    </FinancialPeriodProvider>
  );
}

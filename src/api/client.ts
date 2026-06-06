import { ScorePayload, ScoreResult, SectorSummary, Stock } from "../data/stocks";
import { ScoreComparisonDatesResponse, ScoreComparisonResponse } from "../data/scoreComparison";
import { TechnicalAnalysisResponse } from "../data/technical";
import { CompanyNewsResponse } from "../data/companyNews";
import { RecommendationComparisonResponse } from "../data/recommendationComparison";
import { StockHistoryResponse } from "../data/stockHistory";

const API_ROOT = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const API_BASE = `${API_ROOT}/api`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

function qsDonem(donem: string | null | undefined) {
  const d = donem?.trim();
  return d ? `?donem=${encodeURIComponent(d)}` : "";
}

export function getStocks(donem?: string | null): Promise<Stock[]> {
  return request<Stock[]>(`/stocks${qsDonem(donem)}`);
}

export function getStock(
  code: string,
  opts?: { recordId?: number | null; donem?: string | null }
): Promise<Stock> {
  const params = new URLSearchParams();
  if (opts?.recordId != null && opts.recordId !== undefined) params.set("record_id", String(opts.recordId));
  else if (opts?.donem && opts.donem.trim()) params.set("donem", opts.donem.trim());
  const q = params.toString();
  return request<Stock>(`/stocks/${encodeURIComponent(code)}${q ? `?${q}` : ""}`);
}

export function getSectors(donem?: string | null): Promise<SectorSummary[]> {
  return request<SectorSummary[]>(`/sectors${qsDonem(donem)}`);
}

export function getHisselerPeriods(): Promise<{ periods: string[] }> {
  return request<{ periods: string[] }>("/hisseler/periods");
}

export function getStockHistory(code: string): Promise<StockHistoryResponse> {
  return request<StockHistoryResponse>(`/hisseler/history/${encodeURIComponent(code)}`);
}

export function calculateScore(payload: ScorePayload): Promise<ScoreResult> {
  return request<ScoreResult>("/calculate-score", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getTechnicalAnalysisDates(): Promise<{ availableDates: string[]; latestDate: string | null }> {
  return request<{ availableDates: string[]; latestDate: string | null }>("/technical-analysis/dates");
}

export function getTechnicalAnalysis(reportDate?: string): Promise<TechnicalAnalysisResponse> {
  const q = reportDate ? `?report_date=${encodeURIComponent(reportDate)}` : "";
  return request<TechnicalAnalysisResponse>(`/technical-analysis${q}`);
}

export function getScoreComparison(
  reportDate?: string,
  financialDonem?: string | null
): Promise<ScoreComparisonResponse> {
  const params = new URLSearchParams();
  if (reportDate) params.set("report_date", reportDate);
  if (financialDonem && financialDonem.trim()) params.set("donem", financialDonem.trim());
  const q = params.toString();
  return request<ScoreComparisonResponse>(`/score-comparison${q ? `?${q}` : ""}`);
}

export function getScoreComparisonDates(): Promise<ScoreComparisonDatesResponse> {
  return request<ScoreComparisonDatesResponse>("/score-comparison/dates");
}

/** Şirket haberleri. `reportDate` yoksa tüm bültenler, en eski üstte. */
export function getCompanyNews(reportDate?: string): Promise<CompanyNewsResponse> {
  const q = reportDate ? `?report_date=${encodeURIComponent(reportDate)}` : "";
  return request<CompanyNewsResponse>(`/company-news${q}`);
}

export function getRecommendationComparison(halkReportId?: number | null): Promise<RecommendationComparisonResponse> {
  const q =
    halkReportId != null && Number.isFinite(halkReportId)
      ? `?halk_report_id=${encodeURIComponent(String(halkReportId))}`
      : "";
  return request<RecommendationComparisonResponse>(`/recommendation-comparison${q}`);
}

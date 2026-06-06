export type Recommendation = "AL" | "TUT" | "SAT";

export interface Stock {
  code: string;
  name: string;
  sector: string;
  score: number;
  price: number;
  change: number;
  pe: number | null;
  peg: number | null;
  pb: number | null;
  roe: number | null;
  roa: number | null;
  ebitdaMargin: number | null;
  netProfitMargin?: number | null;
  quarterlyNetIncomeGrowth: number | null;
  currentRatio: number | null;
  debtToEquity: number | null;
  cashRatio: number | null;
  priceHistory: number[];
  recommendation: Recommendation;
  targetPrice: number;
  marketCapTl?: number | null;
  recordId?: number | null;
  donem?: string | null;
  tarih?: string | null;
  sectorComparison?: {
    stockCode: string;
    stockSector: string | null;
    stockPotentialReturn: number | null;
    sectorAveragePotentialReturn: number | null;
    differenceFromSector: number | null;
    reportId: number | null;
  };
}

export interface SectorSummary {
  sector: string;
  count: number;
  avgScore: number;
  topStocks: Array<{
    code: string;
    name: string;
    score: number;
    recommendation: Recommendation;
    price: number;
  }>;
}

export interface ScorePayload {
  pe?: number;
  peg?: number;
  pb?: number;
  roe?: number;
  roa?: number;
  ebitdaMargin?: number;
  quarterlyNetIncomeGrowth?: number;
  currentRatio?: number;
  debtToEquity?: number;
  cashRatio?: number;
  dividendYield?: number;
}

export interface ScoreResult {
  rawScore: number;
  calibratedScore: number;
  recommendation: Recommendation;
  categoryScores: Record<string, number | null>;
  usedMetrics: Array<{
    metric: string;
    value: number;
    category: string;
    percentileScore: number;
  }>;
  missingMetrics: string[];
}

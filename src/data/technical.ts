export interface TechnicalIndicatorRow {
  symbol: string;
  lastPrice?: number;
  close?: number;
  mav8: number;
  status8: string;
  mav20: number;
  status20: string;
  mav50: number;
  status50: string;
  mav200: number;
  status200: string;
  macd: number;
  trigger: number;
  rsi14: number;
  supertrend: number;
}

export interface TechnicalSupportResistanceRow {
  symbol: string;
  lastPrice?: number;
  close?: number;
  destek1: number;
  destek2: number;
  destek3: number;
  pivot: number;
  direnc1: number;
  direnc2: number;
  direnc3: number;
}

export interface TechnicalAnalysisSummary {
  indexCount: number;
  bist30Count: number;
  hasData: boolean;
}

export interface TechnicalAnalysisResponse {
  selectedDate: string | null;
  availableDates: string[];
  indexIndicators: TechnicalIndicatorRow[];
  indexSupportResistance: TechnicalSupportResistanceRow[];
  bist30Indicators: TechnicalIndicatorRow[];
  bist30SupportResistance: TechnicalSupportResistanceRow[];
  summary: TechnicalAnalysisSummary;
}

export interface RecommendationComparisonSummary {
  totalStocks: number;
  institutionCount: number;
  multiInstitutionStocks: number;
  topPotential: {
    code: string;
    potentialPct: number;
    sourceLabel: string;
  } | null;
  freshestInstitutionId: string | null;
  topHalkBist30: { code: string; rank: number; potentialReturnPct: number | null } | null;
}

export interface FreshnessRow {
  id: string;
  label: string;
  cadence: string;
  cadenceLabel: string;
  lastReportDate: string | null;
  note?: string;
}

export interface InstitutionOverviewCard {
  id: string;
  label: string;
  accent: string;
  recordCount: number;
  latestReportDate: string | null;
  description: string;
  avgTargetPrice: number | null;
  avgPotentialPct: number | null;
  standoutCodes: string[];
}

export interface ComparisonPanel {
  kind: string;
  institutionLabel: string;
  subLabel: string | null;
  recommendation: string | null;
  recommendationBucket: string;
  targetPrice: number | null;
  potentialReturnPct: number | null;
  referencePrice: number | null;
  reportDate: string | null;
  rank: number | null;
  note?: string | null;
  extra?: Record<string, unknown>;
}

export interface StockComparisonRow {
  code: string;
  name: string;
  sector: string | null;
  insight: string;
  panels: ComparisonPanel[];
  institutionCount: number;
  maxPotentialPct: number | null;
  sortRank: number | undefined;
  recoStrengthMax: number;
}

export interface RecommendationComparisonResponse {
  generatedAt: string;
  summary: RecommendationComparisonSummary;
  freshness: FreshnessRow[];
  institutionOverview: InstitutionOverviewCard[];
  stocks: StockComparisonRow[];
  highlights: {
    halkBist30Ranking: { code: string; rank: number; potentialReturnPct: number | null }[];
    isyatirimEncok: Record<string, unknown>[];
    ziraatPortfoy: Record<string, unknown>[];
    ziraatGenelTakip: Record<string, unknown>[];
  };
  meta: {
    halkRankingReportId: number | null;
    halkReportSnapshots: HalkReportSnapshot[];
    halkSnapshotMode: "latest_auto" | "selected";
    selectedHalkReportId: number | null;
  };
}

export interface HalkReportSnapshot {
  reportId: number;
  reportDateIso: string | null;
  reportDateLabel: string | null;
}

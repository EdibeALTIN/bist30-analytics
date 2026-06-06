export interface QpsScoreRow {
  code: string;
  valueScore: number | null;
  profitabilityScore: number | null;
  growthScore: number | null;
  momentumScore: number | null;
  quantScore: number | null;
  piotroskiFScore: number | null;
  magicFormula: number | null;
}

export interface DipTopRow {
  code: string;
  dip: number | null;
  zirve: number | null;
  agOrta: number | null;
  oncekiKapanis: number | null;
  kapanis: number | null;
  pctGetiri: number | null;
  dipDistancePct: number | null;
  topDistancePct: number | null;
  dipBasedReturnPct: number | null;
  topBasedReturnPct: number | null;
}

export interface ScoreComparisonRow {
  code: string;
  name: string;
  sector: string;
  internalScore: number | null;
  quantScore: number | null;
  valueScore: number | null;
  profitabilityScore: number | null;
  growthScore: number | null;
  momentumScore: number | null;
  piotroskiFScore: number | null;
  magicFormula: number | null;
  dipDistancePct: number | null;
  topDistancePct: number | null;
  dipBasedReturnPct: number | null;
  topBasedReturnPct: number | null;
  pctGetiri: number | null;
  insight: string;
}

export interface ScoreComparisonResponse {
  selectedReportDate: string | null;
  /** Seçili finansal dönem filtresi (iç skorlar); null = güncel çeyrekler */
  financialDonem?: string | null;
  availableDates: string[];
  sources: {
    qpsTable: string | null;
    dipTable: string | null;
  };
  qpsRows: QpsScoreRow[];
  dipRows: DipTopRow[];
  comparisons: ScoreComparisonRow[];
  summary: {
    stockCount: number;
    qpsCount: number;
    dipCount: number;
    comparedCount: number;
    alignedCount: number;
    hasData: boolean;
  };
}

export interface ScoreComparisonDatesResponse {
  availableDates: string[];
  latestDate: string | null;
}

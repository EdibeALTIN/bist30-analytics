export interface StockChartPoint {
  label: string;
  fk: number | null;
  pdDd: number | null;
  netKarMarji: number | null;
  favokMarji: number | null;
  piyasaDegeriTl: number | null;
  debtToEquity: number | null;
}

export interface StockHistoryResponse {
  sirketKodu: string;
  items: Array<Record<string, unknown>>;
  chartSeries: StockChartPoint[];
}

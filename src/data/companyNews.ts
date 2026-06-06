export interface CompanyNewsItem {
  id: number;
  reportDate: string;
  companyCode: string;
  companyName: string;
  sector: string | null;
  analystView: string;
  newsText: string;
  stockDataText: string;
  marketMultiplesText: string;
  relativePerformanceText: string;
  rawTableText: string;
  rawBlockText: string;
  sourceName: string;
}

export interface CompanyNewsResponse {
  items: CompanyNewsItem[];
  count: number;
  message?: string;
  availableReportDates?: string[];
  selectedReportDate?: string | null;
}

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getHisselerPeriods } from "../api/client";

export type FinancialPeriodContextValue = {
  /** null = latest snapshot per company */
  donem: string | null;
  periods: string[];
  setLatest: () => void;
  setDonem: (d: string | null) => void;
  loadingPeriods: boolean;
};

const FinancialPeriodContext = createContext<FinancialPeriodContextValue | undefined>(undefined);

export function FinancialPeriodProvider({ children }: { children: React.ReactNode }) {
  const [donem, setDonemState] = useState<string | null>(null);
  const [periods, setPeriods] = useState<string[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(true);

  useEffect(() => {
    let active = true;
    getHisselerPeriods()
      .then((r) => {
        if (active) setPeriods(r.periods ?? []);
      })
      .catch(() => {
        if (active) setPeriods([]);
      })
      .finally(() => {
        if (active) setLoadingPeriods(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const setLatest = useCallback(() => setDonemState(null), []);
  const setDonem = useCallback((d: string | null) => setDonemState(d?.trim() || null), []);

  const value = useMemo(
    () => ({
      donem,
      periods,
      setLatest,
      setDonem,
      loadingPeriods,
    }),
    [donem, periods, setLatest, setDonem, loadingPeriods]
  );

  return <FinancialPeriodContext.Provider value={value}>{children}</FinancialPeriodContext.Provider>;
}

export function useFinancialPeriod(): FinancialPeriodContextValue {
  const ctx = useContext(FinancialPeriodContext);
  if (!ctx) {
    throw new Error("useFinancialPeriod must be used within FinancialPeriodProvider");
  }
  return ctx;
}

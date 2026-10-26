"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const FREE_LIMIT = 3;
export const PRO_PRICE = 9;

interface UsageState {
  analysesThisMonth: number;
  monthKey: string;
  isPro: boolean;
  recordAnalysis: () => boolean;
  setPro: (v: boolean) => void;
  remaining: () => number;
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const useUsage = create<UsageState>()(
  persist(
    (set, get) => ({
      analysesThisMonth: 0,
      monthKey: currentMonthKey(),
      isPro: false,
      remaining() {
        const s = get();
        const key = currentMonthKey();
        if (s.monthKey !== key) return FREE_LIMIT;
        if (s.isPro) return Infinity;
        return Math.max(0, FREE_LIMIT - s.analysesThisMonth);
      },
      recordAnalysis() {
        const key = currentMonthKey();
        const s = get();
        let count = s.analysesThisMonth;
        if (s.monthKey !== key) count = 0;
        if (!s.isPro && count >= FREE_LIMIT) return false;
        set({ analysesThisMonth: count + 1, monthKey: key });
        return true;
      },
      setPro(v) {
        set({ isPro: v });
      },
    }),
    { name: "lumen-usage" }
  )
);

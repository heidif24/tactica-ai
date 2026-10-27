"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Free: 1 analysis pack per verified email per month (enforced server-side) */
export const FREE_LIMIT = 1;

interface UsageState {
  isPro: boolean;
  setPro: (v: boolean) => void;
}

export const useUsage = create<UsageState>()(
  persist(
    (set) => ({
      isPro: false,
      setPro(v) {
        set({ isPro: v });
      },
    }),
    { name: "lumen-usage" }
  )
);

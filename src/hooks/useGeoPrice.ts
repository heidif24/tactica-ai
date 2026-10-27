"use client";

import { useEffect, useState } from "react";
import type { LocalizedPrice } from "@/lib/geo";

const fallback: LocalizedPrice = {
  country: "US",
  countryName: "United States",
  currency: "USD",
  currencySymbol: "$",
  proMonthly: 9,
  proLabel: "$9",
  note: "Prices in US dollars",
};

export function useGeoPrice() {
  const [price, setPrice] = useState<LocalizedPrice>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/geo")
      .then((r) => r.json())
      .then((d) => setPrice(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { price, loading };
}

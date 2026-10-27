/** Location-based pricing from IP / Vercel geo headers */

export type CurrencyCode = "USD" | "NGN" | "GHS" | "KES" | "ZAR" | "GBP" | "EUR" | "CAD" | "INR" | "XOF";

export interface LocalizedPrice {
  country: string;
  countryName: string;
  currency: CurrencyCode;
  currencySymbol: string;
  /** Pro monthly price in local currency (integer display) */
  proMonthly: number;
  /** Formatted string e.g. ₦13,500 */
  proLabel: string;
  /** Approx note relative to USD base */
  note: string;
}

/** Base Pro price USD */
export const PRO_USD = 9;

/**
 * Approximate display rates for product pricing (not live FX — update periodically).
 * Base: $9/month Pro.
 */
const TABLE: Record<
  string,
  { currency: CurrencyCode; symbol: string; rate: number; name: string }
> = {
  NG: { currency: "NGN", symbol: "₦", rate: 1550, name: "Nigeria" },
  GH: { currency: "GHS", symbol: "GH₵", rate: 15.5, name: "Ghana" },
  KE: { currency: "KES", symbol: "KSh", rate: 130, name: "Kenya" },
  ZA: { currency: "ZAR", symbol: "R", rate: 18, name: "South Africa" },
  GB: { currency: "GBP", symbol: "£", rate: 0.79, name: "United Kingdom" },
  IE: { currency: "EUR", symbol: "€", rate: 0.92, name: "Ireland" },
  FR: { currency: "EUR", symbol: "€", rate: 0.92, name: "France" },
  DE: { currency: "EUR", symbol: "€", rate: 0.92, name: "Germany" },
  NL: { currency: "EUR", symbol: "€", rate: 0.92, name: "Netherlands" },
  CA: { currency: "CAD", symbol: "C$", rate: 1.37, name: "Canada" },
  IN: { currency: "INR", symbol: "₹", rate: 83, name: "India" },
  SN: { currency: "XOF", symbol: "CFA", rate: 600, name: "Senegal" },
  CI: { currency: "XOF", symbol: "CFA", rate: 600, name: "Côte d'Ivoire" },
  US: { currency: "USD", symbol: "$", rate: 1, name: "United States" },
};

function formatAmount(n: number, currency: CurrencyCode, symbol: string): string {
  if (currency === "NGN" || currency === "KES" || currency === "XOF" || currency === "INR") {
    return `${symbol}${Math.round(n).toLocaleString()}`;
  }
  if (currency === "USD" || currency === "CAD" || currency === "EUR" || currency === "GBP") {
    return `${symbol}${n.toFixed(n % 1 === 0 ? 0 : 2)}`;
  }
  return `${symbol}${Math.round(n).toLocaleString()}`;
}

export function localizePrice(countryCode: string | null | undefined): LocalizedPrice {
  const cc = (countryCode || "US").toUpperCase().slice(0, 2);
  const row = TABLE[cc] || TABLE.US;
  const proMonthly = Math.max(1, Math.round(PRO_USD * row.rate));
  return {
    country: cc,
    countryName: row.name,
    currency: row.currency,
    currencySymbol: row.symbol,
    proMonthly,
    proLabel: formatAmount(proMonthly, row.currency, row.symbol),
    note:
      row.currency === "USD"
        ? "Prices in US dollars"
        : `Shown in ${row.currency} for visitors in ${row.name} (approx. from $${PRO_USD} USD)`,
  };
}

export function countryFromHeaders(h: Headers): string {
  return (
    h.get("x-vercel-ip-country") ||
    h.get("cf-ipcountry") ||
    h.get("x-country-code") ||
    "US"
  );
}

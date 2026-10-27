"use client";

import Link from "next/link";
import { Check, Sparkles, MapPin } from "lucide-react";
import { useGeoPrice } from "@/hooks/useGeoPrice";

const free = [
  "Email verification required",
  "1 full analysis pack / month",
  "Goal-led tool selection",
  "OLS, ANOVA, t-test, chi-square",
  "Kaplan–Meier & Cox PH",
  "Multilevel models",
  "Downloadable client brief",
];

const pro = [
  "Unlimited analysis packs",
  "Everything in Free",
  "Priority export packaging",
  "Email support",
  "Early access to new models",
];

export default function PricingPage() {
  const { price, loading } = useGeoPrice();

  return (
    <div className="mesh relative overflow-hidden">
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="text-center">
          <p className="chip mx-auto">Simple, location-aware pricing</p>
          <h1 className="display mt-5 text-4xl sm:text-5xl">Start free. Scale when it pays off.</h1>
          <p className="mx-auto mt-4 flex max-w-lg flex-wrap items-center justify-center gap-2 text-ink-600">
            <MapPin className="h-4 w-4 text-lumen-600" />
            {loading ? (
              "Detecting your region…"
            ) : (
              <>
                Showing prices for <strong>{price.countryName}</strong> · {price.note}
              </>
            )}
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2">
          <div className="rounded-3xl border border-ink-100 bg-white/90 p-8 shadow-soft backdrop-blur-sm">
            <p className="section-label">Free</p>
            <p className="mt-3 font-display text-5xl text-ink-950">
              {price.currencySymbol}0
              <span className="text-lg font-sans text-ink-400">/mo</span>
            </p>
            <p className="mt-2 text-sm text-ink-500">1 verified analysis per month · email required</p>
            <ul className="mt-8 space-y-3">
              {free.map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm text-ink-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lumen-50 text-lumen-700">
                    <Check className="h-3 w-3" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <Link href="/app" className="btn-secondary mt-10 w-full">
              Start free
            </Link>
          </div>

          <div className="relative rounded-3xl border border-lumen-300/80 bg-white p-8 shadow-lift ring-1 ring-lumen-100">
            <span className="absolute -top-3 right-6 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-lumen-600 to-lumen-500 px-3 py-1 text-xs font-semibold text-white shadow-soft">
              <Sparkles className="h-3 w-3" /> Popular
            </span>
            <p className="section-label !text-lumen-700">Pro</p>
            <p className="mt-3 font-display text-5xl text-ink-950">
              {price.proLabel}
              <span className="text-lg font-sans text-ink-400">/mo</span>
            </p>
            <p className="mt-2 text-sm text-ink-500">
              Unlimited runs · billed in {price.currency}
            </p>
            <ul className="mt-8 space-y-3">
              {pro.map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm text-ink-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lumen-100 text-lumen-700">
                    <Check className="h-3 w-3" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
            <Link href="/app?upgrade=1" className="btn-primary mt-10 w-full">
              Upgrade · {price.proLabel}/mo
            </Link>
            <p className="mt-3 text-center text-xs text-ink-400">
              Local display from your IP. Stripe billing can charge in local currency next.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

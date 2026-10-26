import Link from "next/link";
import { Check } from "lucide-react";

const free = [
  "3 full analyses per month",
  "CSV upload & cleaning",
  "Overview, correlations, quality",
  "On-screen charts",
  "Browser-only processing",
];

const pro = [
  "Unlimited analyses",
  "Everything in Free",
  "Priority export packaging",
  "Saved workspace history (coming)",
  "Email support",
];

export default function PricingPage() {
  return (
    <div className="bg-hero-glow">
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <h1 className="font-display text-4xl tracking-tight text-ink-950 sm:text-5xl">Simple pricing</h1>
          <p className="mx-auto mt-4 max-w-lg text-ink-600">
            Try Lumen free. Upgrade when you need more room — no long contracts.
          </p>
        </div>
        <div className="mt-14 grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-ink-100 bg-white p-8 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-wider text-ink-500">Free</p>
            <p className="mt-2 font-display text-4xl text-ink-950">$0<span className="text-lg text-ink-400">/mo</span></p>
            <p className="mt-2 text-sm text-ink-500">See the full product with light limits.</p>
            <ul className="mt-8 space-y-3">
              {free.map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-ink-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-lumen-600" />{t}
                </li>
              ))}
            </ul>
            <Link href="/app" className="mt-8 block rounded-full border border-ink-200 py-3 text-center text-sm font-semibold text-ink-900 transition hover:border-ink-300">
              Start free
            </Link>
          </div>
          <div className="relative rounded-2xl border border-lumen-300 bg-white p-8 shadow-lift ring-1 ring-lumen-100">
            <span className="absolute -top-3 right-6 rounded-full bg-lumen-600 px-3 py-0.5 text-xs font-semibold text-white">Popular</span>
            <p className="text-sm font-semibold uppercase tracking-wider text-lumen-700">Pro</p>
            <p className="mt-2 font-display text-4xl text-ink-950">$9<span className="text-lg text-ink-400">/mo</span></p>
            <p className="mt-2 text-sm text-ink-500">Unlimited clarity for individuals and small teams.</p>
            <ul className="mt-8 space-y-3">
              {pro.map((t) => (
                <li key={t} className="flex items-start gap-2 text-sm text-ink-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-lumen-600" />{t}
                </li>
              ))}
            </ul>
            <Link href="/app?upgrade=1" className="mt-8 block rounded-full bg-ink-950 py-3 text-center text-sm font-semibold text-white transition hover:bg-ink-800">
              Upgrade to Pro
            </Link>
            <p className="mt-3 text-center text-xs text-ink-400">Demo upgrade in-app. Stripe live billing can be connected next.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

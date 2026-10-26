import Link from "next/link";
import {
  Upload,
  ListChecks,
  Sparkles,
  FileDown,
  Shield,
  Zap,
  BarChart3,
  ArrowRight,
} from "lucide-react";

const features = [
  { icon: Upload, title: "Upload anything tabular", body: "CSV, Excel, or paste-ready files. Lumen reads your columns and gets to work." },
  { icon: ListChecks, title: "Tell it what you care about", body: "A clear checklist in plain English." },
  { icon: Sparkles, title: "Automatic cleaning", body: "Duplicates, empty fields, messy labels." },
  { icon: BarChart3, title: "Charts that make sense", body: "Correlations, distributions, missing data." },
  { icon: FileDown, title: "Reports you can share", body: "Professional results, not cryptic output." },
  { icon: Shield, title: "Your data stays yours", body: "Browser analysis on free tier. No account to try." },
];

const steps = [
  { n: "01", title: "Upload", text: "Drop a spreadsheet. See a live preview." },
  { n: "02", title: "Choose", text: "Tick the questions you want answered." },
  { n: "03", title: "Understand", text: "Read plain-language findings and charts." },
  { n: "04", title: "Share", text: "Export when you are ready." },
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-hero-glow">
        <div className="absolute inset-0 bg-grid-fade" />
        <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-20 sm:px-6 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-lumen-200 bg-lumen-50 px-3 py-1 text-xs font-medium text-lumen-800">
              <Zap className="h-3.5 w-3.5" /> Free to try · 3 analyses / month
            </p>
            <h1 className="font-display text-4xl leading-[1.15] tracking-tight text-ink-950 sm:text-5xl md:text-6xl">
              Light on your data.
              <span className="block text-lumen-600">Clarity in minutes.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-ink-600">
              Upload a file, choose what matters, get cleaned results and charts — without writing a formula.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/app" className="inline-flex items-center gap-2 rounded-full bg-ink-950 px-7 py-3.5 text-sm font-semibold text-white shadow-lift transition hover:bg-ink-800">
                Start free analysis <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/pricing" className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-7 py-3.5 text-sm font-semibold text-ink-800 shadow-soft">
                See pricing
              </Link>
            </div>
            <p className="mt-6 text-sm text-ink-400">No credit card · Works in your browser · Upgrade anytime</p>
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-ink-100 bg-white py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center font-display text-3xl tracking-tight text-ink-950 sm:text-4xl">Everything you need.</h2>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-ink-100 bg-ink-50/40 p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-lumen-100 text-lumen-700">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-ink-950">{f.title}</h3>
                <p className="mt-2 text-sm text-ink-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="border-t border-ink-100 bg-ink-50/50 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center font-display text-3xl text-ink-950">Four steps. One clear story.</h2>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="rounded-2xl bg-white p-6 shadow-soft">
                <span className="text-sm font-semibold text-lumen-600">{s.n}</span>
                <h3 className="mt-2 text-lg font-semibold text-ink-950">{s.title}</h3>
                <p className="mt-2 text-sm text-ink-600">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-ink-100 bg-ink-950 py-20 text-white">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="font-display text-3xl sm:text-4xl">See what your data is saying.</h2>
          <p className="mt-4 text-ink-300">Three free analyses every month. Pro is $9/month for unlimited runs.</p>
          <Link href="/app" className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-ink-950">
            Open Lumen free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}

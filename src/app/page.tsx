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
  Activity,
  Layers,
  Target,
} from "lucide-react";

const features = [
  {
    icon: Target,
    title: "Goal-led analysis",
    body: "Tell Lumen what the client needs — explore, compare, predict, survival — and the right tools light up.",
  },
  {
    icon: Upload,
    title: "Upload tabular data",
    body: "CSV in seconds. Columns profiled, cleaned, and ready for models.",
  },
  {
    icon: Activity,
    title: "Full statistical toolkit",
    body: "OLS, ANOVA, t-tests, chi-square, Kaplan–Meier, Cox PH, multilevel — mapped to R and Stata.",
  },
  {
    icon: BarChart3,
    title: "Charts that read clean",
    body: "Survival curves, missingness, correlations — visuals you can put in front of a stakeholder.",
  },
  {
    icon: FileDown,
    title: "Downloadable briefs",
    body: "Narrative drafts and recommendations exported as a client-ready text brief.",
  },
  {
    icon: Shield,
    title: "Private by design",
    body: "Free-tier analysis runs in the browser. Your file does not need a server to start.",
  },
];

const toolkit = [
  { name: "OLS regression", r: "lm()", s: "regress" },
  { name: "ANOVA", r: "aov()", s: "oneway" },
  { name: "Cox PH", r: "coxph()", s: "stcox" },
  { name: "Kaplan–Meier", r: "survfit()", s: "sts" },
  { name: "Multilevel", r: "lmer()", s: "mixed" },
  { name: "Chi-square", r: "chisq.test()", s: "tab chi2" },
];

const steps = [
  { n: "01", title: "Set expectations", text: "Pick client goals so the toolkit matches the brief." },
  { n: "02", title: "Upload", text: "Drop a CSV. Roles for Y, X, time, event, cluster." },
  { n: "03", title: "Run the pack", text: "Models, plain English, and charts in one pass." },
  { n: "04", title: "Download", text: "Export the analytical brief for your client." },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden mesh">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(15,18,34,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,18,34,0.03)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="chip mx-auto mb-6">
              <Zap className="h-3.5 w-3.5" />
              Free to try · Cox · multilevel · client briefs
            </p>
            <h1 className="display text-4xl leading-[1.12] sm:text-5xl md:text-6xl">
              Statistical clarity,
              <span className="block bg-gradient-to-r from-lumen-600 via-lumen-500 to-indigo-500 bg-clip-text text-transparent">
                without the jargon wall.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-600">
              Lumen is a complete analysis workspace: goal-led tool selection, R/Stata-style models,
              and downloadable briefs your clients can actually read.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/app" className="btn-primary px-8 py-3.5">
                Start free analysis
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/pricing" className="btn-secondary px-8 py-3.5">
                See pricing
              </Link>
            </div>
            <p className="mt-6 text-sm text-ink-400">
              No credit card · 3 free runs / month · Upgrade anytime
            </p>
          </div>

          {/* Product preview card */}
          <div className="mx-auto mt-16 max-w-4xl overflow-hidden rounded-3xl border border-ink-100/80 bg-white/80 shadow-lift ring-1 ring-black/5 backdrop-blur-sm">
            <div className="flex items-center gap-2 border-b border-ink-100 bg-gradient-to-r from-ink-50 to-white px-5 py-3.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/90" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
              <span className="ml-3 text-xs font-medium text-ink-400">lumen · analysis pack</span>
            </div>
            <div className="grid divide-y divide-ink-100 md:grid-cols-3 md:divide-x md:divide-y-0">
              {[
                { k: "Goal", v: "Time-to-event", s: "Cox + Kaplan–Meier selected" },
                { k: "Finding", v: "HR 1.42", s: "Covariate linked to hazard" },
                { k: "Deliverable", v: "Client brief", s: "Download .txt narrative" },
              ].map((cell) => (
                <div key={cell.k} className="p-6">
                  <p className="section-label">{cell.k}</p>
                  <p className="mt-2 text-lg font-semibold text-ink-950">{cell.v}</p>
                  <p className="mt-1 text-sm text-ink-500">{cell.s}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-ink-100/80 bg-white/50 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="section-label">Why Lumen</p>
            <h2 className="display mt-3 text-3xl sm:text-4xl">Built for decisions, not syntax.</h2>
            <p className="mt-4 text-ink-600">
              From first look to Cox models and multilevel ICC — one workspace, client-ready language.
            </p>
          </div>
          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="card-hover rounded-2xl border border-ink-100/90 bg-white/90 p-6 shadow-soft"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-lumen-50 to-lumen-100 text-lumen-700 ring-1 ring-lumen-200/60">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-ink-950">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Toolkit */}
      <section id="toolkit" className="border-t border-ink-100/80 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <p className="section-label">Toolkit</p>
              <h2 className="display mt-3 text-3xl sm:text-4xl">R & Stata, without the IDE.</h2>
              <p className="mt-3 max-w-lg text-ink-600">
                Familiar method names. Plain-English output. Tables and curves ready to brief.
              </p>
            </div>
            <Link href="/app" className="btn-secondary text-sm">
              Open workspace <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {toolkit.map((t) => (
              <div
                key={t.name}
                className="flex items-center justify-between rounded-2xl border border-ink-100 bg-white/90 px-5 py-4 shadow-soft"
              >
                <div className="flex items-center gap-3">
                  <Layers className="h-4 w-4 text-lumen-600" />
                  <span className="font-medium text-ink-900">{t.name}</span>
                </div>
                <span className="text-[11px] text-ink-400">
                  {t.r} · {t.s}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="border-t border-ink-100/80 bg-ink-950 py-24 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="display text-center text-3xl text-white sm:text-4xl">Four steps. One brief.</h2>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm"
              >
                <span className="text-sm font-semibold text-lumen-300">{s.n}</span>
                <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-ink-100 bg-gradient-to-b from-lumen-50/80 to-white py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Sparkles className="mx-auto h-8 w-8 text-lumen-600" />
          <h2 className="display mt-4 text-3xl sm:text-4xl">Ship the next client brief today.</h2>
          <p className="mt-4 text-ink-600">
            Three free analyses every month. Pro unlocks unlimited runs for $9/month.
          </p>
          <Link href="/app" className="btn-primary mt-8 px-8 py-3.5">
            Open Lumen free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}

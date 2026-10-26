"use client";

import { useCallback, useMemo, useState } from "react";
import Papa from "papaparse";
import Link from "next/link";
import { Upload, Play, Lock, Sparkles, FileSpreadsheet, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { analyzeDataset, type AnalysisBundle, type Row } from "@/lib/analyze";
import { formatNumber } from "@/lib/utils";
import { useUsage, FREE_LIMIT, PRO_PRICE } from "@/store/usage";

const CHECKLIST = [
  { id: "overview", label: "Dataset overview" },
  { id: "descriptive", label: "Descriptive statistics" },
  { id: "missing", label: "Missing data" },
  { id: "correlation", label: "Relationships" },
  { id: "quality", label: "Data quality" },
  { id: "recommendations", label: "Recommendations" },
];

export default function AppPage() {
  const { isPro, remaining, recordAnalysis, setPro } = useUsage();
  const left = remaining();
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [selected, setSelected] = useState<string[]>(CHECKLIST.map((c) => c.id));
  const [bundle, setBundle] = useState<AnalysisBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const onFile = useCallback((file: File) => {
    setError(null);
    setBundle(null);
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const data = (results.data as Row[]).filter((r) => Object.keys(r).length > 0);
        if (!data.length) {
          setError("No rows found in this file.");
          setRows(null);
          return;
        }
        setRows(data);
      },
      error(err) {
        setError(err.message);
      },
    });
  }, []);

  const run = () => {
    if (!rows) return;
    if (!recordAnalysis()) {
      setShowUpgrade(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setBundle(analyzeDataset(rows));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  };

  const missingChart = useMemo(() => {
    if (!bundle) return [];
    return bundle.missing.slice(0, 8).map((m) => ({
      name: m.column.length > 14 ? m.column.slice(0, 12) + "…" : m.column,
      pct: Number(m.pct.toFixed(1)),
    }));
  }, [bundle]);

  return (
    <div className="min-h-[80vh] bg-ink-50/40">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl text-ink-950">Workspace</h1>
            <p className="mt-1 text-sm text-ink-500">Upload · choose · analyse · understand</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-ink-200 bg-white px-4 py-2 text-xs text-ink-600 shadow-soft">
              {isPro ? (
                <span className="font-semibold text-lumen-700">Pro · unlimited</span>
              ) : (
                <>Free · <strong>{left === Infinity ? "∞" : left}</strong> of {FREE_LIMIT} left this month</>
              )}
            </div>
            {!isPro && (
              <button onClick={() => setShowUpgrade(true)} className="rounded-full bg-ink-950 px-4 py-2 text-xs font-semibold text-white">
                Upgrade ${PRO_PRICE}/mo
              </button>
            )}
          </div>
        </div>

        {showUpgrade && (
          <div className="mt-6 rounded-2xl border border-lumen-200 bg-lumen-50 p-6">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 text-lumen-700" />
              <div className="flex-1">
                <h3 className="font-semibold text-ink-950">Upgrade to Pro</h3>
                <p className="mt-1 text-sm text-ink-600">
                  Free analyses used up for this month. Pro unlocks unlimited runs for ${PRO_PRICE}/month.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button onClick={() => { setPro(true); setShowUpgrade(false); }} className="rounded-full bg-ink-950 px-5 py-2 text-sm font-semibold text-white">
                    Activate Pro (demo)
                  </button>
                  <button onClick={() => setShowUpgrade(false)} className="rounded-full border border-ink-200 bg-white px-5 py-2 text-sm text-ink-700">Maybe later</button>
                  <Link href="/pricing" className="px-2 py-2 text-sm text-lumen-700 underline">View plans</Link>
                </div>
                <p className="mt-3 text-xs text-ink-400">Demo toggles Pro in this browser. Connect Stripe for real billing when ready.</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-soft">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                <FileSpreadsheet className="h-4 w-4 text-lumen-600" /> 1. Your file
              </h2>
              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-200 bg-ink-50/50 px-4 py-10 transition hover:border-lumen-300">
                <Upload className="h-8 w-8 text-ink-400" />
                <span className="mt-3 text-sm font-medium text-ink-700">Drop CSV or click to browse</span>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
              </label>
              {fileName && (
                <p className="mt-3 text-sm text-ink-600">
                  <span className="font-medium text-ink-900">{fileName}</span>
                  {rows && ` · ${rows.length.toLocaleString()} rows`}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-soft">
              <h2 className="text-sm font-semibold text-ink-900">2. What do you need?</h2>
              <div className="mt-4 space-y-2">
                {CHECKLIST.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-3 text-sm text-ink-700">
                    <input type="checkbox" className="h-4 w-4 rounded border-ink-300 text-lumen-600" checked={selected.includes(c.id)}
                      onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id))} />
                    {c.label}
                  </label>
                ))}
              </div>
              <button disabled={!rows || busy} onClick={run}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-ink-950 py-3 text-sm font-semibold text-white disabled:opacity-40">
                {busy ? "Running…" : (<><Play className="h-4 w-4" /> Run analysis</>)}
              </button>
            </div>
          </div>

          <div className="lg:col-span-3">
            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0" />{error}
              </div>
            )}
            {!bundle && !error && (
              <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white text-center">
                <Sparkles className="h-8 w-8 text-ink-300" />
                <p className="mt-3 text-sm font-medium text-ink-600">Results appear here</p>
              </div>
            )}
            {bundle && (
              <div className="space-y-6">
                {selected.includes("overview") && (
                  <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-soft">
                    <h3 className="text-sm font-semibold text-ink-900">Dataset overview</h3>
                    <p className="mt-2 text-sm text-ink-600">
                      Cleaned data: <strong>{bundle.profile.rows.toLocaleString()}</strong> rows × <strong>{bundle.profile.columns}</strong> columns.
                      Missing cells: <strong>{formatNumber(bundle.profile.missingPct, 1)}%</strong>.
                      {bundle.removedDuplicates > 0 && <> Removed <strong>{bundle.removedDuplicates}</strong> duplicates.</>}
                    </p>
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead><tr className="border-b border-ink-100 text-ink-500">
                          <th className="py-2 pr-3">Column</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Missing %</th><th className="py-2">Unique</th>
                        </tr></thead>
                        <tbody>
                          {bundle.profile.columnSummary.map((c) => (
                            <tr key={c.name} className="border-b border-ink-50">
                              <td className="py-2 pr-3 font-medium">{c.name}</td>
                              <td className="py-2 pr-3">{c.type}</td>
                              <td className="py-2 pr-3">{formatNumber(c.missingPct, 1)}</td>
                              <td className="py-2">{c.unique}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
                {selected.includes("descriptive") && bundle.descriptive.length > 0 && (
                  <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-soft">
                    <h3 className="text-sm font-semibold text-ink-900">Descriptive statistics</h3>
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead><tr className="border-b border-ink-100 text-ink-500">
                          <th className="py-2 pr-3">Column</th><th className="py-2 pr-3">Mean</th><th className="py-2 pr-3">Median</th><th className="py-2 pr-3">Std</th><th className="py-2 pr-3">Min</th><th className="py-2">Max</th>
                        </tr></thead>
                        <tbody>
                          {bundle.descriptive.map((d) => (
                            <tr key={d.column} className="border-b border-ink-50">
                              <td className="py-2 pr-3 font-medium">{d.column}</td>
                              <td className="py-2 pr-3">{formatNumber(d.mean)}</td>
                              <td className="py-2 pr-3">{formatNumber(d.median)}</td>
                              <td className="py-2 pr-3">{formatNumber(d.std)}</td>
                              <td className="py-2 pr-3">{formatNumber(d.min)}</td>
                              <td className="py-2">{formatNumber(d.max)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
                {selected.includes("missing") && (
                  <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-soft">
                    <h3 className="text-sm font-semibold text-ink-900">Missing data</h3>
                    {bundle.missing.length === 0 ? (
                      <p className="mt-2 text-sm text-ink-600">No missing values. Nice.</p>
                    ) : (
                      <div className="mt-4 h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={missingChart} layout="vertical" margin={{ left: 8, right: 16 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#eeeef0" />
                            <XAxis type="number" unit="%" tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                            <Tooltip />
                            <Bar dataKey="pct" fill="#0c8ce9" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </section>
                )}
                {selected.includes("correlation") && (
                  <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-soft">
                    <h3 className="text-sm font-semibold text-ink-900">Strongest relationships</h3>
                    {bundle.correlations.length === 0 ? (
                      <p className="mt-2 text-sm text-ink-600">Need at least two numeric columns.</p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {bundle.correlations.slice(0, 8).map((c) => (
                          <li key={c.a + c.b} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm">
                            <span className="text-ink-700">{c.a} ↔ {c.b}</span>
                            <span className="font-semibold">{c.r.toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )}
                {selected.includes("quality") && (
                  <section className="rounded-2xl border border-ink-100 bg-white p-6 shadow-soft">
                    <h3 className="text-sm font-semibold text-ink-900">Data quality</h3>
                    <ul className="mt-3 space-y-1 text-sm text-ink-600">
                      <li>Duplicates removed: <strong>{bundle.quality.duplicates}</strong></li>
                      <li>Average missing rate: <strong>{formatNumber(bundle.quality.avgMissingPct, 1)}%</strong></li>
                      <li>Constant columns: <strong>{bundle.quality.constantColumns.length ? bundle.quality.constantColumns.join(", ") : "none"}</strong></li>
                    </ul>
                  </section>
                )}
                {selected.includes("recommendations") && (
                  <section className="rounded-2xl border border-lumen-100 bg-lumen-50/50 p-6">
                    <h3 className="text-sm font-semibold text-ink-900">Recommendations</h3>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-700">
                      {bundle.recommendations.map((r, i) => (<li key={i}>{r}</li>))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

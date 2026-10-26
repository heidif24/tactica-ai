"use client";

import { useCallback, useMemo, useState } from "react";
import Papa from "papaparse";
import Link from "next/link";
import { Upload, Play, Lock, Sparkles, FileSpreadsheet, AlertCircle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";
import { analyzeDataset, type AnalysisBundle, type Row } from "@/lib/analyze";
import {
  STATS_CATALOG,
  linearRegression,
  oneWayAnova,
  welchTTest,
  chiSquareTest,
  kaplanMeier,
  multilevelRandomIntercept,
  type RegressionResult,
  type AnovaResult,
  type TTestResult,
  type ChiSquareResult,
  type SurvivalResult,
  type MultilevelResult,
} from "@/lib/stats";
import { formatNumber } from "@/lib/utils";
import { useUsage, FREE_LIMIT, PRO_PRICE } from "@/store/usage";

export default function AppPage() {
  const { isPro, remaining, recordAnalysis, setPro } = useUsage();
  const left = remaining();
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [selected, setSelected] = useState<string[]>(STATS_CATALOG.map((c) => c.id));
  const [bundle, setBundle] = useState<AnalysisBundle | null>(null);
  const [advanced, setAdvanced] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [yCol, setYCol] = useState("");
  const [xCols, setXCols] = useState<string[]>([]);
  const [factorCol, setFactorCol] = useState("");
  const [groupCol, setGroupCol] = useState("");
  const [timeCol, setTimeCol] = useState("");
  const [eventCol, setEventCol] = useState("");
  const [clusterCol, setClusterCol] = useState("");

  const columns = useMemo(() => (rows?.length ? Object.keys(rows[0]) : []), [rows]);
  const numericGuess = useMemo(() => {
    if (!rows?.length) return [] as string[];
    return columns.filter((c) => {
      const sample = rows!.slice(0, 50).map((r) => r[c]);
      const nums = sample.filter((v) => v !== null && v !== "" && Number.isFinite(Number(v)));
      return nums.length >= sample.length * 0.6;
    });
  }, [rows, columns]);

  const onFile = useCallback((file: File) => {
    setError(null);
    setBundle(null);
    setAdvanced({});
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const data = (results.data as Row[]).filter((r) => Object.keys(r).length > 0);
        if (!data.length) {
          setError("No rows found.");
          setRows(null);
          return;
        }
        setRows(data);
        const cols = Object.keys(data[0]);
        const nums = cols.filter((c) => {
          const s = data.slice(0, 40).map((r) => r[c]);
          return s.filter((v) => v !== null && v !== "" && Number.isFinite(Number(v))).length >= s.length * 0.6;
        });
        if (nums[0]) setYCol(nums[0]);
        if (nums[1]) setXCols([nums[1]]);
        const cats = cols.filter((c) => !nums.includes(c));
        if (cats[0]) {
          setFactorCol(cats[0]);
          setGroupCol(cats[0]);
          setClusterCol(cats[0]);
        }
        if (nums[0]) setTimeCol(nums[0]);
        if (nums[1]) setEventCol(nums[1]);
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
      const adv: Record<string, unknown> = {};
      if (selected.includes("regression") && yCol && xCols.length) adv.regression = linearRegression(rows, yCol, xCols);
      if (selected.includes("anova") && yCol && factorCol) adv.anova = oneWayAnova(rows, yCol, factorCol);
      if (selected.includes("ttest") && yCol && groupCol) adv.ttest = welchTTest(rows, yCol, groupCol);
      if (selected.includes("chisq") && factorCol && groupCol && factorCol !== groupCol) adv.chisq = chiSquareTest(rows, factorCol, groupCol);
      if (selected.includes("survival") && timeCol && eventCol) adv.survival = kaplanMeier(rows, timeCol, eventCol, groupCol || undefined);
      if (selected.includes("multilevel") && yCol && clusterCol) adv.multilevel = multilevelRandomIntercept(rows, yCol, clusterCol, xCols);
      setAdvanced(adv);
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

  const toggleX = (c: string) => setXCols((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <div className="min-h-[80vh] bg-ink-50/40">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl text-ink-950">Statistical workspace</h1>
            <p className="mt-1 text-sm text-ink-500">R · Stata · Python style — regression, ANOVA, survival, multilevel</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-ink-200 bg-white px-4 py-2 text-xs text-ink-600 shadow-soft">
              {isPro ? <span className="font-semibold text-lumen-700">Pro · unlimited</span> : <>Free · <strong>{left === Infinity ? "∞" : left}</strong> of {FREE_LIMIT}</>}
            </div>
            {!isPro && <button onClick={() => setShowUpgrade(true)} className="rounded-full bg-ink-950 px-4 py-2 text-xs font-semibold text-white">Upgrade ${PRO_PRICE}/mo</button>}
          </div>
        </div>

        {showUpgrade && (
          <div className="mt-6 rounded-2xl border border-lumen-200 bg-lumen-50 p-6">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 text-lumen-700" />
              <div className="flex-1">
                <h3 className="font-semibold">Upgrade to Pro</h3>
                <p className="mt-1 text-sm text-ink-600">Unlimited analyses for ${PRO_PRICE}/month.</p>
                <div className="mt-4 flex gap-3">
                  <button onClick={() => { setPro(true); setShowUpgrade(false); }} className="rounded-full bg-ink-950 px-5 py-2 text-sm font-semibold text-white">Activate Pro (demo)</button>
                  <button onClick={() => setShowUpgrade(false)} className="rounded-full border px-5 py-2 text-sm">Later</button>
                  <Link href="/pricing" className="py-2 text-sm text-lumen-700 underline">Plans</Link>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border bg-white p-6 shadow-soft">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><FileSpreadsheet className="h-4 w-4 text-lumen-600" /> 1. Data</h2>
              <label className="mt-4 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-ink-200 px-4 py-8 hover:border-lumen-300">
                <Upload className="h-8 w-8 text-ink-400" /><span className="mt-2 text-sm font-medium">CSV upload</span>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
              </label>
              {fileName && <p className="mt-3 text-sm"><span className="font-medium">{fileName}</span>{rows && ` · ${rows.length.toLocaleString()} rows`}</p>}
            </div>

            <div className="rounded-2xl border bg-white p-6 shadow-soft">
              <h2 className="text-sm font-semibold">2. Analyses (R / Stata)</h2>
              <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                {STATS_CATALOG.map((c) => (
                  <label key={c.id} className="flex cursor-pointer flex-col rounded-lg px-2 py-1.5 text-sm hover:bg-ink-50">
                    <span className="flex items-center gap-2">
                      <input type="checkbox" checked={selected.includes(c.id)} onChange={(e) => setSelected((p) => e.target.checked ? [...p, c.id] : p.filter((x) => x !== c.id))} />
                      <span className="font-medium">{c.label}</span>
                    </span>
                    <span className="pl-6 text-[10px] text-ink-400">R: {c.r} · Stata: {c.stata}</span>
                  </label>
                ))}
              </div>
            </div>

            {rows && (
              <div className="rounded-2xl border bg-white p-6 shadow-soft">
                <h2 className="text-sm font-semibold">3. Variable roles</h2>
                <div className="mt-3 space-y-3 text-sm">
                  <label className="block">Outcome (Y)
                    <select className="mt-1 w-full rounded-lg border px-2 py-1.5" value={yCol} onChange={(e) => setYCol(e.target.value)}>
                      <option value="">—</option>{columns.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <div>
                    <p className="mb-1">Predictors (X)</p>
                    <div className="flex flex-wrap gap-1">{numericGuess.map((c) => (
                      <button key={c} type="button" onClick={() => toggleX(c)} className={`rounded-full px-2 py-0.5 text-xs ${xCols.includes(c) ? "bg-lumen-600 text-white" : "bg-ink-100"}`}>{c}</button>
                    ))}</div>
                  </div>
                  <label className="block">Factor / group
                    <select className="mt-1 w-full rounded-lg border px-2 py-1.5" value={factorCol} onChange={(e) => setFactorCol(e.target.value)}>
                      <option value="">—</option>{columns.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="block">Second group (χ² / t-test)
                    <select className="mt-1 w-full rounded-lg border px-2 py-1.5" value={groupCol} onChange={(e) => setGroupCol(e.target.value)}>
                      <option value="">—</option>{columns.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="block">Cluster (multilevel)
                    <select className="mt-1 w-full rounded-lg border px-2 py-1.5" value={clusterCol} onChange={(e) => setClusterCol(e.target.value)}>
                      <option value="">—</option>{columns.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">Time<select className="mt-1 w-full rounded-lg border px-2 py-1.5" value={timeCol} onChange={(e) => setTimeCol(e.target.value)}><option value="">—</option>{columns.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
                    <label className="block">Event 0/1<select className="mt-1 w-full rounded-lg border px-2 py-1.5" value={eventCol} onChange={(e) => setEventCol(e.target.value)}><option value="">—</option>{columns.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
                  </div>
                </div>
                <button disabled={!rows || busy} onClick={run} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-ink-950 py-3 text-sm font-semibold text-white disabled:opacity-40">
                  {busy ? "Running…" : (<><Play className="h-4 w-4" /> Run full analysis</>)}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-6 lg:col-span-3">
            {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="h-4 w-4" />{error}</div>}
            {!bundle && !error && <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed bg-white"><Sparkles className="h-8 w-8 text-ink-300" /><p className="mt-3 text-sm text-ink-600">Upload data and run the toolkit</p></div>}

            {bundle && selected.includes("overview") && (
              <Sec title="Dataset overview"><p className="text-sm text-ink-600">{bundle.profile.rows.toLocaleString()} rows × {bundle.profile.columns} cols · missing {formatNumber(bundle.profile.missingPct, 1)}% · dups removed {bundle.removedDuplicates}</p></Sec>
            )}
            {bundle && selected.includes("descriptive") && bundle.descriptive.length > 0 && (
              <Sec title="Descriptives"><Tbl h={["Col", "Mean", "Median", "SD", "Min", "Max"]} r={bundle.descriptive.map((d) => [d.column, formatNumber(d.mean), formatNumber(d.median), formatNumber(d.std), formatNumber(d.min), formatNumber(d.max)])} /></Sec>
            )}
            {bundle && selected.includes("correlation") && (
              <Sec title="Correlations">{bundle.correlations.slice(0, 10).map((c) => <div key={c.a + c.b} className="flex justify-between rounded bg-ink-50 px-3 py-1.5 text-sm"><span>{c.a} ↔ {c.b}</span><strong>{c.r.toFixed(3)}</strong></div>)}</Sec>
            )}

            {isReg(advanced.regression) && (
              <Sec title="Linear regression (lm / regress)">
                <p className="text-sm text-ink-600">{advanced.regression.plainEnglish}</p>
                <Tbl h={["Term", "Est.", "SE", "t", "p"]} r={advanced.regression.coefficients.map((c) => [c.term, formatNumber(c.estimate, 4), formatNumber(c.stdError, 4), formatNumber(c.t, 3), c.p < 0.001 ? "<0.001" : formatNumber(c.p, 4)])} />
              </Sec>
            )}
            {isAnova(advanced.anova) && (
              <Sec title="One-way ANOVA (aov / oneway)">
                <p className="text-sm text-ink-600">{advanced.anova.plainEnglish}</p>
                <Tbl h={["Group", "n", "Mean", "SD"]} r={advanced.anova.groups.map((g) => [g.level, String(g.n), formatNumber(g.mean), formatNumber(g.sd)])} />
              </Sec>
            )}
            {isT(advanced.ttest) && <Sec title="Welch t-test"><p className="text-sm text-ink-600">{advanced.ttest.plainEnglish}</p></Sec>}
            {isChi(advanced.chisq) && <Sec title="Chi-square"><p className="text-sm text-ink-600">{advanced.chisq.plainEnglish}</p></Sec>}
            {isSurv(advanced.survival) && (
              <Sec title="Kaplan–Meier survival">
                <p className="mb-2 text-sm text-ink-600">{advanced.survival.plainEnglish}</p>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eeeef0" />
                      <XAxis dataKey="time" type="number" tick={{ fontSize: 11 }} allowDuplicatedCategory={false} />
                      <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
                      <Tooltip /><Legend />
                      {advanced.survival.curves.map((c, i) => (
                        <Line key={c.group} data={c.points} dataKey="survival" name={c.group} type="stepAfter" dot={false} stroke={i ? "#f59e0b" : "#0c8ce9"} strokeWidth={2} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Sec>
            )}
            {isML(advanced.multilevel) && (
              <Sec title="Multilevel random intercept (lmer / mixed)">
                <p className="text-sm text-ink-600">{advanced.multilevel.plainEnglish}</p>
                <Tbl h={["Term", "Estimate"]} r={advanced.multilevel.fixed.map((f) => [f.term, formatNumber(f.estimate, 4)])} />
                <p className="mt-2 text-xs text-ink-500">ICC={formatNumber(advanced.multilevel.icc, 3)} · groups={advanced.multilevel.nGroups}</p>
              </Sec>
            )}

            {bundle && selected.includes("missing") && (
              <Sec title="Missing data">{bundle.missing.length === 0 ? <p className="text-sm">None</p> : (
                <div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={missingChart} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" unit="%" /><YAxis type="category" dataKey="name" width={90} /><Tooltip /><Bar dataKey="pct" fill="#0c8ce9" /></BarChart></ResponsiveContainer></div>
              )}</Sec>
            )}
            {bundle && selected.includes("quality") && (
              <Sec title="Quality"><ul className="text-sm space-y-1"><li>Duplicates: <strong>{bundle.quality.duplicates}</strong></li><li>Missing: <strong>{formatNumber(bundle.quality.avgMissingPct, 1)}%</strong></li></ul></Sec>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border bg-white p-6 shadow-soft"><h3 className="text-sm font-semibold">{title}</h3><div className="mt-3">{children}</div></section>;
}
function Tbl({ h, r }: { h: string[]; r: string[][] }) {
  return <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b text-ink-500">{h.map((x) => <th key={x} className="py-2 pr-3">{x}</th>)}</tr></thead><tbody>{r.map((row, i) => <tr key={i} className="border-b border-ink-50">{row.map((c, j) => <td key={j} className="py-1.5 pr-3">{c}</td>)}</tr>)}</tbody></table></div>;
}
function isReg(x: unknown): x is RegressionResult { return !!x && typeof x === "object" && (x as RegressionResult).type === "ols"; }
function isAnova(x: unknown): x is AnovaResult { return !!x && typeof x === "object" && (x as AnovaResult).type === "anova"; }
function isT(x: unknown): x is TTestResult { return !!x && typeof x === "object" && (x as TTestResult).type === "ttest"; }
function isChi(x: unknown): x is ChiSquareResult { return !!x && typeof x === "object" && (x as ChiSquareResult).type === "chisq"; }
function isSurv(x: unknown): x is SurvivalResult { return !!x && typeof x === "object" && (x as SurvivalResult).type === "survival"; }
function isML(x: unknown): x is MultilevelResult { return !!x && typeof x === "object" && (x as MultilevelResult).type === "multilevel"; }

"use client";

import { useCallback, useMemo, useState } from "react";
import Papa from "papaparse";
import Link from "next/link";
import { Upload, Play, Lock, Sparkles, FileSpreadsheet, AlertCircle, Download } from "lucide-react";
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
  coxRegression,
  GOALS,
  toolsForGoals,
  buildNarrativeDraft,
  buildRecommendations,
  type GoalId,
  type RegressionResult,
  type AnovaResult,
  type TTestResult,
  type ChiSquareResult,
  type SurvivalResult,
  type MultilevelResult,
  type CoxResult,
} from "@/lib/stats";
import { formatNumber } from "@/lib/utils";
import { useUsage, FREE_LIMIT, PRO_PRICE } from "@/store/usage";

export default function AppPage() {
  const { isPro, remaining, recordAnalysis, setPro } = useUsage();
  const left = remaining();
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [goals, setGoals] = useState<GoalId[]>(["explore", "predict"]);
  const [selected, setSelected] = useState<string[]>(() => toolsForGoals(["explore", "predict"]));
  const [bundle, setBundle] = useState<AnalysisBundle | null>(null);
  const [advanced, setAdvanced] = useState<Record<string, unknown>>({});
  const [draft, setDraft] = useState<string>("");
  const [recs, setRecs] = useState<string[]>([]);
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
      return sample.filter((v) => v !== null && v !== "" && Number.isFinite(Number(v))).length >= sample.length * 0.6;
    });
  }, [rows, columns]);

  const applyGoals = (next: GoalId[]) => {
    setGoals(next);
    setSelected(toolsForGoals(next.length ? next : ["explore"]));
  };

  const toggleGoal = (id: GoalId) => {
    const next = goals.includes(id) ? goals.filter((g) => g !== id) : [...goals, id];
    applyGoals(next);
  };

  const onFile = useCallback((file: File) => {
    setError(null);
    setBundle(null);
    setAdvanced({});
    setDraft("");
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
      const base = analyzeDataset(rows);
      setBundle(base);
      const adv: Record<string, unknown> = {};
      const snippets: string[] = [];

      if (selected.includes("regression") && yCol && xCols.length) {
        const r = linearRegression(rows, yCol, xCols);
        adv.regression = r;
        if ("plainEnglish" in r) snippets.push(r.plainEnglish);
      }
      if (selected.includes("anova") && yCol && factorCol) {
        const r = oneWayAnova(rows, yCol, factorCol);
        adv.anova = r;
        if ("plainEnglish" in r) snippets.push(r.plainEnglish);
      }
      if (selected.includes("ttest") && yCol && groupCol) {
        const r = welchTTest(rows, yCol, groupCol);
        adv.ttest = r;
        if ("plainEnglish" in r) snippets.push(r.plainEnglish);
      }
      if (selected.includes("chisq") && factorCol && groupCol && factorCol !== groupCol) {
        const r = chiSquareTest(rows, factorCol, groupCol);
        adv.chisq = r;
        if ("plainEnglish" in r) snippets.push(r.plainEnglish);
      }
      if (selected.includes("survival") && timeCol && eventCol) {
        const r = kaplanMeier(rows, timeCol, eventCol, groupCol || undefined);
        adv.survival = r;
        if ("plainEnglish" in r) snippets.push(r.plainEnglish);
      }
      if (selected.includes("cox") && timeCol && eventCol && xCols.length) {
        const r = coxRegression(rows, timeCol, eventCol, xCols);
        adv.cox = r;
        if ("plainEnglish" in r) snippets.push(r.plainEnglish);
        if ("recommendations" in r) snippets.push(...r.recommendations.slice(0, 2));
      }
      if (selected.includes("multilevel") && yCol && clusterCol) {
        const r = multilevelRandomIntercept(rows, yCol, clusterCol, xCols);
        adv.multilevel = r;
        if ("plainEnglish" in r) snippets.push(r.plainEnglish);
      }

      setAdvanced(adv);
      const narrative = buildNarrativeDraft({
        fileName: fileName || undefined,
        goals,
        snippets,
        n: base.profile.rows,
        p: base.profile.columns,
      });
      setDraft(narrative);
      setRecs(buildRecommendations(snippets, goals));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  };

  const downloadBrief = () => {
    const blob = new Blob([draft], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lumen-brief-${fileName || "analysis"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
            <p className="mt-1 text-sm text-ink-500">Goals → tools → models (incl. Cox) → client brief you can download</p>
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
              <h2 className="text-sm font-semibold">2. Client expectations / goals</h2>
              <p className="mt-1 text-xs text-ink-500">Pick what the client needs — tools auto-select.</p>
              <div className="mt-3 space-y-2">
                {GOALS.map((g) => (
                  <label key={g.id} className="flex cursor-pointer gap-2 rounded-lg border border-ink-50 px-2 py-2 text-sm hover:bg-ink-50">
                    <input type="checkbox" className="mt-0.5" checked={goals.includes(g.id)} onChange={() => toggleGoal(g.id)} />
                    <span>
                      <span className="font-medium text-ink-900">{g.label}</span>
                      <span className="block text-[11px] text-ink-500">{g.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-6 shadow-soft">
              <h2 className="text-sm font-semibold">3. Tools (auto from goals — editable)</h2>
              <div className="mt-3 max-h-48 space-y-1 overflow-y-auto">
                {STATS_CATALOG.map((c) => (
                  <label key={c.id} className="flex cursor-pointer flex-col rounded px-2 py-1 text-sm hover:bg-ink-50">
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
                <h2 className="text-sm font-semibold">4. Variable roles</h2>
                <div className="mt-3 space-y-3 text-sm">
                  <label className="block">Outcome (Y) / response
                    <select className="mt-1 w-full rounded-lg border px-2 py-1.5" value={yCol} onChange={(e) => setYCol(e.target.value)}>
                      <option value="">—</option>{columns.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <div>
                    <p className="mb-1">Predictors / covariates (X) — regression, Cox, multilevel</p>
                    <div className="flex flex-wrap gap-1">{numericGuess.map((c) => (
                      <button key={c} type="button" onClick={() => toggleX(c)} className={`rounded-full px-2 py-0.5 text-xs ${xCols.includes(c) ? "bg-lumen-600 text-white" : "bg-ink-100"}`}>{c}</button>
                    ))}</div>
                  </div>
                  <label className="block">Factor / group
                    <select className="mt-1 w-full rounded-lg border px-2 py-1.5" value={factorCol} onChange={(e) => setFactorCol(e.target.value)}>
                      <option value="">—</option>{columns.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="block">Second group / strata
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
                  {busy ? "Running…" : (<><Play className="h-4 w-4" /> Run analysis pack</>)}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-6 lg:col-span-3">
            {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="h-4 w-4" />{error}</div>}
            {!bundle && !error && <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed bg-white"><Sparkles className="h-8 w-8 text-ink-300" /><p className="mt-3 text-sm text-ink-600">Set goals, upload data, run the pack</p></div>}

            {draft && (
              <Sec title="Client brief (downloadable)">
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-ink-50 p-4 text-xs text-ink-800">{draft}</pre>
                <button onClick={downloadBrief} className="mt-3 inline-flex items-center gap-2 rounded-full bg-lumen-600 px-4 py-2 text-sm font-semibold text-white">
                  <Download className="h-4 w-4" /> Download brief (.txt)
                </button>
                {recs.length > 0 && (
                  <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink-700">
                    {recs.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                )}
              </Sec>
            )}

            {bundle && selected.includes("overview") && (
              <Sec title="Overview"><p className="text-sm text-ink-600">{bundle.profile.rows.toLocaleString()} × {bundle.profile.columns} · missing {formatNumber(bundle.profile.missingPct, 1)}%</p></Sec>
            )}
            {bundle && selected.includes("descriptive") && bundle.descriptive.length > 0 && (
              <Sec title="Descriptives"><Tbl h={["Col", "Mean", "Median", "SD"]} r={bundle.descriptive.map((d) => [d.column, formatNumber(d.mean), formatNumber(d.median), formatNumber(d.std)])} /></Sec>
            )}
            {bundle && selected.includes("correlation") && (
              <Sec title="Correlations">{bundle.correlations.slice(0, 8).map((c) => <div key={c.a + c.b} className="flex justify-between text-sm"><span>{c.a} ↔ {c.b}</span><strong>{c.r.toFixed(3)}</strong></div>)}</Sec>
            )}

            {isReg(advanced.regression) && (
              <Sec title="OLS regression"><p className="text-sm text-ink-600">{advanced.regression.plainEnglish}</p>
                <Tbl h={["Term", "Est", "SE", "t", "p"]} r={advanced.regression.coefficients.map((c) => [c.term, formatNumber(c.estimate, 4), formatNumber(c.stdError, 4), formatNumber(c.t, 3), c.p < 0.001 ? "<0.001" : formatNumber(c.p, 4)])} /></Sec>
            )}
            {isAnova(advanced.anova) && <Sec title="ANOVA"><p className="text-sm text-ink-600">{advanced.anova.plainEnglish}</p></Sec>}
            {isT(advanced.ttest) && <Sec title="t-test"><p className="text-sm text-ink-600">{advanced.ttest.plainEnglish}</p></Sec>}
            {isChi(advanced.chisq) && <Sec title="Chi-square"><p className="text-sm text-ink-600">{advanced.chisq.plainEnglish}</p></Sec>}

            {isSurv(advanced.survival) && (
              <Sec title="Kaplan–Meier">
                <p className="mb-2 text-sm text-ink-600">{advanced.survival.plainEnglish}</p>
                <div className="h-52"><ResponsiveContainer width="100%" height="100%"><LineChart>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="time" type="number" allowDuplicatedCategory={false} /><YAxis domain={[0, 1]} /><Tooltip /><Legend />
                  {advanced.survival.curves.map((c, i) => <Line key={c.group} data={c.points} dataKey="survival" name={c.group} type="stepAfter" dot={false} stroke={i ? "#f59e0b" : "#0c8ce9"} strokeWidth={2} />)}
                </LineChart></ResponsiveContainer></div>
              </Sec>
            )}

            {isCox(advanced.cox) && (
              <Sec title="Cox proportional hazards (coxph / stcox)">
                <p className="text-sm text-ink-600">{advanced.cox.plainEnglish}</p>
                <p className="mt-1 text-xs text-ink-400">n={advanced.cox.n} · events={advanced.cox.events}</p>
                <Tbl h={["Covariate", "coef", "HR", "SE", "z", "p"]} r={advanced.cox.coefficients.map((c) => [c.term, formatNumber(c.coef, 4), formatNumber(c.hr, 3), formatNumber(c.se, 4), formatNumber(c.z, 3), c.p < 0.001 ? "<0.001" : formatNumber(c.p, 4)])} />
              </Sec>
            )}
            {"cox" in advanced && advanced.cox && "error" in (advanced.cox as object) && (
              <Sec title="Cox"><p className="text-sm text-amber-700">{(advanced.cox as { error: string }).error}</p></Sec>
            )}

            {isML(advanced.multilevel) && (
              <Sec title="Multilevel (lmer / mixed)">
                <p className="text-sm text-ink-600">{advanced.multilevel.plainEnglish}</p>
                <Tbl h={["Term", "Estimate"]} r={advanced.multilevel.fixed.map((f) => [f.term, formatNumber(f.estimate, 4)])} />
              </Sec>
            )}

            {bundle && selected.includes("missing") && (
              <Sec title="Missing">{bundle.missing.length === 0 ? <p className="text-sm">None</p> : (
                <div className="h-40"><ResponsiveContainer width="100%" height="100%"><BarChart data={missingChart} layout="vertical"><XAxis type="number" unit="%" /><YAxis type="category" dataKey="name" width={80} /><Bar dataKey="pct" fill="#0c8ce9" /></BarChart></ResponsiveContainer></div>
              )}</Sec>
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
function isCox(x: unknown): x is CoxResult { return !!x && typeof x === "object" && (x as CoxResult).type === "cox"; }
function isML(x: unknown): x is MultilevelResult { return !!x && typeof x === "object" && (x as MultilevelResult).type === "multilevel"; }

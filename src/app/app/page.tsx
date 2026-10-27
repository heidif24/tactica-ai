"use client";

import { useCallback, useMemo, useState } from "react";
import Papa from "papaparse";
import Link from "next/link";
import { Upload, Play, Lock, Sparkles, AlertCircle, Download, FileText } from "lucide-react";
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
  downloadText,
  downloadHtml,
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
import { useUsage, FREE_LIMIT } from "@/store/usage";
import { WorkspaceShell, Panel, ResultCard } from "@/components/WorkspaceShell";
import { AuthGate, type AuthUser } from "@/components/AuthGate";
import { useGeoPrice } from "@/hooks/useGeoPrice";

export default function AppPage() {
  const { isPro, setPro } = useUsage();
  const { price } = useGeoPrice();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
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

  const onAuth = useCallback((u: AuthUser | null) => {
    setUser(u);
    setAuthChecked(true);
  }, []);

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
    if (!user && !isPro) {
      setError("Verify your email before uploading.");
      return;
    }
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
  }, [user, isPro]);

  const run = async () => {
    if (!rows) return;
    if (!user && !isPro) {
      setError("Verify your email first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const usageRes = await fetch("/api/usage/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPro }),
      });
      const usageData = await usageRes.json();
      if (!usageRes.ok) {
        setShowUpgrade(true);
        setError(usageData.error || "Free allowance used.");
        setBusy(false);
        return;
      }
      if (user && typeof usageData.remaining === "number" && usageData.remaining !== Infinity) {
        setUser({ ...user, freeRemaining: usageData.remaining, freeUsed: FREE_LIMIT - usageData.remaining });
      }

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
      }
      if (selected.includes("multilevel") && yCol && clusterCol) {
        const r = multilevelRandomIntercept(rows, yCol, clusterCol, xCols);
        adv.multilevel = r;
        if ("plainEnglish" in r) snippets.push(r.plainEnglish);
      }
      setAdvanced(adv);
      setDraft(buildNarrativeDraft({ fileName: fileName || undefined, goals, snippets, n: base.profile.rows, p: base.profile.columns }));
      setRecs(buildRecommendations(snippets, goals));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  };

  const baseName = `lumen-brief-${(fileName || "analysis").replace(/\.csv$/i, "")}`;
  const downloadTxt = () => downloadText(`${baseName}.txt`, draft);
  const downloadPretty = () => downloadHtml(`${baseName}.html`, fileName || "Analysis", draft);

  const missingChart = useMemo(() => {
    if (!bundle) return [];
    return bundle.missing.slice(0, 8).map((m) => ({
      name: m.column.length > 14 ? m.column.slice(0, 12) + "…" : m.column,
      pct: Number(m.pct.toFixed(1)),
    }));
  }, [bundle]);

  const toggleX = (c: string) => setXCols((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const freeLeft = user?.freeRemaining ?? FREE_LIMIT;

  return (
    <WorkspaceShell
      title="Statistical workspace"
      subtitle="Verified email required · 1 free analysis / month · local currency on pricing"
      badge={
        <div className="rounded-full border border-ink-200/80 bg-white/90 px-4 py-2 text-xs text-ink-600 shadow-soft">
          {isPro ? (
            <span className="font-semibold text-lumen-700">Pro · unlimited</span>
          ) : user ? (
            <>
              {user.email} · free left <strong>{freeLeft}</strong>/{FREE_LIMIT}
            </>
          ) : (
            <>Sign in required</>
          )}
        </div>
      }
      actions={
        !isPro ? (
          <button onClick={() => setShowUpgrade(true)} className="btn-primary !px-4 !py-2 text-xs">
            Upgrade {price.proLabel}/mo
          </button>
        ) : null
      }
    >
      {showUpgrade && (
        <div className="mb-8 rounded-2xl border border-lumen-200 bg-gradient-to-br from-lumen-50 to-white p-6 shadow-soft">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 text-lumen-700" />
            <div className="flex-1">
              <h3 className="font-semibold text-ink-950">Upgrade to Pro</h3>
              <p className="mt-1 text-sm text-ink-600">
                Unlimited packs for <strong>{price.proLabel}/month</strong> ({price.note}).
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={() => { setPro(true); setShowUpgrade(false); }} className="btn-primary !py-2 text-sm">Activate Pro (demo)</button>
                <button onClick={() => setShowUpgrade(false)} className="btn-secondary !py-2 text-sm">Later</button>
                <Link href="/pricing" className="py-2 text-sm text-lumen-700 underline">Plans</Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {authChecked && !user && !isPro && (
        <div className="mb-8">
          <AuthGate onReady={onAuth} />
        </div>
      )}
      {!authChecked && <AuthGate onReady={onAuth} />}

      {(user || isPro) && (
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-2">
          <Panel title="Data" step="1">
            <label className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-ink-200/90 bg-gradient-to-b from-ink-50/50 to-white px-4 py-10 transition hover:border-lumen-300 hover:from-lumen-50/40">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lumen-50 text-lumen-600 ring-1 ring-lumen-100">
                <Upload className="h-5 w-5" />
              </div>
              <span className="mt-3 text-sm font-medium text-ink-800">Drop CSV or click to browse</span>
              <span className="mt-1 text-xs text-ink-400">1 free analysis this month after verify</span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            </label>
            {fileName && (
              <p className="mt-3 rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-700">
                <span className="font-semibold text-ink-950">{fileName}</span>
                {rows && ` · ${rows.length.toLocaleString()} rows`}
              </p>
            )}
          </Panel>

          <Panel title="Client expectations" step="2">
            <div className="space-y-2">
              {GOALS.map((g) => (
                <label key={g.id} className={`flex cursor-pointer gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition ${
                  goals.includes(g.id) ? "border-lumen-200 bg-lumen-50/50" : "border-ink-100 hover:bg-ink-50"
                }`}>
                  <input type="checkbox" className="mt-0.5 accent-lumen-600" checked={goals.includes(g.id)} onChange={() => toggleGoal(g.id)} />
                  <span>
                    <span className="font-medium text-ink-900">{g.label}</span>
                    <span className="block text-[11px] text-ink-500">{g.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </Panel>

          <Panel title="Tools" step="3">
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {STATS_CATALOG.map((c) => (
                <label key={c.id} className="flex cursor-pointer flex-col rounded-lg px-2 py-1.5 text-sm hover:bg-ink-50">
                  <span className="flex items-center gap-2">
                    <input type="checkbox" className="accent-lumen-600" checked={selected.includes(c.id)} onChange={(e) => setSelected((p) => e.target.checked ? [...p, c.id] : p.filter((x) => x !== c.id))} />
                    <span className="font-medium">{c.label}</span>
                  </span>
                  <span className="pl-6 text-[10px] text-ink-400">R: {c.r} · Stata: {c.stata}</span>
                </label>
              ))}
            </div>
          </Panel>

          {rows && (
            <Panel title="Variable roles" step="4">
              <div className="space-y-3 text-sm">
                <Field label="Outcome (Y)"><Select value={yCol} onChange={setYCol} options={columns} /></Field>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-ink-600">Predictors (X)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {numericGuess.map((c) => (
                      <button key={c} type="button" onClick={() => toggleX(c)} className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        xCols.includes(c) ? "bg-lumen-600 text-white" : "bg-ink-100"
                      }`}>{c}</button>
                    ))}
                  </div>
                </div>
                <Field label="Factor"><Select value={factorCol} onChange={setFactorCol} options={columns} /></Field>
                <Field label="Group"><Select value={groupCol} onChange={setGroupCol} options={columns} /></Field>
                <Field label="Cluster"><Select value={clusterCol} onChange={setClusterCol} options={columns} /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Time"><Select value={timeCol} onChange={setTimeCol} options={columns} /></Field>
                  <Field label="Event"><Select value={eventCol} onChange={setEventCol} options={columns} /></Field>
                </div>
              </div>
              <button disabled={!rows || busy} onClick={run} className="btn-primary mt-6 w-full disabled:opacity-40">
                {busy ? "Running…" : (<><Play className="h-4 w-4" /> Run analysis pack</>)}
              </button>
            </Panel>
          )}
        </div>

        <div className="space-y-5 lg:col-span-3">
          {error && <div className="flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertCircle className="h-4 w-4" />{error}</div>}
          {!bundle && !error && (
            <div className="flex h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-ink-200 bg-white/60">
              <Sparkles className="h-8 w-8 text-lumen-500" />
              <p className="mt-3 text-sm font-medium text-ink-700">Upload and run after email verify</p>
            </div>
          )}
          {draft && (
            <ResultCard title="Client brief" accent>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-white/80 p-4 text-xs">{draft}</pre>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={downloadTxt} className="btn-accent"><Download className="h-4 w-4" /> .txt</button>
                <button onClick={downloadPretty} className="btn-secondary !py-2.5"><FileText className="h-4 w-4" /> HTML</button>
              </div>
              {recs.length > 0 && <ul className="mt-4 space-y-1 text-sm text-ink-700">{recs.map((r, i) => <li key={i}>• {r}</li>)}</ul>}
            </ResultCard>
          )}
          {bundle && selected.includes("overview") && <ResultCard title="Overview"><p className="text-sm">{bundle.profile.rows} × {bundle.profile.columns}</p></ResultCard>}
          {bundle && selected.includes("descriptive") && bundle.descriptive.length > 0 && (
            <ResultCard title="Descriptives"><Tbl h={["Col", "Mean", "SD"]} r={bundle.descriptive.map((d) => [d.column, formatNumber(d.mean), formatNumber(d.std)])} /></ResultCard>
          )}
          {isReg(advanced.regression) && (
            <ResultCard title="OLS"><p className="text-sm">{advanced.regression.plainEnglish}</p>
              <Tbl h={["Term", "Est", "p"]} r={advanced.regression.coefficients.map((c) => [c.term, formatNumber(c.estimate, 4), c.p < 0.001 ? "<0.001" : formatNumber(c.p, 4)])} /></ResultCard>
          )}
          {isAnova(advanced.anova) && <ResultCard title="ANOVA"><p className="text-sm">{advanced.anova.plainEnglish}</p></ResultCard>}
          {isT(advanced.ttest) && <ResultCard title="t-test"><p className="text-sm">{advanced.ttest.plainEnglish}</p></ResultCard>}
          {isChi(advanced.chisq) && <ResultCard title="Chi-square"><p className="text-sm">{advanced.chisq.plainEnglish}</p></ResultCard>}
          {isSurv(advanced.survival) && (
            <ResultCard title="Kaplan–Meier">
              <p className="mb-2 text-sm">{advanced.survival.plainEnglish}</p>
              <div className="h-48"><ResponsiveContainer width="100%" height="100%"><LineChart>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="time" type="number" allowDuplicatedCategory={false} /><YAxis domain={[0, 1]} /><Tooltip /><Legend />
                {advanced.survival.curves.map((c, i) => <Line key={c.group} data={c.points} dataKey="survival" name={c.group} type="stepAfter" dot={false} stroke={i ? "#f59e0b" : "#0c8ce9"} strokeWidth={2} />)}
              </LineChart></ResponsiveContainer></div>
            </ResultCard>
          )}
          {isCox(advanced.cox) && (
            <ResultCard title="Cox PH">
              <p className="text-sm">{advanced.cox.plainEnglish}</p>
              <Tbl h={["Var", "HR", "p"]} r={advanced.cox.coefficients.map((c) => [c.term, formatNumber(c.hr, 3), c.p < 0.001 ? "<0.001" : formatNumber(c.p, 4)])} />
            </ResultCard>
          )}
          {isML(advanced.multilevel) && <ResultCard title="Multilevel"><p className="text-sm">{advanced.multilevel.plainEnglish}</p></ResultCard>}
          {bundle && selected.includes("missing") && (
            <ResultCard title="Missing">{bundle.missing.length === 0 ? <p className="text-sm">None</p> : (
              <div className="h-36"><ResponsiveContainer width="100%" height="100%"><BarChart data={missingChart} layout="vertical"><XAxis type="number" unit="%" /><YAxis type="category" dataKey="name" width={80} /><Bar dataKey="pct" fill="#0c8ce9" /></BarChart></ResponsiveContainer></div>
            )}</ResultCard>
          )}
        </div>
      </div>
      )}
    </WorkspaceShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-ink-600">{label}<div className="mt-1">{children}</div></label>;
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {options.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}
function Tbl({ h, r }: { h: string[]; r: string[][] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-ink-100">
      <table className="w-full text-left text-xs">
        <thead><tr className="bg-ink-50 text-ink-500">{h.map((x) => <th key={x} className="px-3 py-2">{x}</th>)}</tr></thead>
        <tbody>{r.map((row, i) => <tr key={i} className="border-t border-ink-50">{row.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
function isReg(x: unknown): x is RegressionResult { return !!x && typeof x === "object" && (x as RegressionResult).type === "ols"; }
function isAnova(x: unknown): x is AnovaResult { return !!x && typeof x === "object" && (x as AnovaResult).type === "anova"; }
function isT(x: unknown): x is TTestResult { return !!x && typeof x === "object" && (x as TTestResult).type === "ttest"; }
function isChi(x: unknown): x is ChiSquareResult { return !!x && typeof x === "object" && (x as ChiSquareResult).type === "chisq"; }
function isSurv(x: unknown): x is SurvivalResult { return !!x && typeof x === "object" && (x as SurvivalResult).type === "survival"; }
function isCox(x: unknown): x is CoxResult { return !!x && typeof x === "object" && (x as CoxResult).type === "cox"; }
function isML(x: unknown): x is MultilevelResult { return !!x && typeof x === "object" && (x as MultilevelResult).type === "multilevel"; }

/**
 * Statistical models equivalent to common R / Stata workflows:
 * lm(), aov(), t.test(), chisq.test(), survfit(), lmer()-style random intercepts
 */

import { mean, sd, variance, pt, pf, pchisq, olsSolve, invertMatrix } from "./core";

export type Row = Record<string, string | number | null>;

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function colNums(rows: Row[], c: string): number[] {
  return rows.map((r) => num(r[c])).filter((x): x is number => x !== null);
}

export interface CoefRow {
  term: string;
  estimate: number;
  stdError: number;
  t: number;
  p: number;
}

export interface RegressionResult {
  type: "ols";
  formula: string;
  n: number;
  coefficients: CoefRow[];
  rSquared: number;
  adjRSquared: number;
  fStat: number;
  fP: number;
  residualSE: number;
  dfResidual: number;
  plainEnglish: string;
}

/** Multiple linear regression: y ~ x1 + x2 + ... (with intercept) */
export function linearRegression(
  rows: Row[],
  yCol: string,
  xCols: string[]
): RegressionResult | { error: string } {
  const data: { y: number; x: number[] }[] = [];
  for (const r of rows) {
    const y = num(r[yCol]);
    if (y === null) continue;
    const xs: number[] = [];
    let ok = true;
    for (const c of xCols) {
      const v = num(r[c]);
      if (v === null) {
        ok = false;
        break;
      }
      xs.push(v);
    }
    if (ok) data.push({ y, x: xs });
  }
  const n = data.length;
  const k = xCols.length;
  if (n < k + 2) return { error: `Need at least ${k + 2} complete rows for regression.` };

  const X = data.map((d) => [1, ...d.x]);
  const y = data.map((d) => d.y);
  const beta = olsSolve(X, y);
  if (!beta) return { error: "Could not estimate model (singular design matrix)." };

  const yhat = X.map((row) => row.reduce((s, v, j) => s + v * beta[j], 0));
  const resid = y.map((yi, i) => yi - yhat[i]);
  const ybar = mean(y);
  const sst = y.reduce((s, yi) => s + (yi - ybar) ** 2, 0);
  const sse = resid.reduce((s, e) => s + e * e, 0);
  const ssr = sst - sse;
  const dfRes = n - k - 1;
  const dfMod = k;
  const mse = sse / dfRes;
  const msr = ssr / dfMod;
  const fStat = msr / mse;
  const fP = pf(fStat, dfMod, dfRes);
  const r2 = 1 - sse / sst;
  const adjR2 = 1 - (1 - r2) * ((n - 1) / dfRes);
  const residualSE = Math.sqrt(mse);

  // (X'X)^{-1} * mse for SE
  const XtX: number[][] = Array.from({ length: k + 1 }, () => Array(k + 1).fill(0));
  for (let i = 0; i < n; i++) {
    for (let a = 0; a <= k; a++) {
      for (let b = 0; b <= k; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  const XtXinv = invertMatrix(XtX);
  const terms = ["(Intercept)", ...xCols];
  const coefficients: CoefRow[] = beta.map((est, j) => {
    const se = XtXinv ? Math.sqrt(Math.max(0, XtXinv[j][j] * mse)) : NaN;
    const t = se > 0 ? est / se : NaN;
    const p = pt(t, dfRes);
    return { term: terms[j], estimate: est, stdError: se, t, p };
  });

  const sig = coefficients
    .filter((c) => c.term !== "(Intercept)" && c.p < 0.05)
    .map((c) => c.term);

  const plainEnglish =
    `Linear model of ${yCol} on ${xCols.join(", ")} (n=${n}). ` +
    `R² = ${r2.toFixed(3)} (adjusted ${adjR2.toFixed(3)}). ` +
    `Overall F(${dfMod}, ${dfRes}) = ${fStat.toFixed(2)}, p = ${fP.toExponential(2)}. ` +
    (sig.length
      ? `Predictors significant at 5%: ${sig.join(", ")}.`
      : "No predictors significant at the 5% level.");

  return {
    type: "ols",
    formula: `${yCol} ~ ${xCols.join(" + ")}`,
    n,
    coefficients,
    rSquared: r2,
    adjRSquared: adjR2,
    fStat,
    fP,
    residualSE,
    dfResidual: dfRes,
    plainEnglish,
  };
}

export interface AnovaResult {
  type: "anova";
  factor: string;
  response: string;
  groups: { level: string; n: number; mean: number; sd: number }[];
  dfBetween: number;
  dfWithin: number;
  ssBetween: number;
  ssWithin: number;
  fStat: number;
  p: number;
  plainEnglish: string;
}

/** One-way ANOVA (like Stata oneway / R aov(y ~ factor)) */
export function oneWayAnova(rows: Row[], response: string, factor: string): AnovaResult | { error: string } {
  const groups = new Map<string, number[]>();
  for (const r of rows) {
    const y = num(r[response]);
    const g = r[factor];
    if (y === null || g === null || g === undefined || g === "") continue;
    const key = String(g);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(y);
  }
  if (groups.size < 2) return { error: "Need at least two groups for ANOVA." };

  const all: number[] = [];
  const groupStats: { level: string; n: number; mean: number; sd: number; vals: number[] }[] = [];
  for (const [level, vals] of groups) {
    if (vals.length < 1) continue;
    all.push(...vals);
    groupStats.push({ level, n: vals.length, mean: mean(vals), sd: sd(vals), vals });
  }
  const G = groupStats.length;
  const N = all.length;
  if (N < G + 1) return { error: "Not enough observations for ANOVA." };

  const grand = mean(all);
  let ssBetween = 0;
  let ssWithin = 0;
  for (const g of groupStats) {
    ssBetween += g.n * (g.mean - grand) ** 2;
    for (const v of g.vals) ssWithin += (v - g.mean) ** 2;
  }
  const dfBetween = G - 1;
  const dfWithin = N - G;
  const msB = ssBetween / dfBetween;
  const msW = ssWithin / dfWithin;
  const fStat = msW > 0 ? msB / msW : Infinity;
  const p = pf(fStat, dfBetween, dfWithin);

  return {
    type: "anova",
    factor,
    response,
    groups: groupStats.map(({ level, n, mean: m, sd: s }) => ({ level, n, mean: m, sd: s })),
    dfBetween,
    dfWithin,
    ssBetween,
    ssWithin,
    fStat,
    p,
    plainEnglish:
      `One-way ANOVA of ${response} by ${factor}: F(${dfBetween}, ${dfWithin}) = ${fStat.toFixed(3)}, p = ${p.toExponential(2)}. ` +
      (p < 0.05
        ? "Group means differ significantly."
        : "No significant difference between group means at 5%."),
  };
}

export interface TTestResult {
  type: "ttest";
  groupCol: string;
  valueCol: string;
  groupA: string;
  groupB: string;
  meanA: number;
  meanB: number;
  nA: number;
  nB: number;
  t: number;
  df: number;
  p: number;
  plainEnglish: string;
}

/** Two-sample t-test (Welch) */
export function welchTTest(
  rows: Row[],
  valueCol: string,
  groupCol: string,
  groupA?: string,
  groupB?: string
): TTestResult | { error: string } {
  const map = new Map<string, number[]>();
  for (const r of rows) {
    const y = num(r[valueCol]);
    const g = r[groupCol];
    if (y === null || g === null || g === undefined || g === "") continue;
    const k = String(g);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(y);
  }
  const keys = [...map.keys()];
  if (keys.length < 2) return { error: "Need two groups for t-test." };
  const a = groupA && map.has(groupA) ? groupA : keys[0];
  const b = groupB && map.has(groupB) ? groupB : keys[1];
  const A = map.get(a)!;
  const B = map.get(b)!;
  const mA = mean(A);
  const mB = mean(B);
  const vA = variance(A);
  const vB = variance(B);
  const se = Math.sqrt(vA / A.length + vB / B.length);
  const t = se > 0 ? (mA - mB) / se : 0;
  const df =
    se > 0
      ? (vA / A.length + vB / B.length) ** 2 /
        ((vA / A.length) ** 2 / (A.length - 1) + (vB / B.length) ** 2 / (B.length - 1))
      : A.length + B.length - 2;
  const p = pt(t, df);

  return {
    type: "ttest",
    groupCol,
    valueCol,
    groupA: a,
    groupB: b,
    meanA: mA,
    meanB: mB,
    nA: A.length,
    nB: B.length,
    t,
    df,
    p,
    plainEnglish:
      `Welch t-test of ${valueCol} between ${a} (mean ${mA.toFixed(3)}, n=${A.length}) and ${b} (mean ${mB.toFixed(3)}, n=${B.length}): ` +
      `t = ${t.toFixed(3)}, df ≈ ${df.toFixed(1)}, p = ${p.toExponential(2)}. ` +
      (p < 0.05 ? "Means differ significantly." : "No significant mean difference at 5%."),
  };
}

export interface ChiSquareResult {
  type: "chisq";
  rowVar: string;
  colVar: string;
  table: { levels: string[]; counts: number[][] };
  chi2: number;
  df: number;
  p: number;
  plainEnglish: string;
}

export function chiSquareTest(rows: Row[], rowVar: string, colVar: string): ChiSquareResult | { error: string } {
  const pairCount = new Map<string, number>();
  const rowLevels = new Set<string>();
  const colLevels = new Set<string>();
  for (const r of rows) {
    const a = r[rowVar];
    const b = r[colVar];
    if (a === null || a === undefined || a === "" || b === null || b === undefined || b === "") continue;
    const ra = String(a);
    const cb = String(b);
    rowLevels.add(ra);
    colLevels.add(cb);
    const key = ra + "\0" + cb;
    pairCount.set(key, (pairCount.get(key) || 0) + 1);
  }
  const R = [...rowLevels];
  const C = [...colLevels];
  if (R.length < 2 || C.length < 2) return { error: "Need at least 2×2 categories for chi-square." };

  const counts = R.map((ri) => C.map((cj) => pairCount.get(ri + "\0" + cj) || 0));
  const rowSum = counts.map((row) => row.reduce((s, x) => s + x, 0));
  const colSum = C.map((_, j) => counts.reduce((s, row) => s + row[j], 0));
  const N = rowSum.reduce((s, x) => s + x, 0);
  let chi2 = 0;
  for (let i = 0; i < R.length; i++) {
    for (let j = 0; j < C.length; j++) {
      const exp = (rowSum[i] * colSum[j]) / N;
      if (exp > 0) chi2 += (counts[i][j] - exp) ** 2 / exp;
    }
  }
  const df = (R.length - 1) * (C.length - 1);
  const p = pchisq(chi2, df);

  return {
    type: "chisq",
    rowVar,
    colVar,
    table: { levels: C, counts },
    chi2,
    df,
    p,
    plainEnglish:
      `Chi-square test of independence: ${rowVar} × ${colVar}. χ²(${df}) = ${chi2.toFixed(3)}, p = ${p.toExponential(2)}. ` +
      (p < 0.05 ? "Variables are associated." : "No significant association at 5%."),
  };
}

export interface SurvivalResult {
  type: "survival";
  timeCol: string;
  eventCol: string;
  groupCol?: string;
  curves: {
    group: string;
    points: { time: number; survival: number; atRisk: number }[];
    medianSurvival: number | null;
  }[];
  plainEnglish: string;
}

/** Kaplan–Meier (Stata sts list / R survfit) */
export function kaplanMeier(
  rows: Row[],
  timeCol: string,
  eventCol: string,
  groupCol?: string
): SurvivalResult | { error: string } {
  const groups = new Map<string, { t: number; e: number }[]>();
  for (const r of rows) {
    const t = num(r[timeCol]);
    const e = num(r[eventCol]);
    if (t === null || t < 0 || e === null) continue;
    const g = groupCol ? String(r[groupCol] ?? "All") : "All";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push({ t, e: e > 0 ? 1 : 0 });
  }
  if (!groups.size) return { error: "No valid survival observations." };

  const curves: SurvivalResult["curves"] = [];
  for (const [group, obs] of groups) {
    obs.sort((a, b) => a.t - b.t);
    const times = [...new Set(obs.map((o) => o.t))].sort((a, b) => a - b);
    let n = obs.length;
    let s = 1;
    const points: { time: number; survival: number; atRisk: number }[] = [{ time: 0, survival: 1, atRisk: n }];
    let median: number | null = null;
    for (const t of times) {
      const events = obs.filter((o) => o.t === t && o.e === 1).length;
      const censored = obs.filter((o) => o.t === t && o.e === 0).length;
      if (events > 0 && n > 0) {
        s *= 1 - events / n;
        points.push({ time: t, survival: s, atRisk: n });
        if (median === null && s <= 0.5) median = t;
      }
      n -= events + censored;
    }
    curves.push({ group, points, medianSurvival: median });
  }

  const medians = curves
    .map((c) => `${c.group}: ${c.medianSurvival ?? "> max follow-up"}`)
    .join("; ");

  return {
    type: "survival",
    timeCol,
    eventCol,
    groupCol,
    curves,
    plainEnglish: `Kaplan–Meier survival on ${timeCol} (event = ${eventCol}). Median survival — ${medians}.`,
  };
}

export interface MultilevelResult {
  type: "multilevel";
  yCol: string;
  groupCol: string;
  xCols: string[];
  fixed: CoefRow[];
  groupVar: number;
  residualVar: number;
  icc: number;
  nGroups: number;
  n: number;
  plainEnglish: string;
}

/**
 * Random-intercept style multilevel model (approximation):
 * 1) Within-group demean y and X
 * 2) Pooled OLS on demeaned data for fixed slopes
 * 3) ICC from between vs within variance of y
 * Comparable in spirit to Stata mixed / R lmer(y ~ x + (1|group))
 */
export function multilevelRandomIntercept(
  rows: Row[],
  yCol: string,
  groupCol: string,
  xCols: string[]
): MultilevelResult | { error: string } {
  const byG = new Map<string, Row[]>();
  for (const r of rows) {
    const g = r[groupCol];
    if (g === null || g === undefined || g === "") continue;
    const key = String(g);
    if (!byG.has(key)) byG.set(key, []);
    byG.get(key)!.push(r);
  }
  if (byG.size < 3) return { error: "Need at least 3 groups for multilevel model." };

  // Group means
  const gMeanY = new Map<string, number>();
  const gMeanX = new Map<string, number[]>();
  for (const [g, rs] of byG) {
    const ys = colNums(rs, yCol);
    if (!ys.length) continue;
    gMeanY.set(g, mean(ys));
    gMeanX.set(
      g,
      xCols.map((c) => mean(colNums(rs, c)))
    );
  }

  // Demeaned regression
  const X: number[][] = [];
  const y: number[] = [];
  for (const [g, rs] of byG) {
    const my = gMeanY.get(g);
    const mx = gMeanX.get(g);
    if (my === undefined || !mx) continue;
    for (const r of rs) {
      const yi = num(r[yCol]);
      if (yi === null) continue;
      const xs: number[] = [];
      let ok = true;
      for (let j = 0; j < xCols.length; j++) {
        const v = num(r[xCols[j]]);
        if (v === null) {
          ok = false;
          break;
        }
        xs.push(v - mx[j]);
      }
      if (!ok) continue;
      y.push(yi - my);
      X.push([1, ...xs]); // intercept on demeaned scale ≈ 0
    }
  }
  if (y.length < xCols.length + 5) return { error: "Not enough complete cases for multilevel model." };

  const beta = olsSolve(X, y);
  if (!beta) return { error: "Multilevel estimation failed (singular)." };

  // Variance components
  const allY = colNums(rows, yCol);
  const between = [...gMeanY.values()];
  const groupVar = variance(between);
  let withinSS = 0;
  let withinN = 0;
  for (const [g, rs] of byG) {
    const my = gMeanY.get(g)!;
    for (const r of rs) {
      const yi = num(r[yCol]);
      if (yi === null) continue;
      withinSS += (yi - my) ** 2;
      withinN++;
    }
  }
  const residualVar = withinN > byG.size ? withinSS / (withinN - byG.size) : 0;
  const icc = groupVar + residualVar > 0 ? groupVar / (groupVar + residualVar) : 0;

  const terms = ["(Intercept)", ...xCols];
  const fixed: CoefRow[] = beta.map((est, j) => ({
    term: terms[j],
    estimate: est,
    stdError: NaN,
    t: NaN,
    p: NaN,
  }));

  return {
    type: "multilevel",
    yCol,
    groupCol,
    xCols,
    fixed,
    groupVar,
    residualVar,
    icc,
    nGroups: byG.size,
    n: y.length,
    plainEnglish:
      `Random-intercept multilevel model: ${yCol} with grouping ${groupCol}` +
      (xCols.length ? ` and fixed predictors ${xCols.join(", ")}` : "") +
      `. ICC = ${icc.toFixed(3)} (${(icc * 100).toFixed(1)}% of variance is between groups). ` +
      `${byG.size} groups, n = ${y.length}.`,
  };
}

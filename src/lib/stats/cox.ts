/**
 * Cox proportional hazards model (partial likelihood).
 * R: survival::coxph() · Stata: stcox
 */

import type { Row } from "./models";
import { mean } from "./core";

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export interface CoxCoef {
  term: string;
  coef: number; // log hazard ratio
  hr: number; // exp(coef)
  se: number;
  z: number;
  p: number;
}

export interface CoxResult {
  type: "cox";
  timeCol: string;
  eventCol: string;
  covariates: string[];
  n: number;
  events: number;
  coefficients: CoxCoef[];
  logLik: number;
  plainEnglish: string;
  recommendations: string[];
}

/** Standard normal two-sided p from z */
function pnorm(z: number): number {
  // Abramowitz & Stegun approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return 2 * (z > 0 ? p : 1 - p > p ? p : 1 - (1 - p));
}

function softMaxWeights(scores: number[]): number[] {
  const m = Math.max(...scores);
  const ex = scores.map((s) => Math.exp(s - m));
  const sum = ex.reduce((a, b) => a + b, 0);
  return ex.map((e) => e / sum);
}

/**
 * Fit Cox PH via Newton–Raphson on partial likelihood.
 * Ties handled with Breslow approximation.
 */
export function coxRegression(
  rows: Row[],
  timeCol: string,
  eventCol: string,
  covariates: string[]
): CoxResult | { error: string } {
  if (!covariates.length) return { error: "Select at least one covariate for Cox regression." };

  type Obs = { t: number; e: number; x: number[] };
  const data: Obs[] = [];
  for (const r of rows) {
    const t = num(r[timeCol]);
    const eRaw = num(r[eventCol]);
    if (t === null || t <= 0 || eRaw === null) continue;
    const x: number[] = [];
    let ok = true;
    for (const c of covariates) {
      const v = num(r[c]);
      if (v === null) {
        ok = false;
        break;
      }
      x.push(v);
    }
    if (ok) data.push({ t, e: eRaw > 0 ? 1 : 0, x });
  }

  const n = data.length;
  const events = data.filter((d) => d.e === 1).length;
  const p = covariates.length;
  if (n < p + 5) return { error: `Need more complete cases (have ${n}, need ≥${p + 5}).` };
  if (events < 3) return { error: "Need at least 3 events for Cox regression." };

  // Center covariates for numerical stability
  const means = covariates.map((_, j) => mean(data.map((d) => d.x[j])));
  for (const d of data) {
    for (let j = 0; j < p; j++) d.x[j] -= means[j];
  }

  data.sort((a, b) => a.t - b.t);

  let beta = Array(p).fill(0);
  let logLik = 0;

  for (let iter = 0; iter < 25; iter++) {
    const grad = Array(p).fill(0);
    const hess = Array.from({ length: p }, () => Array(p).fill(0));
    logLik = 0;

    // Risk sets from the end
    // For each unique event time
    const eventTimes = [...new Set(data.filter((d) => d.e === 1).map((d) => d.t))];
    for (const ti of eventTimes) {
      const risk = data.filter((d) => d.t >= ti);
      const failed = data.filter((d) => d.t === ti && d.e === 1);
      if (!risk.length || !failed.length) continue;

      const scores = risk.map((d) => d.x.reduce((s, xj, j) => s + beta[j] * xj, 0));
      const w = softMaxWeights(scores);

      // mean covariate in risk set
      const meanX = Array(p).fill(0);
      for (let i = 0; i < risk.length; i++) {
        for (let j = 0; j < p; j++) meanX[j] += w[i] * risk[i].x[j];
      }

      for (const f of failed) {
        const xb = f.x.reduce((s, xj, j) => s + beta[j] * xj, 0);
        // log of sum exp
        const m = Math.max(...scores);
        const logSum = m + Math.log(scores.reduce((s, sc) => s + Math.exp(sc - m), 0));
        logLik += xb - logSum;
        for (let j = 0; j < p; j++) grad[j] += f.x[j] - meanX[j];
      }

      // Hessian contribution (Breslow, once per event time × d events scale)
      const d = failed.length;
      for (let j = 0; j < p; j++) {
        for (let k = 0; k < p; k++) {
          let m2 = 0;
          for (let i = 0; i < risk.length; i++) {
            m2 += w[i] * risk[i].x[j] * risk[i].x[k];
          }
          hess[j][k] -= d * (m2 - meanX[j] * meanX[k]);
        }
      }
    }

    // Newton step: beta += -H^{-1} g  (H is negative definite; we solve H delta = -g)
    // Use gauss on -hess for positive system
    const A = hess.map((row, i) => [...row.map((v) => -v), grad[i]]);
    for (let col = 0; col < p; col++) {
      let pivot = col;
      for (let r = col + 1; r < p; r++) {
        if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
      }
      [A[col], A[pivot]] = [A[pivot], A[col]];
      const div = A[col][col];
      if (Math.abs(div) < 1e-12) break;
      for (let j = col; j <= p; j++) A[col][j] /= div;
      for (let r = 0; r < p; r++) {
        if (r === col) continue;
        const f = A[r][col];
        for (let j = col; j <= p; j++) A[r][j] -= f * A[col][j];
      }
    }
    const delta = A.map((row) => row[p]);
    let maxStep = 0;
    for (let j = 0; j < p; j++) {
      beta[j] += delta[j];
      maxStep = Math.max(maxStep, Math.abs(delta[j]));
    }
    if (maxStep < 1e-6) break;
  }

  // Final SE from observed information
  const hess = Array.from({ length: p }, () => Array(p).fill(0));
  const eventTimes = [...new Set(data.filter((d) => d.e === 1).map((d) => d.t))];
  for (const ti of eventTimes) {
    const risk = data.filter((d) => d.t >= ti);
    const failed = data.filter((d) => d.t === ti && d.e === 1);
    if (!risk.length || !failed.length) continue;
    const scores = risk.map((d) => d.x.reduce((s, xj, j) => s + beta[j] * xj, 0));
    const w = softMaxWeights(scores);
    const meanX = Array(p).fill(0);
    for (let i = 0; i < risk.length; i++) {
      for (let j = 0; j < p; j++) meanX[j] += w[i] * risk[i].x[j];
    }
    const d = failed.length;
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < p; k++) {
        let m2 = 0;
        for (let i = 0; i < risk.length; i++) m2 += w[i] * risk[i].x[j] * risk[i].x[k];
        hess[j][k] -= d * (m2 - meanX[j] * meanX[k]);
      }
    }
  }

  // Invert -H for variance
  const I = hess.map((row) => row.map((v) => -v));
  // simple diagonal SE if inversion hard
  const se = Array(p).fill(NaN);
  for (let j = 0; j < p; j++) {
    se[j] = I[j][j] > 1e-12 ? Math.sqrt(1 / I[j][j]) : NaN;
  }

  const coefficients: CoxCoef[] = beta.map((b, j) => {
    const z = se[j] > 0 ? b / se[j] : NaN;
    const pv = Number.isFinite(z) ? Math.min(1, Math.max(0, erfcApprox(Math.abs(z) / Math.SQRT2))) : NaN;
    return {
      term: covariates[j],
      coef: b,
      hr: Math.exp(b),
      se: se[j],
      z,
      p: pv,
    };
  });

  const sig = coefficients.filter((c) => c.p < 0.05);
  const plainEnglish =
    `Cox proportional hazards model on time=${timeCol}, event=${eventCol} (n=${n}, events=${events}). ` +
    (sig.length
      ? `Covariates linked to hazard at 5%: ${sig.map((c) => `${c.term} (HR=${c.hr.toFixed(2)})`).join(", ")}.`
      : "No covariate reached 5% significance for the hazard rate.");

  const recommendations = [
    "Check the proportional hazards idea: effects should be roughly constant over follow-up time.",
    "HR > 1 means higher event rate; HR < 1 means protective association.",
    events < 20
      ? "Few events — treat estimates cautiously and avoid too many covariates."
      : "Event count is reasonable for the number of covariates selected.",
    "Report both coefficient and hazard ratio, with confidence intervals in formal write-ups.",
  ];

  return {
    type: "cox",
    timeCol,
    eventCol,
    covariates,
    n,
    events,
    coefficients,
    logLik,
    plainEnglish,
    recommendations,
  };
}

function erfcApprox(x: number): number {
  // complementary error function approx → 2*(1-Phi(x*sqrt2)) related
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const ans =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
    );
  return x >= 0 ? ans : 2 - ans;
}

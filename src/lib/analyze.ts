/** Client-side data analysis engine for Lumen. */

export type Row = Record<string, string | number | null>;

export interface DatasetProfile {
  rows: number;
  columns: number;
  columnNames: string[];
  numericColumns: string[];
  categoricalColumns: string[];
  missingPct: number;
  columnSummary: {
    name: string;
    type: string;
    nonMissing: number;
    missingPct: number;
    unique: number;
  }[];
}

export interface NumericSummary {
  column: string;
  count: number;
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
}

export interface CorrPair {
  a: string;
  b: string;
  r: number;
}

export interface AnalysisBundle {
  profile: DatasetProfile;
  descriptive: NumericSummary[];
  correlations: CorrPair[];
  missing: { column: string; count: number; pct: number }[];
  quality: {
    duplicates: number;
    constantColumns: string[];
    avgMissingPct: number;
  };
  recommendations: string[];
  cleanedRows: number;
  removedDuplicates: number;
}

function isNumeric(v: unknown): boolean {
  if (v === null || v === undefined || v === "") return false;
  const n = Number(v);
  return Number.isFinite(n);
}

function toNum(v: unknown): number | null {
  if (!isNumeric(v)) return null;
  return Number(v);
}

function mean(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr: number[]) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function std(arr: number[]) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = mean(arr.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

function pearson(x: number[], y: number[]) {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

export function cleanData(rows: Row[]): { rows: Row[]; removedDuplicates: number } {
  const cleaned = rows
    .map((r) => {
      const o: Row = {};
      for (const [k, v] of Object.entries(r)) {
        if (typeof v === "string") {
          const t = v.trim();
          o[k] = t === "" || t.toLowerCase() === "nan" ? null : t;
        } else {
          o[k] = v;
        }
      }
      return o;
    })
    .filter((r) => Object.values(r).some((v) => v !== null && v !== ""));

  const seen = new Set<string>();
  const unique: Row[] = [];
  let removed = 0;
  for (const r of cleaned) {
    const key = JSON.stringify(r);
    if (seen.has(key)) {
      removed++;
      continue;
    }
    seen.add(key);
    unique.push(r);
  }
  return { rows: unique, removedDuplicates: removed };
}

export function analyzeDataset(rawRows: Row[]): AnalysisBundle {
  const { rows, removedDuplicates } = cleanData(rawRows);
  if (!rows.length) throw new Error("No usable rows after cleaning.");

  const columnNames = Object.keys(rows[0]);
  const numericColumns: string[] = [];
  const categoricalColumns: string[] = [];

  for (const c of columnNames) {
    const sample = rows.map((r) => r[c]).filter((v) => v !== null && v !== "");
    const numRatio = sample.filter(isNumeric).length / Math.max(sample.length, 1);
    if (numRatio > 0.7) numericColumns.push(c);
    else categoricalColumns.push(c);
  }

  const columnSummary = columnNames.map((name) => {
    const vals = rows.map((r) => r[name]);
    const nonMissing = vals.filter((v) => v !== null && v !== "").length;
    const unique = new Set(vals.filter((v) => v !== null && v !== "")).size;
    return {
      name,
      type: numericColumns.includes(name) ? "numeric" : "text",
      nonMissing,
      missingPct: ((rows.length - nonMissing) / rows.length) * 100,
      unique,
    };
  });

  const totalCells = rows.length * columnNames.length;
  const missingCells = columnSummary.reduce((s, c) => s + (rows.length - c.nonMissing), 0);

  const profile: DatasetProfile = {
    rows: rows.length,
    columns: columnNames.length,
    columnNames,
    numericColumns,
    categoricalColumns,
    missingPct: (missingCells / Math.max(totalCells, 1)) * 100,
    columnSummary,
  };

  const descriptive: NumericSummary[] = numericColumns.map((c) => {
    const nums = rows.map((r) => toNum(r[c])).filter((n): n is number => n !== null);
    return {
      column: c,
      count: nums.length,
      mean: mean(nums),
      median: median(nums),
      std: std(nums),
      min: nums.length ? Math.min(...nums) : 0,
      max: nums.length ? Math.max(...nums) : 0,
    };
  });

  const correlations: CorrPair[] = [];
  for (let i = 0; i < numericColumns.length; i++) {
    for (let j = i + 1; j < numericColumns.length; j++) {
      const a = numericColumns[i];
      const b = numericColumns[j];
      const pairs = rows
        .map((r) => [toNum(r[a]), toNum(r[b])] as const)
        .filter((p): p is [number, number] => p[0] !== null && p[1] !== null);
      if (pairs.length < 5) continue;
      const r = pearson(pairs.map((p) => p[0]), pairs.map((p) => p[1]));
      correlations.push({ a, b, r });
    }
  }
  correlations.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));

  const missing = columnSummary
    .filter((c) => c.missingPct > 0)
    .map((c) => ({
      column: c.name,
      count: rows.length - c.nonMissing,
      pct: c.missingPct,
    }))
    .sort((a, b) => b.pct - a.pct);

  const constantColumns = columnSummary.filter((c) => c.unique <= 1).map((c) => c.name);

  const recommendations: string[] = [];
  if (missing.length) {
    recommendations.push("Some columns have missing values. Decide whether to fill them, drop the column, or collect more data.");
  }
  if (correlations[0] && Math.abs(correlations[0].r) > 0.7) {
    recommendations.push(`Strong relationship found between "${correlations[0].a}" and "${correlations[0].b}". Explore whether one helps explain the other.`);
  }
  if (removedDuplicates > 0) {
    recommendations.push(`${removedDuplicates} duplicate row(s) were removed during cleaning.`);
  }
  if (constantColumns.length) {
    recommendations.push(`These columns have no variation and may not help analysis: ${constantColumns.join(", ")}.`);
  }
  recommendations.push("Always interpret results with knowledge of how the data was collected.");

  return {
    profile,
    descriptive,
    correlations: correlations.slice(0, 12),
    missing,
    quality: {
      duplicates: removedDuplicates,
      constantColumns,
      avgMissingPct: profile.missingPct,
    },
    recommendations,
    cleanedRows: rows.length,
    removedDuplicates,
  };
}

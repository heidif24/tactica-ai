/** Core numeric helpers – distributions, matrix, summary */

export function mean(a: number[]): number {
  if (!a.length) return NaN;
  return a.reduce((s, x) => s + x, 0) / a.length;
}

export function variance(a: number[], sample = true): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  const ss = a.reduce((s, x) => s + (x - m) ** 2, 0);
  return ss / (sample ? a.length - 1 : a.length);
}

export function sd(a: number[], sample = true): number {
  return Math.sqrt(variance(a, sample));
}

export function median(a: number[]): number {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Regularized incomplete beta (for F and t p-values) */
function betacf(a: number, b: number, x: number): number {
  const maxIt = 200;
  const eps = 3e-7;
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIt; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
}

function betai(a: number, b: number, x: number): number {
  if (x < 0 || x > 1) return NaN;
  const bt =
    x === 0 || x === 1
      ? 0
      : Math.exp(
          lngamma(a + b) - lngamma(a) - lngamma(b) + a * Math.log(x) + b * Math.log(1 - x)
        );
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

function lngamma(z: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** Two-tailed Student t p-value */
export function pt(t: number, df: number): number {
  if (df <= 0 || !Number.isFinite(t)) return NaN;
  const x = df / (df + t * t);
  return betai(df / 2, 0.5, x);
}

/** Upper-tail F p-value */
export function pf(f: number, d1: number, d2: number): number {
  if (f < 0 || d1 <= 0 || d2 <= 0) return NaN;
  const x = d2 / (d2 + d1 * f);
  return betai(d2 / 2, d1 / 2, x);
}

/** Chi-square upper tail via incomplete gamma approximation */
export function pchisq(x: number, df: number): number {
  if (x < 0 || df <= 0) return NaN;
  return 1 - gammp(df / 2, x / 2);
}

function gammp(a: number, x: number): number {
  if (x < 0 || a <= 0) return NaN;
  if (x < a + 1) return gser(a, x);
  return 1 - gcf(a, x);
}

function gser(a: number, x: number): number {
  const gln = lngamma(a);
  let ap = a;
  let sum = 1 / a;
  let del = sum;
  for (let n = 1; n <= 200; n++) {
    ap++;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * 3e-7) {
      return sum * Math.exp(-x + a * Math.log(x) - gln);
    }
  }
  return sum * Math.exp(-x + a * Math.log(x) - gln);
}

function gcf(a: number, x: number): number {
  const gln = lngamma(a);
  let b = x + 1 - a;
  let c = 1 / 1e-30;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-7) break;
  }
  return Math.exp(-x + a * Math.log(x) - gln) * h;
}

/** Solve least squares: beta = (X'X)^{-1} X'y via Gaussian elimination */
export function olsSolve(X: number[][], y: number[]): number[] | null {
  const n = X.length;
  const k = X[0]?.length ?? 0;
  if (!n || !k || y.length !== n) return null;

  // XtX and Xty
  const XtX: number[][] = Array.from({ length: k }, () => Array(k).fill(0));
  const Xty: number[] = Array(k).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < k; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < k; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }

  // Augment [XtX | Xty]
  const A = XtX.map((row, i) => [...row, Xty[i]]);
  for (let col = 0; col < k; col++) {
    let pivot = col;
    for (let r = col + 1; r < k; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    }
    [A[col], A[pivot]] = [A[pivot], A[col]];
    const div = A[col][col];
    if (Math.abs(div) < 1e-12) return null;
    for (let j = col; j <= k; j++) A[col][j] /= div;
    for (let r = 0; r < k; r++) {
      if (r === col) continue;
      const f = A[r][col];
      for (let j = col; j <= k; j++) A[r][j] -= f * A[col][j];
    }
  }
  return A.map((row) => row[k]);
}

export function invertMatrix(M: number[][]): number[][] | null {
  const n = M.length;
  const A = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    }
    [A[col], A[pivot]] = [A[pivot], A[col]];
    const div = A[col][col];
    if (Math.abs(div) < 1e-12) return null;
    for (let j = 0; j < 2 * n; j++) A[col][j] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col];
      for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[col][j];
    }
  }
  return A.map((row) => row.slice(n));
}

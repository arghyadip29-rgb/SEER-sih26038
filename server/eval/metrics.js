// Eval metrics: accuracy, quadratic weighted kappa (the APTOS metric),
// and referable-disease (L2+) sensitivity/specificity (the SIH26038 bar:
// >90% catch rate, >85% correct rejections).

export function accuracy(expected, predicted) {
  if (!expected.length) return 0;
  let hit = 0;
  for (let i = 0; i < expected.length; i++) if (expected[i] === predicted[i]) hit += 1;
  return hit / expected.length;
}

// Quadratic weighted kappa for ratings 0..classes-1.
export function qwk(expected, predicted, classes = 5) {
  const n = expected.length;
  if (!n) return 0;
  const O = Array.from({ length: classes }, () => new Array(classes).fill(0));
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, Math.min(classes - 1, expected[i]));
    const b = Math.max(0, Math.min(classes - 1, predicted[i]));
    O[a][b] += 1;
  }
  const rowSum = O.map((r) => r.reduce((x, y) => x + y, 0));
  const colSum = O[0].map((_, j) => O.reduce((x, r) => x + r[j], 0));
  let num = 0, den = 0;
  for (let i = 0; i < classes; i++) {
    for (let j = 0; j < classes; j++) {
      const w = ((i - j) ** 2) / ((classes - 1) ** 2);
      const e = (rowSum[i] * colSum[j]) / n;
      num += w * O[i][j];
      den += w * e;
    }
  }
  if (den === 0) return 1;
  return 1 - num / den;
}

export function confusion(expected, predicted, classes = 5) {
  const m = Array.from({ length: classes }, () => new Array(classes).fill(0));
  for (let i = 0; i < expected.length; i++) {
    m[Math.max(0, Math.min(classes - 1, expected[i]))][Math.max(0, Math.min(classes - 1, predicted[i]))] += 1;
  }
  return m;
}

// Referable = grade >= 2. Returns sensitivity (catch rate), specificity
// (correct-rejection rate), and raw counts.
export function referableMetrics(expected, predicted, threshold = 2) {
  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (let i = 0; i < expected.length; i++) {
    const e = expected[i] >= threshold, p = predicted[i] >= threshold;
    if (e && p) tp += 1; else if (!e && !p) tn += 1; else if (!e && p) fp += 1; else fn += 1;
  }
  return {
    sensitivity: tp + fn ? tp / (tp + fn) : 1,
    specificity: tn + fp ? tn / (tn + fp) : 1,
    tp, tn, fp, fn,
  };
}

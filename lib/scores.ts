export function calculatePercentage(
  score: number,
  maxScore: number
): number {
  if (maxScore <= 0) return 0;

  return (score / maxScore) * 100;
}

export function calculateDeviationScore(
  score: number,
  mean: number,
  standardDeviation: number
): number {
  if (standardDeviation <= 0) {
    return 50;
  }

  return (
    50 +
    10 *
      ((score - mean) /
        standardDeviation)
  );
}

export function calculateMean(
  scores: number[]
): number {
  if (scores.length === 0) return 0;

  return (
    scores.reduce(
      (sum, score) => sum + score,
      0
    ) / scores.length
  );
}

export function calculateStandardDeviation(
  scores: number[]
): number {
  if (scores.length === 0) return 0;

  const mean = calculateMean(scores);

  const variance =
    scores.reduce(
      (sum, score) =>
        sum +
        Math.pow(score - mean, 2),
      0
    ) / scores.length;

  return Math.sqrt(variance);
}

export function calculateRank(
  score: number,
  scores: number[]
): number {
  return (
    scores.filter(
      (value) => value > score
    ).length + 1
  );
}

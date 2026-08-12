import { mean, sampleStandardDeviation } from "./descriptive";

export interface PairedResult {
  n: number;
  preMean: number;
  postMean: number;
  meanDifference: number;
  t: number | null;
  df: number;
  cohenDz: number | null;
}

export function pairedTTest(pre: number[], post: number[]): PairedResult | null {
  if (pre.length !== post.length || pre.length < 2) return null;
  const differences = post.map((value, index) => value - pre[index]);
  const meanDifference = mean(differences)!;
  const differenceSd = sampleStandardDeviation(differences);
  const t = differenceSd && differenceSd > 0 ? meanDifference / (differenceSd / Math.sqrt(pre.length)) : null;
  return {
    n: pre.length,
    preMean: mean(pre)!,
    postMean: mean(post)!,
    meanDifference,
    t,
    df: pre.length - 1,
    cohenDz: differenceSd && differenceSd > 0 ? meanDifference / differenceSd : null,
  };
}


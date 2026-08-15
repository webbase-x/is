import type { QualityBand } from "./types";

export const traditionalFiveLevelBands: QualityBand[] = [
  { min: 4.51, max: 5, label: "มากที่สุด" },
  { min: 3.51, max: 4.5, label: "มาก" },
  { min: 2.51, max: 3.5, label: "ปานกลาง" },
  { min: 1.51, max: 2.5, label: "น้อย" },
  { min: 1, max: 1.5, label: "น้อยที่สุด" },
];

export const equalWidthFiveLevelBands: QualityBand[] = [
  { min: 4.21, max: 5, label: "มากที่สุด" },
  { min: 3.41, max: 4.2, label: "มาก" },
  { min: 2.61, max: 3.4, label: "ปานกลาง" },
  { min: 1.81, max: 2.6, label: "น้อย" },
  { min: 1, max: 1.8, label: "น้อยที่สุด" },
];

export const defaultFiveLevelBands = traditionalFiveLevelBands;

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function customFiveLevelBands(cuts: number[]): QualityBand[] | null {
  if (cuts.length !== 4 || cuts.some((value) => !Number.isFinite(value))) {
    return null;
  }
  const [veryHigh, high, moderate, low] = cuts.map(round2);
  if (!(5 >= veryHigh && veryHigh > high && high > moderate && moderate > low && low > 1)) {
    return null;
  }
  return [
    { min: veryHigh, max: 5, label: "มากที่สุด" },
    { min: high, max: round2(veryHigh - 0.01), label: "มาก" },
    { min: moderate, max: round2(high - 0.01), label: "ปานกลาง" },
    { min: low, max: round2(moderate - 0.01), label: "น้อย" },
    { min: 1, max: round2(low - 0.01), label: "น้อยที่สุด" },
  ];
}

export function interpretQuality(value: number | null, bands = defaultFiveLevelBands): string {
  if (value === null || !Number.isFinite(value)) return "ข้อมูลไม่เพียงพอ";
  const rounded = round2(value);
  return bands.find((band) => rounded >= band.min && rounded <= band.max)?.label ?? "อยู่นอกช่วงเกณฑ์";
}

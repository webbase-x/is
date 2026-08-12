import type { QualityBand } from "./types";

export const defaultFiveLevelBands: QualityBand[] = [
  { min: 4.51, max: 5, label: "มากที่สุด" },
  { min: 3.51, max: 4.5, label: "มาก" },
  { min: 2.51, max: 3.5, label: "ปานกลาง" },
  { min: 1.51, max: 2.5, label: "น้อย" },
  { min: 1, max: 1.5, label: "น้อยที่สุด" },
];

export function interpretQuality(value: number | null, bands = defaultFiveLevelBands): string {
  if (value === null || !Number.isFinite(value)) return "ข้อมูลไม่เพียงพอ";
  return bands.find((band) => value >= band.min && value <= band.max)?.label ?? "อยู่นอกช่วงเกณฑ์";
}


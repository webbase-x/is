export type NumericMatrix = number[][];

export interface StatReference {
  author: string;
  title: string;
  year?: string;
  note?: string;
}

export interface QualityBand {
  min: number;
  max: number;
  label: string;
}


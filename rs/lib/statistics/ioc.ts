export interface IocItemResult {
  item: number;
  sum: number;
  n: number;
  ioc: number | null;
  passed: boolean;
}

export function calculateIoc(matrix: Array<Array<number | null>>, threshold = 0.5): IocItemResult[] {
  return matrix.map((ratings, index) => {
    const valid = ratings.filter((value): value is number => value === -1 || value === 0 || value === 1);
    const sum = valid.reduce((total, value) => total + value, 0);
    const ioc = valid.length ? sum / valid.length : null;
    return { item: index + 1, sum, n: valid.length, ioc, passed: ioc !== null && ioc >= threshold };
  });
}


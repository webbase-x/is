export interface ItemAnalysisResult {
  difficulty: number | null;
  discrimination: number | null;
  difficultyLabel: string;
  discriminationLabel: string;
}

export const testGroupPercentages = [0.25, 0.27, 0.33, 0.5] as const;

export type TestGroupPercentage = (typeof testGroupPercentages)[number];

export interface TestMatrixItemResult extends ItemAnalysisResult {
  item: number;
  upperCorrect: number;
  lowerCorrect: number;
  selected: boolean;
}

export interface RankedTestRespondent {
  rank: number;
  sourceIndex: number;
  total: number;
  group: "upper" | "middle" | "lower";
}

export interface TestMatrixAnalysis {
  valid: boolean;
  error: string | null;
  respondentCount: number;
  itemCount: number;
  groupPercentage: TestGroupPercentage;
  groupSize: number;
  middleCount: number;
  upperIndexes: number[];
  lowerIndexes: number[];
  totals: number[];
  rankedRespondents: RankedTestRespondent[];
  upperBoundaryTie: boolean;
  lowerBoundaryTie: boolean;
  items: TestMatrixItemResult[];
  selectedItems: number[];
}

export function analyzeItem(upperCorrect: number, lowerCorrect: number, groupSize: number): ItemAnalysisResult {
  if (groupSize <= 0) return { difficulty: null, discrimination: null, difficultyLabel: "ข้อมูลไม่ถูกต้อง", discriminationLabel: "ข้อมูลไม่ถูกต้อง" };
  const difficulty = (upperCorrect + lowerCorrect) / (2 * groupSize);
  const discrimination = (upperCorrect - lowerCorrect) / groupSize;
  const difficultyLabel =
    difficulty < 0.2
      ? "ยากมาก"
      : difficulty < 0.4
        ? "ค่อนข้างยาก"
        : difficulty <= 0.6
          ? "ปานกลาง"
          : difficulty <= 0.8
            ? "ค่อนข้างง่าย"
            : "ง่ายมาก";
  const discriminationLabel =
    discrimination < 0
      ? "ติดลบ · ตรวจสอบข้อสอบ/เฉลย"
      : discrimination < 0.2
        ? "ต่ำ · ควรปรับปรุง"
        : discrimination < 0.3
          ? "พอใช้"
          : discrimination < 0.4
            ? "ดี"
            : "ดีมาก";
  return { difficulty, discrimination, difficultyLabel, discriminationLabel };
}

function emptyAnalysis(
  matrix: number[][],
  groupPercentage: TestGroupPercentage,
  error: string,
): TestMatrixAnalysis {
  return {
    valid: false,
    error,
    respondentCount: matrix.length,
    itemCount: matrix[0]?.length ?? 0,
    groupPercentage,
    groupSize: 0,
    middleCount: 0,
    upperIndexes: [],
    lowerIndexes: [],
    totals: [],
    rankedRespondents: [],
    upperBoundaryTie: false,
    lowerBoundaryTie: false,
    items: [],
    selectedItems: [],
  };
}

export function analyzeTestMatrix(
  matrix: number[][],
  groupPercentage: TestGroupPercentage = 0.27,
): TestMatrixAnalysis {
  const itemCount = matrix[0]?.length ?? 0;
  if (matrix.length < 2) {
    return emptyAnalysis(
      matrix,
      groupPercentage,
      "ต้องมีข้อมูลผู้สอบอย่างน้อย 2 คนเพื่อแบ่งกลุ่มสูงและกลุ่มต่ำ",
    );
  }
  if (!itemCount) {
    return emptyAnalysis(matrix, groupPercentage, "ไม่พบคะแนนรายข้อ");
  }
  const sameWidth = matrix.every((row) => row.length === itemCount);
  const binary = matrix.every((row) =>
    row.every((value) => value === 0 || value === 1),
  );
  if (!sameWidth || !binary) {
    return emptyAnalysis(
      matrix,
      groupPercentage,
      "ทุกแถวต้องมีจำนวนข้อเท่ากันและใช้เฉพาะคะแนน 0 หรือ 1",
    );
  }

  const totals = matrix.map((row) =>
    row.reduce<number>((total, value) => total + value, 0),
  );
  const ranked = totals
    .map((total, sourceIndex) => ({ total, sourceIndex }))
    .sort((a, b) => b.total - a.total || a.sourceIndex - b.sourceIndex);
  const requestedGroupSize = Math.max(
    1,
    Math.round(matrix.length * groupPercentage),
  );
  const groupSize = Math.min(
    Math.floor(matrix.length / 2),
    requestedGroupSize,
  );
  const upperIndexes = ranked
    .slice(0, groupSize)
    .map((entry) => entry.sourceIndex);
  const lowerIndexes = ranked
    .slice(-groupSize)
    .map((entry) => entry.sourceIndex);
  const upperSet = new Set(upperIndexes);
  const lowerSet = new Set(lowerIndexes);
  const rankedRespondents = ranked.map((entry, index) => ({
    rank: index + 1,
    sourceIndex: entry.sourceIndex,
    total: entry.total,
    group: upperSet.has(entry.sourceIndex)
      ? ("upper" as const)
      : lowerSet.has(entry.sourceIndex)
        ? ("lower" as const)
        : ("middle" as const),
  }));

  const upperBoundaryScore = ranked[groupSize - 1]?.total;
  const lowerBoundaryStart = ranked.length - groupSize;
  const lowerBoundaryScore = ranked[lowerBoundaryStart]?.total;
  const upperBoundaryTie = Boolean(
    groupSize < ranked.length &&
      upperBoundaryScore === ranked[groupSize]?.total,
  );
  const lowerBoundaryTie = Boolean(
    lowerBoundaryStart > 0 &&
      lowerBoundaryScore === ranked[lowerBoundaryStart - 1]?.total,
  );

  const items = Array.from({ length: itemCount }, (_, column) => {
    const upperCorrect = upperIndexes.reduce(
      (total, rowIndex) => total + matrix[rowIndex][column],
      0,
    );
    const lowerCorrect = lowerIndexes.reduce(
      (total, rowIndex) => total + matrix[rowIndex][column],
      0,
    );
    const result = analyzeItem(upperCorrect, lowerCorrect, groupSize);
    return {
      item: column + 1,
      upperCorrect,
      lowerCorrect,
      ...result,
      selected:
        result.difficulty !== null &&
        result.difficulty >= 0.2 &&
        result.difficulty <= 0.8 &&
        result.discrimination !== null &&
        result.discrimination >= 0.2,
    };
  });

  return {
    valid: true,
    error: null,
    respondentCount: matrix.length,
    itemCount,
    groupPercentage,
    groupSize,
    middleCount: matrix.length - groupSize * 2,
    upperIndexes,
    lowerIndexes,
    totals,
    rankedRespondents,
    upperBoundaryTie,
    lowerBoundaryTie,
    items,
    selectedItems: items
      .filter((item) => item.selected)
      .map((item) => item.item),
  };
}

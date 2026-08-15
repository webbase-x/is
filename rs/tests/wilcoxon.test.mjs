import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadStatisticsModule(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const require = (specifier) => {
    if (specifier in dependencies) return dependencies[specifier];
    throw new Error(`Unexpected dependency: ${specifier}`);
  };
  new Function("exports", "require", "module", output)(
    module.exports,
    require,
    module,
  );
  return module.exports;
}

async function loadWilcoxon() {
  const descriptive = await loadStatisticsModule("../lib/statistics/descriptive.ts");
  return loadStatisticsModule("../lib/statistics/wilcoxon.ts", {
    "./descriptive": descriptive,
  });
}

test("one-sample Wilcoxon uses the exact two-sided p-value for small samples", async () => {
  const { oneSampleWilcoxon } = await loadWilcoxon();
  const result = oneSampleWilcoxon([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0);

  assert.ok(result);
  assert.equal(result.n, 10);
  assert.equal(result.wPlus, 55);
  assert.equal(result.wMinus, 0);
  assert.equal(result.method, "exact");
  assert.equal(result.pValue, 2 / 2 ** 10);
});

test("one-sample Wilcoxon handles ties and excludes zero differences", async () => {
  const { oneSampleWilcoxon } = await loadWilcoxon();
  const result = oneSampleWilcoxon([8, 10, 12, 7, 13], 10);

  assert.ok(result);
  assert.equal(result.n, 4);
  assert.equal(result.excludedZeros, 1);
  assert.equal(result.wPlus, 5);
  assert.equal(result.wMinus, 5);
  assert.equal(result.pValue, 1);
});


import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("IOC workspace shows sum, IOC, and result columns", async () => {
  const source = await readFile(
    new URL("../components/ResearchStatsApp.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /<th>∑R<\/th>\s*<th>IOC<\/th>\s*<th>ผล<\/th>/);
  assert.match(source, /ไฟล์ล่าสุดที่บันทึก/);
  assert.match(source, /ชื่อจากการถอดความ/);
  for (const format of ["CSV", "XLSX", "DOCX", "PDF", "PNG"]) {
    assert.match(source, new RegExp(`aria-label="[^"]*${format}`));
  }
});

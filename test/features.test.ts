import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "jtb-"));
process.env.DATA_DIR = dir;
const { safeId, dataPath } = await import("../src/store.js");
const { addMemo, deleteMemo, loadMemos } = await import("../src/memo.js");
const { bestPhrase, searchPhrases, PHRASES } = await import("../src/phrases.js");
const { handleText } = await import("../src/handler.js");

after(() => rmSync(dir, { recursive: true, force: true }));

test("safeId keeps LINE ids and hashes anything path-like", () => {
  assert.equal(safeId("C1234abcdEF"), "C1234abcdEF");
  for (const evil of ["../../etc/passwd", "..\..\win.ini", "a/b", ""]) {
    const id = safeId(evil);
    assert.match(id, /^[a-f0-9]{32}$/);
    assert.ok(resolve(dataPath("memos", evil)).startsWith(resolve(dir)));
  }
});

test("phrasebook entries are complete", () => {
  for (const p of PHRASES) {
    assert.ok(p.zh && p.ja && p.kana && p.romaji && p.keywords.length, p.zh);
  }
});

test("phrase lookup", () => {
  assert.equal(bestPhrase("可以刷卡嗎")?.ja, "カードは使えますか？");
  assert.equal(bestPhrase("廁所在哪裡?")?.romaji, "Toire wa doko desu ka?");
  assert.equal(bestPhrase("量子力學"), undefined);
  assert.equal(searchPhrases("想問店員能不能用信用卡")[0].ja, "カードは使えますか？");
});

test("memo add/delete with limits", () => {
  const m = addMemo("g1", "飯店：APA 新宿，訂房代號 AB123", "小明");
  assert.equal(loadMemos("g1").memos.length, 1);
  assert.throws(() => addMemo("g1", "   ", "小明"));
  assert.throws(() => addMemo("g1", "x".repeat(501), "小明"));
  deleteMemo("g1", m.id);
  assert.equal(loadMemos("g1").memos.length, 0);
  assert.throws(() => deleteMemo("g1", 99));
});

test("fast-path commands don't need the LLM", async () => {
  assert.match(await handleText("g2", "小明", "記一下：明天 9:00 新宿站南口集合"), /已記下 #1/);
  assert.match(await handleText("g2", "小明", "記事"), /9:00 新宿站南口/);
  assert.match(await handleText("g2", "小明", "怎麼說「可以刷卡嗎」"), /Kādo wa tsukaemasu ka\?/);
  assert.match(await handleText("g2", "小明", "刪除記事 #1"), /已刪除記事 #1/);
  assert.match(await handleText("g2", "小明", "成員 小華"), /小明、小華/);
  assert.match(await handleText("g2", "小明", "x".repeat(1001)), /太長/);
});

test("bestPhrase handles natural questions and refuses ties", () => {
  assert.equal(bestPhrase("要怎麼跟店員說我想要退稅")?.ja, "免税できますか？");
  assert.equal(bestPhrase("這個可以加熱嗎")?.ja, "温めてもらえますか？");
  assert.equal(bestPhrase("今天天氣如何"), undefined);
});

test("annotateTwd replaces model-made NT$ figures", async () => {
  const { annotateTwd } = await import("../src/fx.js");
  assert.equal(annotateTwd("生ビール 580円（≈NT$176）", 0.2), "生ビール 580円（≈ NT$116）");
  assert.equal(annotateTwd("¥1,300 / NT$999", 0.2), "¥1,300（≈ NT$260）");
  assert.equal(annotateTwd("9:00 集合，4人", 0.2), "9:00 集合，4人");
});

test("stripMarkdown flattens tables, headers and bold", async () => {
  const { stripMarkdown } = await import("../src/agent.js");
  const md = "## 菜單\n| 品名 | 價格 |\n|---|---|\n| **生ビール** | 580円 |";
  assert.equal(stripMarkdown(md), "菜單\n品名｜價格\n生ビール｜580円");
});

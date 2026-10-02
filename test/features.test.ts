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

test("writeJson is atomic and leaves no temp files", async () => {
  const { writeJson, readJson } = await import("../src/store.js");
  const { readdirSync } = await import("node:fs");
  writeJson("ledgers", "atomic", { v: 1 });
  writeJson("ledgers", "atomic", { v: 2 });
  assert.deepEqual(readJson("ledgers", "atomic", {}), { v: 2 });
  assert.ok(readdirSync(join(dir, "ledgers")).every((f) => !f.endsWith(".tmp")));
});

test("AI offline: non-AI commands still work, AI ones get a clear message", async () => {
  const { config } = await import("../src/config.js");
  const original = config.ollamaBaseUrl;
  config.ollamaBaseUrl = "http://127.0.0.1:9/v1"; // nothing listens on port 9
  try {
    assert.match(await handleText("g3", "小明", "記一下：測試"), /已記下/);
    assert.match(await handleText("g3", "小明", "一蘭 5200 我付"), /AI 暫時離線/);
  } finally {
    config.ollamaBaseUrl = original;
  }
});

test("withSpeaker adds the speaker only for '（我）跟X分' phrasing", async () => {
  const { withSpeaker } = await import("../src/tools.js");
  assert.deepEqual(withSpeaker(["小華"], "阿珍", "早餐 1200 我出的，跟小華對分"), ["阿珍", "小華"]);
  assert.deepEqual(withSpeaker(["阿凱"], "小明", "我跟阿凱分"), ["小明", "阿凱"]);
  assert.deepEqual(withSpeaker(["小華", "阿珍"], "小明", "小華跟阿珍分"), ["小華", "阿珍"]);
  assert.deepEqual(withSpeaker(["阿凱"], "小明", "東西是阿凱的，我先幫他付"), ["阿凱"]);
});

test("claimsUnsavedWrite catches 'I logged it' without a tool call", async () => {
  const { claimsUnsavedWrite } = await import("../src/agent.js");
  assert.equal(claimsUnsavedWrite("沒問題，已幫您記錄下來：阿凱買藥妝 ¥6,800", [], "藥妝 6800 我先幫他付"), true);
  assert.equal(claimsUnsavedWrite("沒問題！我幫您記下這筆帳", [], "小華請大家喝咖啡 2400 円"), true);
  assert.equal(claimsUnsavedWrite("已記帳 #1：燒肉 ¥18,000", ["add_expense"], "燒肉 一萬八"), false);
  assert.equal(claimsUnsavedWrite("記事裡已記錄：迪士尼是 10/15", [], "我們迪士尼是哪天？"), false);
});

test("transit questions get a Google Maps link, not an AI route", async () => {
  const { parseRoute, routeReply } = await import("../src/handler.js");
  assert.deepEqual(parseRoute("成田到上野怎麼去？"), { from: "成田", to: "上野" });
  assert.deepEqual(parseRoute("上野 Dormy Inn 從成田要怎麼去"), { from: "成田", to: "上野 Dormy Inn" });
  assert.deepEqual(parseRoute("從新宿到淺草要怎麼搭"), { from: "新宿", to: "淺草" });
  assert.equal(parseRoute("明天幾點集合"), undefined);
  assert.match(routeReply("成田", "上野"), /maps\/dir\/\?api=1&travelmode=transit&origin=%E6%88%90%E7%94%B0/);
  assert.match(await handleText("g9", "小明", "成田到上野怎麼去"), /google\.com\/maps/);
});

test("regressions from real LINE testing", async () => {
  const { annotateTwd } = await import("../src/fx.js");
  const { hasUnverifiedPhrase } = await import("../src/phrases.js");
  const { isUncitedKnowledge } = await import("../src/agent.js");
  const { dropUnsafeLines } = await import("../src/photo.js");
  assert.equal(annotateTwd("1 JPY = 0.2021 TWD；¥6,600", 0.2), "1 JPY = 0.2021 TWD；¥6,600（≈ NT$1,320）");
  assert.equal(hasUnverifiedPhrase("✅ 日文：鳥貴族でカードは使えますか？\n🔤 假名：とりきぞく\n🗣️ 羅馬拼音：Torikizoku"), true);
  assert.equal(isUncitedKnowledge("東京鐵塔".repeat(30), [], false), true);
  assert.equal(isUncitedKnowledge("根據 #1：迪士尼是 10/15，".repeat(10), [], false), false);
  assert.equal(dropUnsafeLines("沒過敏原，也沒酒和藥成分喔！\n這是寶可夢玩偶", []), "這是寶可夢玩偶");
  assert.equal(dropUnsafeLines("⚠️ 過敏原：蝦（エビ）。\n1. コロッケ", ["⚠️ 過敏原：蝦（エビ）"]), "1. コロッケ");
});

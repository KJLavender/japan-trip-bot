import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "jtb-gem-"));
process.env.DATA_DIR = dir;
process.env.GEMINI_API_KEY = "test-key";
const { unknownFragments, lookupTerms } = await import("../src/gemini.js");
const { config } = await import("../src/config.js");
const { FOODS, WIKI_FOODS, findTerms } = await import("../src/knowledge/glossary.js");
after(() => rmSync(dir, { recursive: true, force: true }));

test("unknownFragments skips prices, known words and noise", () => {
  const text = "海老天ぷら 1,200円\nアジフライ定食 980円\n¥500\nもつ鍋・・・1,480円\nA\n上海麺";
  const known = findTerms(text, FOODS, WIKI_FOODS);
  const frags = unknownFragments(text, known);
  assert.ok(frags.includes("もつ鍋"), JSON.stringify(frags));
  assert.ok(!frags.some((f) => f.includes("海老天ぷら")), "fully known words are not sent");
  assert.ok(!frags.some((f) => /\d/.test(f)), "prices are stripped");
});

test("lookupTerms: header key, only asked inputs kept, cached, daily limit", async () => {
  const realFetch = globalThis.fetch;
  const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: String(init.body) });
    const rows = [
      { input: "もつ鍋", ja: "もつ鍋", zh: "牛雜鍋", note: "牛或豬內臟鍋，福岡名物", useful: true },
      { input: "田中商店", useful: false },
      { input: "沒問過的", ja: "x", zh: "y", useful: true },
    ];
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(rows) }] } }] }));
  }) as typeof fetch;
  try {
    const first = await lookupTerms(["もつ鍋", "田中商店"]);
    assert.deepEqual(first.map((t) => t.zh), ["牛雜鍋"]);
    assert.equal(calls[0].headers["x-goog-api-key"], "test-key");
    assert.ok(!calls[0].url.includes("test-key"), "API key must not be in the URL");
    assert.ok(!calls[0].body.includes("小明"), "only fragments are sent");

    const again = await lookupTerms(["もつ鍋", "田中商店"]);
    assert.deepEqual(again.map((t) => t.zh), ["牛雜鍋"]);
    assert.equal(calls.length, 1, "cached answers (incl. useless ones) are not re-sent");

    config.geminiDailyLimit = 1;
    assert.deepEqual(await lookupTerms(["新しい言葉"]), []);
    assert.equal(calls.length, 1, "daily limit respected");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("lookupTerms never throws on API errors", async () => {
  const realFetch = globalThis.fetch;
  config.geminiDailyLimit = 100;
  globalThis.fetch = (async () => new Response("quota", { status: 429 })) as typeof fetch;
  try {
    assert.deepEqual(await lookupTerms(["別の言葉"]), []);
  } finally {
    globalThis.fetch = realFetch;
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";

process.env.OCR_URL = "";
const { classify, analyzeText, pickImage } = await import("../src/photo.js");
const { detectAllergens, detectAlcohol, drugDosage } = await import("../src/knowledge/safety.js");
const { findTerms, FOODS } = await import("../src/knowledge/glossary.js");

test("classify photo text by keywords", () => {
  assert.equal(classify("お品書き\n生ビール 580円\n焼き鳥 980円"), "menu");
  assert.equal(classify("第2類医薬品\n用法・用量 1日3回"), "drug");
  assert.equal(classify("山手線は運転見合わせています。振替輸送を実施"), "notice");
  assert.equal(classify("第十二番 末吉\n願望 待人"), "shrine");
  assert.equal(classify("原材料名：小麦粉\n賞味期限 2026.10.20"), "product");
  assert.equal(classify("ようこそ"), "general");
});

test("menu: allergens, implied allergens, alcohol — by code, not the LLM", () => {
  const a = analyzeText("お品書き\n生ビール 580円\n海老天ぷら 1,200円\n梅酒サワー 520円");
  assert.equal(a.kind, "menu");
  assert.match(a.header.join("\n"), /過敏原：蝦（海老）/);
  assert.match(a.header.join("\n"), /通常也含：小麥（天ぷら）、蛋（天ぷら）/);
  assert.match(a.header.join("\n"), /含酒精：ビール、サワー、梅酒/);
  assert.ok(a.facts.some((f) => f.startsWith("海老＝蝦")));
});

test("words that merely contain an allergen/alcohol trigger don't fire", () => {
  assert.deepEqual(detectAllergens("静かにしてください。確かに。焼きそば"), []);
  assert.deepEqual(detectAlcohol("ノンアルコールビール風飲料"), []);
  assert.deepEqual(detectAlcohol("ノンアルビール と 生ビール"), [{ label: "酒精", matched: ["ビール"] }]);
  assert.deepEqual(detectAlcohol("居酒屋 たなか"), []);
});

test("drug: class, dosage and warnings extracted from the label", () => {
  const a = analyzeText("第2類医薬品 かぜ薬\n用法・用量 1日3回食後\n成人1回2錠 15歳未満は服用しないこと\n眠気等があらわれることがあります");
  assert.equal(a.kind, "drug");
  const h = a.header.join("\n");
  assert.match(h, /第 2 類醫藥品/);
  assert.match(h, /一天 3 次、每次 2 錠、飯後服用/);
  assert.match(h, /可能嗜睡/);
  assert.match(h, /年齡限制/);
  assert.deepEqual(drugDosage("食間に服用"), ["兩餐之間服用"]);
});

test("glossary prefers the longest match (焼きそば is not 蕎麥)", () => {
  const names = findTerms("焼きそば 600円", FOODS).map((t) => t.zh);
  assert.deepEqual(names, ["日式炒麵（不是蕎麥麵）"]);
});

test("pickImage: quoted > own fresh photo > hint wording", () => {
  const now = 1_000_000_000;
  const imgs = [
    { messageId: "a", userId: "U1", at: now - 10 * 60_000 },
    { messageId: "b", userId: "U2", at: now - 60_000 },
  ];
  assert.equal(pickImage(imgs, { text: "隨便", quotedMessageId: "a" }, "U3", now)?.messageId, "a");
  assert.equal(pickImage(imgs, { text: "可以吃嗎" }, "U2", now)?.messageId, "b"); // own, fresh
  assert.equal(pickImage(imgs, { text: "明天幾點集合" }, "U1", now), undefined); // own but stale, no hint
  assert.equal(pickImage(imgs, { text: "這啥" }, "U1", now)?.messageId, "a"); // hint → own latest
  assert.equal(pickImage(imgs, { text: "這啥" }, "U9", now)?.messageId, "b"); // hint → group latest
});

test("OCR misreads: simplified kanji are mapped back, drug class tolerates 第2题医葡品", async () => {
  const { normalizeOcr } = await import("../src/photo.js");
  const { drugClass } = await import("../src/knowledge/safety.js");
  assert.equal(normalizeOcr("胃肠药 细粒 饺子"), "胃腸薬 細粒 餃子");
  assert.equal(normalizeOcr("１日３回"), "1日3回");
  assert.match(drugClass(normalizeOcr("第2题医葡品")) ?? "", /第 2 類/);
  assert.match(drugClass("指定第2類医薬品") ?? "", /指定第 2 類/);
  assert.equal(drugClass("第2回 大会"), undefined);
});

test("real-photo regressions: order sheets are menus, prose with 🗣 isn't a phrase card", async () => {
  const { hasUnverifiedPhrase } = await import("../src/phrases.js");
  assert.equal(classify("お好みにぎり 注文票\nワサビ ありなし\nまぐろ\n※スタッフにご注文ください。お願いします。"), "menu");
  assert.equal(hasUnverifiedPhrase("🗣️ 這是什麼？這是神社的石燈籠"), false);
  assert.equal(hasUnverifiedPhrase("🇯🇵 近くにロッカーはありますか\n🔤 ちかくに\n🗣 chikaku ni"), true);
  const names = findTerms("坦坦面 上海面 ふかひれ姿面 焼売 海老蒸餃子", FOODS).map((t) => t.zh);
  for (const n of ["擔擔麵", "魚翅", "燒賣", "蒸餃", "蝦"]) assert.ok(names.some((x) => x.includes(n)), n);
});

test("prices the model invents are flagged; prices from the photo are not", async () => {
  const { unverifiedPrices } = await import("../src/photo.js");
  assert.deepEqual(unverifiedPrices("上海麺 580円（≈ NT$117）、焼餃子 180円", "上海麺\n焼餃子"), [580, 180]);
  assert.deepEqual(unverifiedPrices("冷奴 180円、生ビール ¥1,200", "冷奴180円\n生ビール 1,200円"), []);
});

test("Wikidata dictionary: loaded, hand-checked entries win, kana words need boundaries", async () => {
  const { WIKI_FOODS } = await import("../src/knowledge/glossary.js");
  assert.ok(WIKI_FOODS.length > 3000, `only ${WIKI_FOODS.length} entries`);
  const zh = (t: string) => findTerms(t, FOODS, WIKI_FOODS).map((x) => x.zh);
  assert.ok(zh("キンメダイ煮付け 1,090円").some((z) => z.includes("金眼鯛")));
  assert.ok(zh("白子ポン酢").some((z) => z.startsWith("白子（魚的精巢")), "curated 白子 must beat Wikidata");
  assert.ok(zh("ブリの照り焼き 650円").includes("鰤魚"));
  // Kana-only species names must not fire inside longer katakana words.
  const ayu = WIKI_FOODS.find((t) => t.ja.includes("アユ"));
  if (ayu) assert.equal(findTerms("ガアユタ", [ayu]).length, 0);
});

test("truncateLines keeps whole lines and marks the cut", async () => {
  const { truncateLines } = await import("../src/photo.js");
  const long = Array.from({ length: 50 }, (_, i) => `第 ${i} 行：一些解說內容`).join("\n");
  const out = truncateLines(long, 120);
  assert.ok(out.length < 160);
  assert.match(out, /^第 0 行/);
  assert.match(out, /內容較長/);
  assert.equal(truncateLines("短", 120), "短");
});

test("katakana compounds ending in a known word still match (ミンチカツ → カツ)", () => {
  const names = findTerms("ミンチカツ ¥130\nエビカツ ¥90", FOODS).map((t) => t.zh);
  assert.ok(names.some((n) => n.includes("炸豬排") || n.includes("蝦")), JSON.stringify(names));
  const katsu = FOODS.find((t) => t.ja.includes("カツ"))!;
  assert.equal(findTerms("カツオのたたき", [katsu]).length, 0, "カツオ (bonito) is not カツ");
});

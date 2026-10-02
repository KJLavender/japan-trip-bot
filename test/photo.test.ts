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

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseExpense } from "../src/expense-parser.js";

const M = ["小明", "小華", "阿珍", "阿凱"];
const p = (t: string, who = "小明") => parseExpense(t, who, M);

test("common phrasings parse completely", () => {
  assert.deepEqual(p("一蘭 ¥5,200 我付，四人分"), { description: "一蘭", amount: 5200, currency: "JPY", payer: "小明", participants: undefined, splitCount: 4 });
  assert.deepEqual(p("我剛剛在唐吉訶德花了 3,300 日圓，我跟阿凱分", "小華"), { description: "唐吉訶德", amount: 3300, currency: "JPY", payer: "小華", participants: ["小華", "阿凱"], splitCount: undefined });
  assert.deepEqual(p("機票台幣 12000 阿珍先付，大家平分"), { description: "機票", amount: 12000, currency: "TWD", payer: "阿珍", participants: undefined, splitCount: undefined });
  assert.deepEqual(p("燒肉 18000 円 阿凱付的，大家分"), { description: "燒肉", amount: 18000, currency: "JPY", payer: "阿凱", participants: undefined, splitCount: undefined });
  assert.deepEqual(p("便利商店 860 円 我付，只有我自己的", "阿珍"), { description: "便利商店", amount: 860, currency: "JPY", payer: "阿珍", participants: ["阿珍"], splitCount: undefined });
  assert.deepEqual(p("燒肉 18000 我付 大家分"), { description: "燒肉", amount: 18000, currency: "JPY", payer: "小明", participants: undefined, splitCount: undefined });
  assert.deepEqual(p("咖啡 NT$300 小華付，小華和阿珍分"), { description: "咖啡", amount: 300, currency: "TWD", payer: "小華", participants: ["小華", "阿珍"], splitCount: undefined });
});

test("ambiguous or non-expense text is left to the LLM", () => {
  assert.equal(p("今天天氣好好，好想吃拉麵"), undefined);
  assert.equal(p("明天 9:00 新宿集合"), undefined);
  assert.equal(p("一蘭 5200 円 加 拉麵 980 円 我付"), undefined); // two amounts
  assert.equal(p("一蘭 5200 円"), undefined); // no payer
  assert.equal(p("一蘭 5200 円 我付"), undefined); // no split info
  assert.equal(p("一蘭 5200 円 路人甲付，大家分"), undefined); // unknown payer
});

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

test("quantities: per-unit multiplies, totals don't, ambiguity asks", async () => {
  const { parseQuantityExpense: q } = await import("../src/expense-parser.js");
  const ask = q("東方娃娃6600日幣總共15隻", "KJ", M);
  assert.equal(ask?.kind, "ask", JSON.stringify(ask));

  const each = q("東方娃娃每隻6600日幣，15隻", "KJ", M);
  assert.equal(each?.kind === "expense" && each.parsed.amount, 99000, JSON.stringify(each));
  assert.equal(each?.kind === "expense" && each.parsed.payer, "KJ");
  assert.deepEqual(each?.kind === "expense" && each.parsed.participants, ["KJ"]);
  assert.match(each?.kind === "expense" ? each.parsed.description : "", /東方娃娃 ×15/);

  const total = q("東方娃娃15隻總共6600", "KJ", M);
  assert.equal(total?.kind === "expense" && total.parsed.amount, 6600, JSON.stringify(total));

  const hotel = q("Dormy Inn 每晚2000 總共4晚", "KJ", M);
  assert.equal(hotel?.kind === "expense" && hotel.parsed.amount, 8000, JSON.stringify(hotel));

  const times = q("扭蛋 500 x 6 我付，大家分", "小明", M);
  assert.equal(times?.kind === "expense" && times.parsed.amount, 3000, JSON.stringify(times));
  assert.equal(times?.kind === "expense" && times.parsed.participants, undefined, "大家分 = everyone");

  assert.equal(q("一蘭 5200 円 我付，4人分", "小明", M), undefined, "a split count isn't a quantity");
  assert.equal(q("燒肉 18000 円 阿凱付的，大家分", "小明", M), undefined);
});

test("full-width comma after a number is not a thousands separator", () => {
  assert.equal(p("一蘭 5200，4人分 我付")?.amount, 5200);
  assert.equal(p("燒肉 18,000 円 我付，大家分")?.amount, 18000);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { addExpense, balances, settle, splitShares, removeExpense, type Ledger } from "../src/ledger.js";

const empty = (): Ledger => ({ members: [], expenses: [], nextId: 1 });

test("splitShares keeps the total exact", () => {
  const shares = splitShares(1000, ["A", "B", "C"]);
  assert.deepEqual([...shares.values()], [334, 333, 333]);
});

test("一蘭 ¥5,200 A 付，四人分", () => {
  const l = empty();
  addExpense(l, { description: "一蘭", payer: "A", amountJpy: 5200, participants: ["A", "B", "C", "D"] });
  assert.deepEqual(Object.fromEntries(balances(l)), { A: 3900, B: -1300, C: -1300, D: -1300 });
  assert.deepEqual(settle(l), [
    { from: "B", to: "A", amountJpy: 1300 },
    { from: "C", to: "A", amountJpy: 1300 },
    { from: "D", to: "A", amountJpy: 1300 },
  ]);
});

test("multiple payers net out with at most n-1 transfers", () => {
  const l = empty();
  addExpense(l, { description: "飯店", payer: "A", amountJpy: 40000, participants: ["A", "B", "C", "D"] });
  addExpense(l, { description: "燒肉", payer: "B", amountJpy: 20000, participants: ["A", "B", "C", "D"] });
  addExpense(l, { description: "咖啡", payer: "C", amountJpy: 1500, participants: ["C", "D"] });
  const transfers = settle(l);
  assert.ok(transfers.length <= 3);
  // Applying the transfers zeroes every balance.
  const bal = balances(l);
  for (const t of transfers) {
    bal.set(t.from, bal.get(t.from)! + t.amountJpy);
    bal.set(t.to, bal.get(t.to)! - t.amountJpy);
  }
  assert.ok([...bal.values()].every((v) => v === 0));
});

test("balances always sum to zero with odd amounts", () => {
  const l = empty();
  addExpense(l, { description: "x", payer: "A", amountJpy: 1001, participants: ["A", "B", "C"] });
  addExpense(l, { description: "y", payer: "C", amountJpy: 777, participants: ["B", "C"] });
  assert.equal([...balances(l).values()].reduce((a, b) => a + b, 0), 0);
});

test("removeExpense and validation", () => {
  const l = empty();
  const e = addExpense(l, { description: "x", payer: "A", amountJpy: 100, participants: ["A", "B"] });
  removeExpense(l, e.id);
  assert.equal(settle(l).length, 0);
  assert.throws(() => removeExpense(l, 99));
  assert.throws(() => addExpense(l, { description: "x", payer: "A", amountJpy: 0, participants: ["A"] }));
});

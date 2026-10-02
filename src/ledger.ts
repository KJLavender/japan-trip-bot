import { readJson, writeJson, archiveJson } from "./store.js";
import { fmtJpy, fmtTwd } from "./fx.js";

export interface Expense {
  id: number;
  description: string;
  payer: string;
  /** Amount in yen. TWD expenses are converted at entry time. */
  amountJpy: number;
  original?: { amount: number; currency: "TWD"; rate: number };
  participants: string[];
  createdAt: string;
}

export interface Ledger {
  members: string[];
  expenses: Expense[];
  nextId: number;
}

export interface Transfer {
  from: string;
  to: string;
  amountJpy: number;
}

export const loadLedger = (chatId: string): Ledger => readJson("ledgers", chatId, { members: [], expenses: [], nextId: 1 });
export const saveLedger = (chatId: string, ledger: Ledger) => writeJson("ledgers", chatId, ledger);
export const archiveLedger = (chatId: string) => archiveJson("ledgers", chatId);

export function addMembers(ledger: Ledger, names: string[]) {
  for (const n of names.map((s) => s.trim()).filter(Boolean)) {
    if (!ledger.members.includes(n)) ledger.members.push(n);
  }
}

export function addExpense(
  ledger: Ledger,
  e: Omit<Expense, "id" | "createdAt">,
): Expense {
  if (!(e.amountJpy > 0)) throw new Error("金額必須大於 0");
  if (e.participants.length === 0) throw new Error("至少要有一位分攤者");
  addMembers(ledger, [e.payer, ...e.participants]);
  const expense: Expense = { ...e, amountJpy: Math.round(e.amountJpy), id: ledger.nextId++, createdAt: new Date().toISOString() };
  ledger.expenses.push(expense);
  return expense;
}

export function removeExpense(ledger: Ledger, id: number): Expense {
  const idx = ledger.expenses.findIndex((e) => e.id === id);
  if (idx < 0) throw new Error(`找不到 #${id} 這筆帳`);
  return ledger.expenses.splice(idx, 1)[0];
}

/** Integer-yen shares; leftover yen goes to the first participants so totals stay exact. */
export function splitShares(amountJpy: number, participants: string[]): Map<string, number> {
  const base = Math.floor(amountJpy / participants.length);
  let remainder = amountJpy - base * participants.length;
  const shares = new Map<string, number>();
  for (const p of participants) {
    shares.set(p, (shares.get(p) ?? 0) + base + (remainder-- > 0 ? 1 : 0));
  }
  return shares;
}

/** Net balance per person: positive = should receive, negative = owes. */
export function balances(ledger: Ledger): Map<string, number> {
  const bal = new Map<string, number>(ledger.members.map((m) => [m, 0]));
  for (const e of ledger.expenses) {
    bal.set(e.payer, (bal.get(e.payer) ?? 0) + e.amountJpy);
    for (const [p, share] of splitShares(e.amountJpy, e.participants)) {
      bal.set(p, (bal.get(p) ?? 0) - share);
    }
  }
  return bal;
}

/** Greedy largest-debtor → largest-creditor matching; at most n-1 transfers. */
export function settle(ledger: Ledger): Transfer[] {
  const debtors: [string, number][] = [];
  const creditors: [string, number][] = [];
  for (const [name, b] of balances(ledger)) {
    if (b < 0) debtors.push([name, -b]);
    else if (b > 0) creditors.push([name, b]);
  }
  debtors.sort((a, b) => b[1] - a[1]);
  creditors.sort((a, b) => b[1] - a[1]);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i][1], creditors[j][1]);
    transfers.push({ from: debtors[i][0], to: creditors[j][0], amountJpy: amt });
    debtors[i][1] -= amt;
    creditors[j][1] -= amt;
    if (debtors[i][1] === 0) i++;
    if (creditors[j][1] === 0) j++;
  }
  return transfers;
}

export function formatExpenses(ledger: Ledger, jpyToTwd: number): string {
  if (ledger.expenses.length === 0) return "目前還沒有任何帳目。";
  const total = ledger.expenses.reduce((s, e) => s + e.amountJpy, 0);
  const lines = ledger.expenses.map((e) => {
    const orig = e.original ? `（原 ${fmtTwd(e.original.amount)}）` : "";
    return `#${e.id} ${e.description} ${fmtJpy(e.amountJpy)}${orig}｜${e.payer} 付｜${e.participants.join("、")} 分`;
  });
  return [...lines, `—`, `總計 ${fmtJpy(total)} ≈ ${fmtTwd(total * jpyToTwd)}`].join("\n");
}

export function formatSettlement(ledger: Ledger, jpyToTwd: number, rateNote: string): string {
  if (ledger.expenses.length === 0) return "目前還沒有任何帳目，不用結算 🎉";
  const transfers = settle(ledger);
  const total = ledger.expenses.reduce((s, e) => s + e.amountJpy, 0);
  const head = `💴 結算（共 ${ledger.expenses.length} 筆，總計 ${fmtJpy(total)} ≈ ${fmtTwd(total * jpyToTwd)}）`;
  if (transfers.length === 0) return `${head}\n大家剛好打平，不用轉帳 🎉`;
  const lines = transfers.map((t) => `${t.from} → ${t.to}：${fmtJpy(t.amountJpy)} ≈ ${fmtTwd(t.amountJpy * jpyToTwd)}`);
  return [head, ...lines, `（匯率 1 JPY = ${jpyToTwd.toFixed(4)} TWD，${rateNote}）`].join("\n");
}

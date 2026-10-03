import type { ImageContent } from "@mariozechner/pi-ai";
import { ask, archiveSession } from "./agent.js";
import { getJpyTwd, fmtJpy, fmtTwd } from "./fx.js";
import {
  loadLedger, saveLedger, addMembers, syncUser, removeExpense, archiveLedger,
  formatExpenses, formatSettlement,
} from "./ledger.js";
import { addMemo, deleteMemo, archiveMemos, formatMemos } from "./memo.js";
import { bestPhrase, formatPhrase } from "./phrases.js";
import { parseExpense, parseQuantityExpense } from "./expense-parser.js";
import { recordExpense } from "./tools.js";
import { config } from "./config.js";

export const HELP = `🗾 ${config.botName} 使用說明
・記帳：@${config.botName} 一蘭 ¥5200 我付，四人分
・成員：成員 小明 小華 阿珍 阿凱
・帳目：列出所有帳目
・結算：算出誰要轉給誰
・刪除 #3：刪掉記錯的帳
・匯率 / 匯率 3000：日圓台幣換算
・救急日文：怎麼說「可以刷卡嗎」
・記事：記一下：飯店是 xxx／記事／刪除記事 #2
・行程問答：明天幾點集合？（根據記事回答）
・拍照解說：傳照片後 @${config.botName} 問「這啥」「可以吃嗎」
・交通：成田到上野怎麼去（給 Google Maps 路線）
・新旅程：封存本趟帳目、記事與對話，重新開始`;

const errorText = (err: unknown) => (err as Error).message;

/**
 * Deterministic commands skip the LLM: faster, free of hallucination,
 * and they fit within LINE's reply-token window.
 */
async function fastPath(chatId: string, senderName: string, text: string): Promise<string | undefined> {
  const t = text.trim();
  if (/^(說明|help|指令)$/i.test(t)) return HELP;

  // 分帳
  if (/^(結算|結帳|算帳)$/.test(t)) {
    const fx = await getJpyTwd();
    return formatSettlement(loadLedger(chatId), fx.jpyToTwd, fx.source);
  }
  if (/^(帳目|明細|記帳紀錄)$/.test(t)) {
    return formatExpenses(loadLedger(chatId), (await getJpyTwd()).jpyToTwd);
  }
  const del = t.match(/^刪除\s*#?(\d+)$/);
  if (del) {
    const ledger = loadLedger(chatId);
    try {
      const e = removeExpense(ledger, Number(del[1]));
      saveLedger(chatId, ledger);
      return `已刪除 #${e.id} ${e.description} ${fmtJpy(e.amountJpy)}`;
    } catch (err) {
      return errorText(err);
    }
  }
  const members = t.match(/^成員[:：\s]\s*(.+)$/);
  if (members) {
    const ledger = loadLedger(chatId);
    addMembers(ledger, members[1].split(/[\s,，、]+/));
    saveLedger(chatId, ledger);
    return `目前成員（${ledger.members.length} 位）：${ledger.members.join("、")}`;
  }
  if (t === "成員") {
    const { members: m } = loadLedger(chatId);
    return m.length ? `目前成員（${m.length} 位）：${m.join("、")}` : "還沒有登記成員，用「成員 小明 小華」登記。";
  }
  const fx = t.match(/^匯率\s*(?:[¥￥]?\s*([\d,]+)\s*(円|日圓|日幣|JPY)?)?$/i);
  if (fx) {
    const rate = await getJpyTwd();
    const head = `💱 1 JPY = ${rate.jpyToTwd.toFixed(4)} TWD（${rate.source}）`;
    if (!fx[1]) return head;
    const jpy = Number(fx[1].replace(/,/g, ""));
    return `${head}\n${fmtJpy(jpy)} ≈ ${fmtTwd(jpy * rate.jpyToTwd)}`;
  }

  // 行程記事
  const memo = t.match(/^(?:記一下|記住|筆記)[:：\s]\s*([\s\S]+)$/);
  if (memo) {
    try {
      const m = addMemo(chatId, memo[1], senderName);
      return `📒 已記下 #${m.id}：${m.text}`;
    } catch (err) {
      return errorText(err);
    }
  }
  if (/^(記事|行程記事|備忘錄)$/.test(t)) return formatMemos(chatId);
  const delMemo = t.match(/^刪除記事\s*#?(\d+)$/);
  if (delMemo) {
    try {
      const m = deleteMemo(chatId, Number(delMemo[1]));
      return `已刪除記事 #${m.id}：${m.text}`;
    } catch (err) {
      return errorText(err);
    }
  }

  // 救急日文：句庫有明確相符的句子才走 fast path，其餘交給 agent
  if (/怎麼說|怎麼講|怎麼問|日文|跟店員說/.test(t)) {
    const quoted = t.match(/[「『"“](.+?)[」』"”]/)?.[1];
    const p = bestPhrase(quoted ?? t);
    if (p) return formatPhrase(p);
  }

  // 交通：不讓 AI 回答路線（實測會編造轉乘），一律給 Google Maps 即時路線
  const route = parseRoute(t);
  if (route) return routeReply(route.from, route.to);

  // 記帳：有數量的先處理（單價 × 數量，說法模糊就反問），再處理一般句型；都不明確才交給 LLM
  const quantity = parseQuantityExpense(t, senderName, loadLedger(chatId).members);
  if (quantity?.kind === "ask") return quantity.message;
  if (quantity?.kind === "expense") {
    try {
      return await recordExpense(chatId, senderName, quantity.parsed);
    } catch (err) {
      return errorText(err);
    }
  }
  const parsed = parseExpense(t, senderName, loadLedger(chatId).members);
  if (parsed) {
    try {
      return await recordExpense(chatId, senderName, parsed);
    } catch (err) {
      return errorText(err);
    }
  }

  if (/^(新旅程|封存)$/.test(t)) {
    archiveLedger(chatId);
    archiveMemos(chatId);
    archiveSession(chatId);
    return "已封存本趟旅程的帳目、記事與對話 🧳 下次旅行再見！";
  }
  return undefined;
}

export interface Sender {
  /** LINE userId; lets the ledger follow display-name changes. */
  id?: string;
  name: string;
}

/** Register the sender as a trip member (following LINE renames) and return their ledger name. */
export function resolveSender(chatId: string, sender: Sender | string): string {
  const { id, name } = typeof sender === "string" ? { id: undefined, name: sender } : sender;
  const ledger = loadLedger(chatId);
  const before = JSON.stringify(ledger);
  const senderName = id ? syncUser(ledger, id, name) : name;
  if (!id && senderName) addMembers(ledger, [senderName]);
  if (JSON.stringify(ledger) !== before) saveLedger(chatId, ledger);
  return senderName;
}

export async function handleText(
  chatId: string,
  sender: Sender | string,
  text: string,
  images: ImageContent[] = [],
): Promise<string> {
  if (text.length > config.maxInputChars) return `訊息太長了（上限 ${config.maxInputChars} 字），請分段再問 🙏`;
  const senderName = resolveSender(chatId, sender);

  if (images.length === 0) {
    const fast = await fastPath(chatId, senderName, text);
    if (fast !== undefined) return fast;
  }
  return ask(chatId, senderName, text, images);
}

const HOW = /(?:要)?(?:怎麼|如何|怎樣)(?:去|走|搭|坐|到|過去)/;

/** "成田到上野怎麼去" / "上野 Dormy Inn 從成田要怎麼去" → { from, to }. */
export function parseRoute(text: string): { from: string; to: string } | undefined {
  const t = text.replace(/[？?。!！]+$/, "").trim();
  const m1 = t.match(new RegExp(`^(?:請問)?(?:從)?\s*(.{1,25}?)\s*(?:到|→|->)\s*(.{1,25}?)\s*${HOW.source}`));
  if (m1) return { from: m1[1].trim(), to: m1[2].trim() };
  const m2 = t.match(new RegExp(`^(.{1,25}?)\s*從\s*(.{1,25}?)\s*${HOW.source}`));
  if (m2) return { from: m2[2].trim(), to: m2[1].trim() };
  return undefined;
}

export function routeReply(from: string, to: string): string {
  const url =
    "https://www.google.com/maps/dir/?api=1&travelmode=transit" +
    `&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}`;
  return (
    `🚆 ${from} → ${to}\n即時路線、時間和票價請看 Google Maps：\n${url}\n\n` +
    "小幫手不自己回答轉乘細節：班次和票價常變動，AI 也容易講錯 🙏"
  );
}

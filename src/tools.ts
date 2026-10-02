import { Type, StringEnum, type TSchema } from "@mariozechner/pi-ai";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { getJpyTwd, fmtJpy, fmtTwd } from "./fx.js";
import {
  loadLedger, saveLedger, addExpense, removeExpense, addMembers,
  formatExpenses, formatSettlement,
} from "./ledger.js";
import { searchPhrases, bestPhrase, formatPhrase } from "./phrases.js";
import { addMemo, deleteMemo } from "./memo.js";

/** Per-chat context. `senderName` is updated before every prompt. */
export interface ChatContext {
  chatId: string;
  senderName: string;
}

const defineTool = <T extends TSchema>(tool: AgentTool<T>): AgentTool<any> => tool;
const text = (t: string) => ({ content: [{ type: "text" as const, text: t }], details: {} });

export function createTools(ctx: ChatContext): AgentTool<any>[] {
  const resolveName = (n: string) => (["我", "me", "自己"].includes(n.trim()) ? ctx.senderName : n.trim());

  const addExpenseTool = defineTool({
    name: "add_expense",
    label: "記帳",
    description:
      "記一筆旅遊花費並分帳。payer 省略或為「我」代表發話者。participants 省略代表全體成員平分。" +
      "若使用者只說「N 人分」而沒有給名字，填 split_count=N，系統會在成員人數相符時自動套用全體成員。",
    parameters: Type.Object({
      description: Type.String({ description: "品項或店名，例如「一蘭拉麵」" }),
      amount: Type.Number({ description: "金額（數字，不含符號與逗號）" }),
      currency: StringEnum(["JPY", "TWD"] as const, { description: "幣別，預設 JPY" }),
      payer: Type.Optional(Type.String({ description: "付款人名字；「我」= 發話者" })),
      participants: Type.Optional(Type.Array(Type.String(), { description: "分攤者名字列表" })),
      split_count: Type.Optional(Type.Number({ description: "分攤人數（只有給人數沒給名字時使用）" })),
    }),
    executionMode: "sequential",
    execute: async (_id, p) => {
      const ledger = loadLedger(ctx.chatId);
      addMembers(ledger, [ctx.senderName]);
      const payer = resolveName(p.payer ?? "我");

      let participants: string[];
      if (p.participants?.length) {
        participants = [...new Set<string>(p.participants.map(resolveName))];
      } else if (p.split_count && p.split_count !== ledger.members.length) {
        throw new Error(
          `目前成員只有 ${ledger.members.length} 位（${ledger.members.join("、")}），和 ${p.split_count} 人分不符。` +
            "請問使用者分攤者的名字，或請大家先用 set_members 登記成員。",
        );
      } else {
        participants = [...ledger.members];
      }

      let amountJpy = p.amount;
      let original: { amount: number; currency: "TWD"; rate: number } | undefined;
      if (p.currency === "TWD") {
        const { jpyToTwd } = await getJpyTwd();
        amountJpy = p.amount / jpyToTwd;
        original = { amount: p.amount, currency: "TWD", rate: jpyToTwd };
      }

      const e = addExpense(ledger, { description: p.description, payer, amountJpy, original, participants });
      saveLedger(ctx.chatId, ledger);
      const { jpyToTwd } = await getJpyTwd();
      const each = e.amountJpy / participants.length;
      return text(
        `已記帳 #${e.id}：${e.description} ${fmtJpy(e.amountJpy)}（≈ ${fmtTwd(e.amountJpy * jpyToTwd)}），` +
          `${payer} 付，${participants.join("、")} 分，每人約 ${fmtJpy(each)}（≈ ${fmtTwd(each * jpyToTwd)}）`,
      );
    },
  });

  const listExpensesTool = defineTool({
    name: "list_expenses",
    label: "帳目",
    description: "列出這趟旅程目前所有帳目與總額。",
    parameters: Type.Object({}),
    execute: async () => text(formatExpenses(loadLedger(ctx.chatId), (await getJpyTwd()).jpyToTwd)),
  });

  const settleTool = defineTool({
    name: "settle_up",
    label: "結算",
    description: "計算誰該轉帳給誰（最少轉帳次數），金額附台幣換算。結果請原封不動轉述給使用者。",
    parameters: Type.Object({}),
    execute: async () => {
      const fx = await getJpyTwd();
      return text(formatSettlement(loadLedger(ctx.chatId), fx.jpyToTwd, fx.source));
    },
  });

  const deleteExpenseTool = defineTool({
    name: "delete_expense",
    label: "刪帳",
    description: "依編號刪除一筆帳目（例如記錯時）。",
    parameters: Type.Object({ id: Type.Number({ description: "帳目編號，例如 3" }) }),
    executionMode: "sequential",
    execute: async (_id, p) => {
      const ledger = loadLedger(ctx.chatId);
      const e = removeExpense(ledger, p.id);
      saveLedger(ctx.chatId, ledger);
      return text(`已刪除 #${e.id} ${e.description} ${fmtJpy(e.amountJpy)}`);
    },
  });

  const setMembersTool = defineTool({
    name: "set_members",
    label: "成員",
    description: "登記這趟旅程的成員名字（會加入現有成員，不會刪除）。",
    parameters: Type.Object({ names: Type.Array(Type.String(), { description: "成員名字" }) }),
    executionMode: "sequential",
    execute: async (_id, p) => {
      const ledger = loadLedger(ctx.chatId);
      addMembers(ledger, [ctx.senderName, ...p.names.map(resolveName)]);
      saveLedger(ctx.chatId, ledger);
      return text(`目前成員（${ledger.members.length} 位）：${ledger.members.join("、")}`);
    },
  });

  const fxRateTool = defineTool({
    name: "fx_rate",
    label: "匯率",
    description: "查詢日圓兌台幣即時匯率，可順便換算金額。",
    parameters: Type.Object({
      amount: Type.Optional(Type.Number({ description: "要換算的金額" })),
      currency: Type.Optional(StringEnum(["JPY", "TWD"] as const, { description: "amount 的幣別，預設 JPY" })),
    }),
    execute: async (_id, p) => {
      const fx = await getJpyTwd();
      let msg = `1 JPY = ${fx.jpyToTwd.toFixed(4)} TWD（1 TWD ≈ ${(1 / fx.jpyToTwd).toFixed(2)} JPY），來源 ${fx.source}，更新 ${fx.updatedAt}`;
      if (p.amount) {
        msg += p.currency === "TWD"
          ? `\n${fmtTwd(p.amount)} ≈ ${fmtJpy(p.amount / fx.jpyToTwd)}`
          : `\n${fmtJpy(p.amount)} ≈ ${fmtTwd(p.amount * fx.jpyToTwd)}`;
      }
      return text(msg);
    },
  });

  const phraseTool = defineTool({
    name: "japanese_phrase",
    label: "救急日文",
    description:
      "查內建、人工校對過的旅遊日文句庫。使用者問「日文怎麼說」時一定要先查。" +
      "有結果就直接採用（不要改寫日文或羅馬拼音）；沒結果才自己翻譯。",
    parameters: Type.Object({ query: Type.String({ description: "想說的中文，例如「可以刷卡嗎」" }) }),
    execute: async (_id, p) => {
      // A clear phrasebook hit is the final answer; don't let the model rewrite it.
      const best = bestPhrase(p.query);
      if (best) return { ...text(formatPhrase(best)), terminate: true };
      const hits = searchPhrases(p.query);
      if (hits.length === 0) return text("句庫沒有相符的句子，請自行翻譯：附上日文、假名、羅馬拼音、中文，並使用です／ます體。");
      // Weak matches: let the model pick one or translate itself.
      return text(hits.map(formatPhrase).join("\n\n"));
    },
  });

  const memoAddTool = defineTool({
    name: "memo_add",
    label: "記事",
    description: "把行程資訊記到群組共用記事（集合時間、飯店地址、訂房代號等）。使用者說「記一下」、「記住」時使用。",
    parameters: Type.Object({ text: Type.String({ description: "要記下的內容，盡量保留原文" }) }),
    executionMode: "sequential",
    execute: async (_id, p) => {
      const memo = addMemo(ctx.chatId, p.text, ctx.senderName);
      return text(`已記下 #${memo.id}：${memo.text}`);
    },
  });

  const memoDeleteTool = defineTool({
    name: "memo_delete",
    label: "刪記事",
    description: "依編號刪除一則行程記事。",
    parameters: Type.Object({ id: Type.Number({ description: "記事編號" }) }),
    executionMode: "sequential",
    execute: async (_id, p) => {
      const memo = deleteMemo(ctx.chatId, p.id);
      return text(`已刪除記事 #${memo.id}：${memo.text}`);
    },
  });

  return [
    addExpenseTool, listExpensesTool, settleTool, deleteExpenseTool, setMembersTool, fxRateTool,
    phraseTool, memoAddTool, memoDeleteTool,
  ];
}

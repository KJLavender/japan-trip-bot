/**
 * Rule-based parser for the common ways people log an expense in chat.
 * Returns undefined unless every field is unambiguous — those go to the LLM instead.
 * Small models drop "我" from "我跟阿凱分" or pretend to have logged things;
 * this path can't do either.
 */
export interface ParsedExpense {
  description: string;
  amount: number;
  currency: "JPY" | "TWD";
  payer: string;
  /** undefined = everyone in the ledger */
  participants?: string[];
  splitCount?: number;
}

const CN_NUM: Record<string, number> = { 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const toNum = (s: string) => (/^\d+$/.test(s) ? Number(s) : CN_NUM[s]);

export function parseExpense(text: string, sender: string, members: string[]): ParsedExpense | undefined {
  const t = text.normalize("NFKC").replace(/\s+/g, " ").trim();

  // Amount + currency. Exactly one amount, otherwise it's ambiguous.
  const amountRe = /(?:(NT\$|台幣|新台幣|¥|￥)\s*([\d,]+)|([\d,]+)\s*(円|日圓|日幣|JPY|元|台幣|塊))/g;
  const amounts = [...t.matchAll(amountRe)];
  let amountMatch = amounts[0];
  let bare: RegExpMatchArray | undefined;
  if (amounts.length === 0) {
    // "燒肉 18000 我付" — a bare number is fine when the sentence clearly talks about paying.
    const nums = [...t.matchAll(/(?<![\d:/])(\d[\d,]{2,})(?![\d:/])/g)];
    if (nums.length !== 1 || !/付|分|請客/.test(t)) return undefined;
    bare = nums[0];
  } else if (amounts.length > 1) {
    return undefined;
  }
  const rawAmount = bare ? bare[1] : (amountMatch![2] ?? amountMatch![3]);
  const amount = Number(rawAmount.replace(/,/g, ""));
  if (!(amount > 0)) return undefined;
  const unit = bare ? "" : (amountMatch![1] ?? amountMatch![4]);
  const currency = /NT\$|台幣|元|塊/.test(unit) || /台幣|NT\$/.test(t) ? "TWD" : "JPY";

  // Payer: 我付 / 阿珍先付 / 阿凱付的 / 我請客. Must be "我" or a known member.
  const names = [...members].sort((a, b) => b.length - a.length);
  const nameAlt = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const who = (s: string) => (s === "我" ? sender : s);
  let payer: string | undefined;
  const payerRe = new RegExp(`(我|${nameAlt || "(?!)"})(?:先|幫忙|幫大家)?(?:付|出|墊|請客)`);
  const pm = t.match(payerRe);
  if (pm) payer = who(pm[1]);
  else if (/我(?:剛剛|剛才)?(?:在|去)?.{0,12}(?:花了|買了|付了)/.test(t)) payer = sender;
  if (!payer) return undefined;

  // Participants.
  let participants: string[] | undefined;
  let splitCount: number | undefined;
  const count = t.match(/([0-9]+|[一二兩三四五六七八九十])\s*(?:個)?人\s*(?:分|平分|均分)/);
  if (/只有我|我自己的|自己的|不用分/.test(t)) {
    participants = [payer === sender ? sender : payer];
  } else if (count) {
    splitCount = toNum(count[1]);
  } else if (/大家|平分|全部人|所有人|均分/.test(t)) {
    participants = undefined;
  } else {
    // 我跟阿凱分 / 小華和阿珍分 / 我、小華、阿凱分
    const listRe = new RegExp(`((?:(?:我|${nameAlt || "(?!)"})\\s*(?:跟|和|與|、|,|，)\\s*)+(?:我|${nameAlt || "(?!)"}))\\s*(?:一起)?\\s*(?:分|平分)`);
    const lm = t.match(listRe);
    if (!lm) return undefined;
    participants = [...new Set(lm[1].split(/\s*(?:跟|和|與|、|,|，)\s*/).map(who))];
  }

  // Description: what's left once amounts, payer and split phrases are removed.
  const description =
    t
      .replace(amountRe, " ")
      .replace(bare ? bare[0] : "", " ")
      .replace(payerRe, " ")
      .replace(/我(?:剛剛|剛才)?(?:在|去)?|花了|買了|付了|只有我自己的|我自己的|自己的|不用分|大家|平分|均分|全部人|所有人|[0-9一二兩三四五六七八九十]\s*(?:個)?人\s*(?:分|平分|均分)?|的|了|，|,|。/g, " ")
      .replace(new RegExp(`(?:我|${nameAlt || "(?!)"})?\\s*(?:跟|和|與|、)\\s*(?:我|${nameAlt || "(?!)"})\\s*(?:一起)?\\s*分?`, "g"), " ")
      .split(/\s+/)
      .filter((w) => w && !/^(分|一起|先|請客)$/.test(w))
      .join(" ")
      .slice(0, 30) || "花費";

  return { description, amount, currency, payer, participants, splitCount };
}

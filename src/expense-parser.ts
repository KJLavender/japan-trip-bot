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
  // Thousands separators only with exactly three digits after the comma: NFKC turns
  // 「6600，15隻」 into "6600,15隻", which must not read as 660,015.
  const amountRe = /(?:(NT\$|台幣|新台幣|¥|￥)\s*(\d{1,3}(?:,\d{3})+|\d+)|(\d{1,3}(?:,\d{3})+|\d+)\s*(円|日圓|日幣|JPY|元|台幣|塊))/g;
  const amounts = [...t.matchAll(amountRe)];
  let amountMatch = amounts[0];
  let bare: RegExpMatchArray | undefined;
  if (amounts.length === 0) {
    // "燒肉 18000 我付" — a bare number is fine when the sentence clearly talks about paying.
    const nums = [...t.matchAll(/(?<![\d:/])(\d{1,3}(?:,\d{3})+|\d{3,})(?![\d:/])/g)];
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

// ---- 數量：「每隻 6600，15 隻」「6600 x 15」「每晚 2000 總共 4 晚」 ----

// 人 is left out on purpose: "4人分" is a split, not a quantity.
const UNIT = "隻|個|晚|張|份|件|盒|瓶|包|杯|碗|串|盤|片|本|台|罐|袋|顆|條";
const UNIT_COUNT = new RegExp(`(\\d+)\\s*(${UNIT})(?!\\s*(?:分|平分))`);
const UNIT_COUNT_ALL = new RegExp(`\\d+\\s*(?:${UNIT})|[x×*＊]\\s*\\d+`, "g");
const ONE_UNIT_BEFORE = new RegExp(`(?:每|一|1)\\s*(?:${UNIT})?\\s*[¥￥]?\\s*$`);
const UNIT_EDGES = new RegExp(`^(?:${UNIT})|(?:${UNIT})$`, "g");

export type QuantityResult = { kind: "ask"; message: string } | { kind: "expense"; parsed: ParsedExpense };

/**
 * Expenses that mention a count. The small model silently read
 * 「東方娃娃 6600 日幣 總共 15 隻」 as a total when the user meant 6600 each,
 * so genuinely ambiguous phrasing gets a question instead of a guess.
 */
export function parseQuantityExpense(text: string, sender: string, members: string[]): QuantityResult | undefined {
  if (text.includes("\n")) return undefined; // several items: leave to the LLM
  const t = text.normalize("NFKC").replace(/\s+/g, " ").trim();

  const unitCount = t.match(UNIT_COUNT);
  const timesCount = t.match(/\d\s*[x×*＊]\s*(\d+)/);
  if (!unitCount && !timesCount) return undefined;
  const qty = Number((unitCount ?? timesCount)![1]);
  const unit = unitCount?.[2] ?? "個";

  const money = [...t.matchAll(/(\d{1,3}(?:,\d{3})+(?!\d)|\d{3,})/g)]
    .map((m) => ({ n: Number(m[1].replace(/,/g, "")), at: m.index! }))
    .filter((m) => m.n !== qty);
  if (money.length !== 1 || !(qty > 1 && qty <= 999)) return undefined;
  const price = money[0].n;
  const before = t.slice(Math.max(0, money[0].at - 4), money[0].at);

  const perUnit = Boolean(timesCount) || ONE_UNIT_BEFORE.test(before);
  const isTotal = /總共|一共|合計|共計|全部|共/.test(before);
  const currency: "JPY" | "TWD" = /台幣|NT\$|元|塊/.test(t) ? "TWD" : "JPY";
  const fmt = (n: number) => (currency === "TWD" ? `NT$${n.toLocaleString("en-US")}` : `¥${n.toLocaleString("en-US")}`);

  if (perUnit === isTotal) {
    return {
      kind: "ask",
      message:
        "🤔 想確認一下是哪一種：\n" +
        `① 每${unit} ${fmt(price)}，${qty} ${unit}一共 ${fmt(price * qty)}\n` +
        `② ${qty} ${unit}加起來一共 ${fmt(price)}\n\n` +
        `請再說一次，例如「每${unit} ${price}，${qty} ${unit}」或「${qty} ${unit}總共 ${price}」`,
    };
  }

  // Payer/split follow the normal parser's rules; with no split mentioned it's the speaker's own purchase.
  const splitSaid = /分|大家|只有|自己/.test(t);
  const base = parseExpense(`${t.replace(UNIT_COUNT_ALL, "")}${splitSaid ? "" : " 只有我自己的"}`, sender, members);
  const fallback = t
    .replace(UNIT_COUNT_ALL, " ")
    .replace(/(?:NT\$|[¥￥])?\s*\d[\d,]*\s*(?:円|日圓|日幣|元|塊|台幣|JPY)?/g, " ")
    .split(/[\s，,。]+/)[0];
  const description =
    (base?.description || fallback || "").replace(/每|總共|一共|合計|共計|全部|共/g, "").replace(UNIT_EDGES, "").trim() || "花費";
  return {
    kind: "expense",
    parsed: {
      description: `${description} ×${qty}`,
      amount: perUnit ? price * qty : price,
      currency,
      payer: base?.payer ?? sender,
      participants: base ? base.participants : [sender],
      splitCount: base?.splitCount,
    },
  };
}

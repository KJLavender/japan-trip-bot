/**
 * Safety facts detected by plain string matching — never by the LLM.
 * A missed hit is possible (unlisted wording); a hallucinated hit is not.
 */

export interface Hit {
  label: string;
  matched: string[];
}

interface Rule {
  label: string;
  words: string[];
  /** Words that contain a trigger but mean something else. */
  except?: string[];
}

function scan(text: string, rules: Rule[]): Hit[] {
  const hits: Hit[] = [];
  for (const r of rules) {
    let t = text;
    for (const e of r.except ?? []) t = t.split(e).join("");
    const matched = r.words.filter((w) => t.includes(w));
    if (matched.length) hits.push({ label: r.label, matched });
  }
  return hits;
}

/** Japan's mandatory allergen labels (特定原材料, 8 items) plus a few common recommended ones. */
const ALLERGENS: Rule[] = [
  { label: "蝦", words: ["えび", "エビ", "海老", "蝦"] },
  // kana かに is omitted: it appears in 静かに, 確かに…
  { label: "蟹", words: ["カニ", "蟹"], except: ["カニカマ"] },
  { label: "小麥", words: ["小麦", "こむぎ"] },
  { label: "蕎麥", words: ["そば粉", "蕎麦", "ソバ", "そば"], except: ["焼きそば", "焼そば", "やきそば", "中華そば", "駅のそば", "のそばに"] },
  { label: "蛋", words: ["卵", "玉子", "たまご", "タマゴ", "エッグ"] },
  { label: "乳製品", words: ["乳成分", "乳製品", "牛乳", "ミルク", "チーズ", "バター", "生クリーム", "ヨーグルト"] },
  { label: "花生", words: ["落花生", "ピーナッツ", "ピーナツ"] },
  { label: "核桃", words: ["くるみ", "クルミ", "胡桃"] },
  { label: "芝麻", words: ["ごま", "ゴマ", "胡麻"] },
  { label: "大豆", words: ["大豆"] },
];

const ALCOHOL: Rule[] = [
  {
    label: "酒精",
    words: [
      "ビール", "ハイボール", "サワー", "チューハイ", "酎ハイ", "日本酒", "焼酎", "梅酒", "ワイン",
      "カクテル", "地酒", "熱燗", "冷酒", "清酒", "ウイスキー", "ウィスキー", "アルコール", "洋酒",
    ],
    // ノンアルコール = alcohol-free; 居酒屋 is just "pub"
    except: ["ノンアルコールビール", "ノンアルビール", "ノンアルコール", "ノンアル", "アルコールフリー", "アルコール0", "居酒屋"],
  },
];

const RAW: Rule[] = [
  { label: "生食", words: ["刺身", "刺し身", "生卵", "卵かけ", "馬刺", "ユッケ", "生牡蠣", "生ガキ", "たたき", "レア", "生しらす"] },
];

const DRUG: Rule[] = [
  { label: "可能嗜睡，服用後不要開車或操作機械", words: ["眠気", "乗物又は機械類の運転", "運転操作をしない"] },
  { label: "有年齡限制，兒童劑量不同或不可服用", words: ["15歳未満", "7歳未満", "小児", "乳児", "幼児"] },
  { label: "孕婦或可能懷孕者需先詢問醫師或藥師", words: ["妊婦", "妊娠"] },
  { label: "哺乳中需注意", words: ["授乳"] },
  { label: "服藥期間避免喝酒", words: ["飲酒", "アルコール"] },
  { label: "不可與其他感冒藥、止痛藥併用", words: ["他のかぜ薬", "解熱鎮痛薬", "併用"] },
  { label: "「食間」是兩餐之間（飯後約 2 小時），不是吃飯時", words: ["食間"] },
];

export const detectAllergens = (text: string) => scan(text, ALLERGENS);
export const detectAlcohol = (text: string) => scan(text, ALCOHOL);
export const detectRaw = (text: string) => scan(text, RAW);
export const detectDrugWarnings = (text: string) => scan(text, DRUG);

/** Japanese OTC drug class (第1類 = strongest, needs a pharmacist). */
export function drugClass(text: string): string | undefined {
  if (/要指導医薬品/.test(text)) return "要指導醫藥品：必須由藥師當面說明才能購買";
  if (/第\s*1\s*類医薬品/.test(text)) return "第 1 類醫藥品：風險最高，需藥師說明";
  if (/指定第\s*2\s*類医薬品/.test(text)) return "指定第 2 類醫藥品：需特別注意的成分，建議詢問藥師";
  if (/第\s*2\s*類医薬品/.test(text)) return "第 2 類醫藥品：一般感冒藥、止痛藥等級";
  if (/第\s*3\s*類医薬品/.test(text)) return "第 3 類醫藥品：風險較低（維他命、整腸劑等）";
  return undefined;
}

/** Pull dosage facts like 1日3回 / 1回2錠 / 食後 straight from the label. */
export function drugDosage(text: string): string[] {
  const out: string[] = [];
  const times = text.match(/1\s*日\s*([0-9０-９]+)\s*回/);
  if (times) out.push(`一天 ${times[1]} 次`);
  const dose = text.match(/1\s*回\s*([0-9０-９]+)\s*(錠|包|カプセル|粒|mL|ml)/);
  if (dose) out.push(`每次 ${dose[1]} ${{ 錠: "錠", 包: "包", カプセル: "顆膠囊", 粒: "粒", mL: "mL", ml: "mL" }[dose[2]]}`);
  if (/食後/.test(text)) out.push("飯後服用");
  else if (/食前/.test(text)) out.push("飯前服用");
  else if (/食間/.test(text)) out.push("兩餐之間服用");
  if (/就寝前/.test(text)) out.push("睡前服用");
  return out;
}

import { existsSync, readFileSync } from "node:fs";

/**
 * Hand-written travel glossary: words a translation app gets "right"
 * but that still leave a Taiwanese traveller unsure what they mean.
 */
export interface Term {
  ja: string[];
  zh: string;
  note?: string;
  /** Allergens this dish usually contains even when the menu doesn't say so. */
  usually?: string[];
  /** Where an entry came from when it isn't hand-checked. */
  source?: "wikidata" | "ai";
}

// ---- 菜單、店內用語 ----
export const MENU_TERMS: Term[] = [
  { ja: ["期間限定", "季節限定"], zh: "期間限定", note: "季節商品，過了這段時間或賣完就沒了" },
  { ja: ["数量限定"], zh: "數量限定", note: "每天只做固定份數，晚點去可能賣完" },
  { ja: ["本日のおすすめ", "本日のオススメ"], zh: "今日推薦", note: "通常是當天進貨最好的食材" },
  { ja: ["おすすめ", "オススメ", "イチオシ"], zh: "店家推薦", note: "多半是招牌或店家最有自信的品項" },
  { ja: ["名物"], zh: "名物", note: "這家店或這個地方的招牌料理" },
  { ja: ["お通し", "突き出し"], zh: "お通し（小菜）", note: "居酒屋入座就會上的小菜，通常會收費（約 300～600 円），不是免費招待" },
  { ja: ["席料", "チャージ", "サービス料"], zh: "座位費／服務費", note: "會另外加在帳單上" },
  { ja: ["税込"], zh: "含稅", note: "標示的價格就是實際要付的" },
  { ja: ["税抜", "税別", "本体価格"], zh: "未稅", note: "結帳時還要另外加 8～10% 消費稅" },
  { ja: ["食券"], zh: "餐券", note: "要先在門口的售票機買餐券，再交給店員" },
  { ja: ["替え玉"], zh: "加麵", note: "博多拉麵常見，湯留著，另外加一球麵（要付費）" },
  { ja: ["大盛り", "大盛"], zh: "大份", note: "有些店免費，有些要加價" },
  { ja: ["特盛"], zh: "特大份" },
  { ja: ["並盛"], zh: "一般份量" },
  { ja: ["食べ放題"], zh: "吃到飽", note: "通常有時間限制（例如 90 分鐘）" },
  { ja: ["飲み放題"], zh: "喝到飽", note: "通常有時間限制，最後點餐（L.O.）比結束早 30 分鐘" },
  { ja: ["ラストオーダー", "L.O."], zh: "最後點餐時間" },
  { ja: ["お代わり自由", "おかわり自由"], zh: "免費續" },
  { ja: ["定食"], zh: "套餐", note: "通常附白飯、味噌湯和醬菜" },
  { ja: ["単品"], zh: "單點" },
  { ja: ["激辛"], zh: "超辣", note: "日本的「激辛」是真的辣" },
  { ja: ["辛口"], zh: "偏辣／偏鹹", note: "用在酒時是「口感較乾爽」，不是辣" },
  { ja: ["甘口"], zh: "偏甜、不辣" },
  { ja: ["硬め", "カタ"], zh: "麵偏硬" },
  { ja: ["柔らかめ", "やわめ"], zh: "麵偏軟" },
  { ja: ["お持ち帰り", "テイクアウト"], zh: "外帶" },
  { ja: ["店内"], zh: "內用" },
  { ja: ["現金のみ"], zh: "只收現金", note: "不能刷卡、不能用交通卡" },
  { ja: ["売り切れ", "売切"], zh: "賣完了" },
];

// ---- 告示、車站 ----
export const NOTICE_TERMS: Term[] = [
  { ja: ["運転見合わせ"], zh: "暫停行駛", note: "目前停駛中，恢復時間不一定" },
  { ja: ["運休"], zh: "停駛（取消班次）" },
  { ja: ["遅延"], zh: "誤點" },
  { ja: ["振替輸送"], zh: "替代運輸", note: "可以拿原本的車票免費改搭公告列出的其他路線" },
  { ja: ["人身事故"], zh: "人身事故", note: "通常會停駛 1 小時以上，建議直接改搭其他路線" },
  { ja: ["直通運転"], zh: "直通運轉", note: "電車會開進其他公司的路線，不用換車" },
  { ja: ["始発"], zh: "首班車" },
  { ja: ["終電"], zh: "末班車" },
  { ja: ["各駅停車"], zh: "每站都停的普通車" },
  { ja: ["快速", "急行", "特急"], zh: "快速／急行／特急", note: "會跳站；特急通常要另外買特急券" },
  { ja: ["女性専用車"], zh: "女性專用車廂", note: "尖峰時段男性不能搭" },
  { ja: ["定休日"], zh: "公休日" },
  { ja: ["準備中"], zh: "準備中", note: "還沒開門或中午休息中，不是在營業" },
  { ja: ["営業中"], zh: "營業中" },
  { ja: ["貸切", "貸し切り"], zh: "包場", note: "今天不對外營業" },
  { ja: ["土足厳禁", "土足禁止"], zh: "禁止穿鞋進入", note: "要脫鞋" },
  { ja: ["撮影禁止"], zh: "禁止拍照" },
  { ja: ["立入禁止", "関係者以外立入禁止"], zh: "禁止進入" },
  { ja: ["整理券"], zh: "號碼牌", note: "公車上車抽的整理券，下車時對照票價表付錢" },
  { ja: ["免税"], zh: "免稅", note: "需出示護照" },
];

// ---- 食物辭典：翻譯 App 翻得出名字，但不知道是什麼 ----
export const FOODS: Term[] = [
  { ja: ["海老", "えび", "エビ"], zh: "蝦", usually: ["蝦"] },
  { ja: ["天ぷら", "天麩羅", "天婦羅"], zh: "天婦羅（裹粉油炸）", usually: ["小麥", "蛋"] },
  { ja: ["天丼"], zh: "天婦羅蓋飯", usually: ["小麥", "蛋"] },
  { ja: ["唐揚げ", "から揚げ", "からあげ"], zh: "日式炸雞塊", usually: ["小麥"] },
  { ja: ["焼き鳥", "焼鳥", "やきとり"], zh: "烤雞肉串", note: "點餐時會問「塩（鹽烤）」還是「タレ（醬烤）」" },
  { ja: ["盛り合わせ"], zh: "綜合拼盤" },
  { ja: ["牡蠣", "カキ"], zh: "牡蠣（蚵仔）" },
  { ja: ["フライ"], zh: "裹麵包粉油炸", usually: ["小麥", "蛋"] },
  { ja: ["カツ", "とんかつ", "豚カツ"], zh: "炸豬排", usually: ["小麥", "蛋"] },
  { ja: ["刺身", "刺し身", "お造り"], zh: "生魚片" },
  { ja: ["寿司", "鮨"], zh: "壽司" },
  { ja: ["丼"], zh: "蓋飯" },
  { ja: ["親子丼"], zh: "雞肉雞蛋蓋飯（親子丼）", usually: ["蛋"] },
  { ja: ["牛丼"], zh: "牛肉蓋飯" },
  { ja: ["豚骨", "とんこつ"], zh: "豚骨（豬骨湯頭）", note: "濃厚系，湯頭偏濃郁" },
  { ja: ["醤油", "しょうゆ"], zh: "醬油口味", usually: ["小麥", "大豆"] },
  { ja: ["味噌", "みそ"], zh: "味噌口味", usually: ["大豆"] },
  // OCR often returns 面 for 麺, so those spellings are listed too.
  { ja: ["担々麺", "坦々麺", "坦坦麺", "担担麺", "坦坦面", "担担面", "坦々面"], zh: "擔擔麵", note: "通常會辣，含芝麻", usually: ["芝麻", "小麥"] },
  { ja: ["ふかひれ", "フカヒレ", "鱶鰭"], zh: "魚翅" },
  // Wikidata labels 白子 as 魚膘 (swim bladder), which is wrong.
  { ja: ["白子"], zh: "白子（魚的精巢，多為鱈魚）", note: "口感綿密濃郁，冬季限定的居酒屋料理" },
  { ja: ["焼売", "焼賣", "シュウマイ", "シューマイ"], zh: "燒賣", usually: ["小麥"] },
  { ja: ["蒸し餃子", "蒸餃子"], zh: "蒸餃", usually: ["小麥"] },
  { ja: ["上海麺", "上海麵", "上海面"], zh: "上海麵（上海風味湯麵）", usually: ["小麥"] },
  { ja: ["にぎり", "握り"], zh: "握壽司", note: "1 貫＝1 個；有些店 1 份是 2 貫" },
  { ja: ["巻物", "巻き", "巻"], zh: "壽司捲" },
  { ja: ["鉄火巻"], zh: "鮪魚細捲" },
  { ja: ["かっぱ巻"], zh: "小黃瓜細捲" },
  { ja: ["ワサビ", "わさび", "山葵"], zh: "芥末（山葵）", note: "點餐單上的「ワサビ あり／なし」＝要／不要芥末；不敢吃辣就說「サビ抜き」" },
  { ja: ["サビ抜き"], zh: "不加芥末" },
  { ja: ["ネタ"], zh: "壽司上的配料（魚料）" },
  { ja: ["赤身"], zh: "鮪魚瘦肉（紅肉）" },
  { ja: ["玉子"], zh: "日式甜煎蛋（壽司）", usually: ["蛋"] },
  { ja: ["ホタテ", "帆立"], zh: "干貝（扇貝）" },
  { ja: ["食券"], zh: "餐券", note: "先在售票機投錢、按想吃的品項，拿到餐券交給店員" },
  { ja: ["つけ麺"], zh: "沾麵", note: "麵和湯分開，麵沾湯吃；吃完可以請店員加熱湯（スープ割り）" },
  { ja: ["ラーメン", "らーめん", "拉麺"], zh: "拉麵", usually: ["小麥"] },
  { ja: ["うどん"], zh: "烏龍麵", usually: ["小麥"] },
  { ja: ["蕎麦", "そば"], zh: "蕎麥麵", note: "對蕎麥過敏的人要特別小心，同一鍋煮麵水也可能有", usually: ["蕎麥"] },
  { ja: ["焼きそば", "焼そば"], zh: "日式炒麵（不是蕎麥麵）", usually: ["小麥"] },
  { ja: ["餃子"], zh: "煎餃", usually: ["小麥"] },
  { ja: ["チャーシュー", "叉焼"], zh: "叉燒" },
  { ja: ["半熟卵", "味玉", "煮卵"], zh: "溏心蛋", usually: ["蛋"] },
  { ja: ["卵かけご飯"], zh: "生雞蛋拌飯", note: "雞蛋是生的", usually: ["蛋"] },
  { ja: ["すき焼き"], zh: "壽喜燒", note: "通常沾生雞蛋吃", usually: ["蛋"] },
  { ja: ["しゃぶしゃぶ"], zh: "涮涮鍋" },
  { ja: ["おでん"], zh: "關東煮" },
  { ja: ["茶碗蒸し"], zh: "日式蒸蛋", usually: ["蛋"] },
  { ja: ["枝豆"], zh: "毛豆", usually: ["大豆"] },
  { ja: ["冷奴"], zh: "涼拌豆腐", usually: ["大豆"] },
  { ja: ["納豆"], zh: "納豆（發酵黃豆，有黏絲、氣味重）", usually: ["大豆"] },
  { ja: ["明太子"], zh: "明太子（辣味鱈魚卵）" },
  { ja: ["いくら", "イクラ"], zh: "鮭魚卵" },
  { ja: ["うに", "ウニ", "雲丹"], zh: "海膽" },
  { ja: ["ホルモン"], zh: "內臟（燒肉用）" },
  { ja: ["馬刺し", "馬刺"], zh: "生馬肉片" },
  { ja: ["牛タン"], zh: "牛舌", note: "仙台名物" },
  { ja: ["たこ焼き"], zh: "章魚燒", usually: ["小麥", "蛋"] },
  { ja: ["お好み焼き"], zh: "大阪燒（日式煎餅）", usually: ["小麥", "蛋"] },
  { ja: ["もんじゃ"], zh: "文字燒", usually: ["小麥"] },
  { ja: ["鰻", "うなぎ"], zh: "鰻魚" },
  { ja: ["穴子", "アナゴ"], zh: "星鰻（海鰻）" },
  { ja: ["鯛"], zh: "鯛魚" },
  { ja: ["鮪", "マグロ", "まぐろ"], zh: "鮪魚" },
  { ja: ["トロ", "大トロ", "中トロ"], zh: "鮪魚腹（油脂多）" },
  { ja: ["鮭", "サーモン"], zh: "鮭魚" },
  { ja: ["蛸", "タコ"], zh: "章魚" },
  { ja: ["烏賊", "イカ"], zh: "魷魚／花枝" },
  { ja: ["生ビール"], zh: "生啤酒（扎啤）" },
  { ja: ["ハイボール"], zh: "威士忌蘇打" },
  { ja: ["サワー", "チューハイ", "酎ハイ"], zh: "調酒（燒酒或伏特加加果汁蘇打）" },
  { ja: ["梅酒"], zh: "梅酒" },
  { ja: ["抹茶"], zh: "抹茶" },
  { ja: ["あんこ", "餡"], zh: "紅豆餡" },
  { ja: ["わらび餅"], zh: "蕨餅（Q 軟甜點）" },
];

// ---- 神社 ----
export const OMIKUJI_LEVELS: [string, string][] = [
  ["大吉", "最好的籤"],
  ["中吉", "很好"],
  ["小吉", "小小的好運"],
  ["末吉", "好運在後頭"],
  ["大凶", "最差的籤（很少見），習慣上綁在神社的籤架上，把厄運留下"],
  ["凶", "不太好，習慣上綁在神社的籤架上，把厄運留下"],
  ["吉", "好"],
];

export const OMIKUJI_FIELDS: Term[] = [
  { ja: ["願望", "願事"], zh: "願望" },
  { ja: ["待人"], zh: "等待的人（會不會出現）" },
  { ja: ["失物"], zh: "失物（找不找得到）" },
  { ja: ["旅行", "旅立"], zh: "旅行" },
  { ja: ["商売", "商い"], zh: "生意" },
  { ja: ["学問"], zh: "學業" },
  { ja: ["相場"], zh: "投資行情" },
  { ja: ["争事", "争い事"], zh: "爭執、訴訟" },
  { ja: ["恋愛", "縁談"], zh: "戀愛、婚姻" },
  { ja: ["転居", "移転"], zh: "搬家" },
  { ja: ["出産"], zh: "生產" },
  { ja: ["病気", "病"], zh: "健康" },
];

export const OMAMORI: Term[] = [
  { ja: ["交通安全"], zh: "交通安全", note: "祈求行車、出行平安，常掛在車上或包包" },
  { ja: ["学業成就"], zh: "學業成就", note: "祈求課業進步" },
  { ja: ["合格祈願"], zh: "考試合格", note: "考生最常買" },
  { ja: ["縁結び", "恋愛成就"], zh: "結緣、戀愛", note: "祈求良緣" },
  { ja: ["安産祈願", "安産"], zh: "順產", note: "送給孕婦" },
  { ja: ["家内安全"], zh: "全家平安" },
  { ja: ["商売繁盛"], zh: "生意興隆" },
  { ja: ["健康長寿", "無病息災"], zh: "健康長壽" },
  { ja: ["厄除", "厄除け"], zh: "消災解厄", note: "日本人逢「厄年」會特別去求" },
  { ja: ["開運"], zh: "開運" },
  { ja: ["金運"], zh: "財運" },
];

const KANA_ONLY = /^[\u30a0-\u30ffー]+$|^[\u3040-\u309fー]+$/;
const KATAKANA = /[\u30a0-\u30ffー]/;
const HIRAGANA = /[\u3040-\u309f]/;

/**
 * Substring match, except a kana-only word must not run on into more of the same script:
 * アジ (竹筴魚) must not fire on アジア, and いくら not on いくらですか.
 */
function indexOfWord(text: string, w: string): number {
  if (!KANA_ONLY.test(w)) return text.indexOf(w);
  const script = KATAKANA.test(w[0]) ? KATAKANA : HIRAGANA;
  for (let i = text.indexOf(w); i >= 0; i = text.indexOf(w, i + 1)) {
    // Compounds that END in the word are fine (ミンチカツ, エビカツ); a word that runs on
    // into more of the same script is a different word (アジア is not アジ).
    const after = text[i + w.length] ?? "";
    if (!script.test(after)) return i;
  }
  return -1;
}

const sortedCache = new WeakMap<Term[], Term[]>();
const longestFirst = (dict: Term[]) => {
  let sorted = sortedCache.get(dict);
  if (!sorted) {
    sorted = [...dict].sort((a, b) => Math.max(...b.ja.map((s) => s.length)) - Math.max(...a.ja.map((s) => s.length)));
    sortedCache.set(dict, sorted);
  }
  return sorted;
};

/**
 * All terms whose Japanese form appears in the text, longest match first, deduplicated.
 * Dictionaries are tried in priority order: hand-checked entries win over Wikidata.
 */
export function findTerms(text: string, ...dicts: Term[][]): Term[] {
  const found: Term[] = [];
  let rest = text;
  for (const dict of dicts) {
    for (const t of longestFirst(dict)) {
      const hit = t.ja.find((w) => indexOfWord(rest, w) >= 0);
      if (hit) {
        found.push(t);
        // Consume the match so 焼きそば doesn't also count as そば.
        rest = rest.split(hit).join("　");
      }
    }
  }
  return found;
}

// ---- 商品包裝、藥妝 ----
export const PRODUCT_TERMS: Term[] = [
  { ja: ["賞味期限"], zh: "最佳賞味期限", note: "過了味道可能變差，但通常還能吃" },
  { ja: ["消費期限"], zh: "消費期限", note: "過了就不要吃（多是便當、生鮮）" },
  { ja: ["要冷蔵"], zh: "需冷藏" },
  { ja: ["要冷凍"], zh: "需冷凍" },
  { ja: ["開封後"], zh: "開封後", note: "後面通常寫開封後要冷藏或幾天內吃完" },
  { ja: ["原材料名", "原材料"], zh: "成分（原料）" },
  { ja: ["内容量"], zh: "內容量" },
  { ja: ["電子レンジ"], zh: "微波爐" },
  { ja: ["温めますか", "温め"], zh: "加熱", note: "便利商店店員常問「温めますか？」＝要不要幫你加熱" },
  { ja: ["お湯を注ぐ", "熱湯"], zh: "加熱水", note: "泡麵、即溶食品" },
  { ja: ["医薬部外品"], zh: "醫藥部外品", note: "效果比藥品溫和（例如藥用牙膏、止汗劑），不是藥" },
  { ja: ["化粧水"], zh: "化妝水" },
  { ja: ["乳液"], zh: "乳液" },
  { ja: ["日焼け止め"], zh: "防曬" },
  { ja: ["敏感肌"], zh: "敏感肌適用" },
  { ja: ["無香料"], zh: "無香料" },
];

// ---- Wikidata 料理辭典（CC0，scripts/build-wikidata-dict.ts 產生）----
function loadWikidata(): Term[] {
  // Next to this file in src/ (tsx) or dist/ (compiled; the Dockerfile copies it over).
  const file = new URL("./wikidata-foods.json", import.meta.url);
  if (!existsSync(file)) return [];
  const { entries } = JSON.parse(readFileSync(file, "utf8")) as { entries: { ja: string[]; zh: string }[] };
  return entries.map((e) => ({ ja: e.ja, zh: e.zh, source: "wikidata" as const }));
}
export const WIKI_FOODS: Term[] = loadWikidata();

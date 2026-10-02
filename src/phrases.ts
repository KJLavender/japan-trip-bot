/**
 * Hand-checked travel phrasebook. Small models are unreliable at kana/romaji,
 * so common phrases come from here; the LLM only composes uncommon ones.
 */
export interface Phrase {
  zh: string;
  ja: string;
  kana: string;
  romaji: string;
  keywords: string[];
  note?: string;
}

export const PHRASES: Phrase[] = [
  // 付款・購物
  { zh: "可以刷卡嗎？", ja: "カードは使えますか？", kana: "カードは つかえますか？", romaji: "Kādo wa tsukaemasu ka?", keywords: ["刷卡", "信用卡"] },
  { zh: "可以用交通卡（Suica、ICOCA）付嗎？", ja: "交通系ICカードは使えますか？", kana: "こうつうけい アイシーカードは つかえますか？", romaji: "Kōtsūkei aishī kādo wa tsukaemasu ka?", keywords: ["suica", "icoca", "西瓜卡", "交通卡", "ic卡"] },
  { zh: "多少錢？", ja: "いくらですか？", kana: "いくらですか？", romaji: "Ikura desu ka?", keywords: ["多少錢", "價格", "價錢"] },
  { zh: "可以免稅嗎？", ja: "免税できますか？", kana: "めんぜい できますか？", romaji: "Menzei dekimasu ka?", keywords: ["免稅", "退稅"], note: "結帳時出示護照" },
  { zh: "請給我袋子。", ja: "袋をください。", kana: "ふくろを ください。", romaji: "Fukuro o kudasai.", keywords: ["要袋子", "給我袋子", "袋子"] },
  { zh: "不用袋子，謝謝。", ja: "袋は大丈夫です。", kana: "ふくろは だいじょうぶです。", romaji: "Fukuro wa daijōbu desu.", keywords: ["不用袋子", "不要袋子"] },
  { zh: "有其他尺寸（顏色）嗎？", ja: "他のサイズ（色）はありますか？", kana: "ほかの サイズ（いろ）は ありますか？", romaji: "Hoka no saizu (iro) wa arimasu ka?", keywords: ["尺寸", "顏色", "size"] },
  { zh: "可以試穿嗎？", ja: "試着してもいいですか？", kana: "しちゃく しても いいですか？", romaji: "Shichaku shite mo ii desu ka?", keywords: ["試穿"] },

  // 餐廳
  { zh: "我們有四位。", ja: "4人です。", kana: "よにんです。", romaji: "Yonin desu.", keywords: ["幾位", "人數", "四位", "幾個人"], note: "2人 ふたり futari／3人 さんにん sannin／5人 ごにん gonin" },
  { zh: "我有預約，名字是〇〇。", ja: "予約しています。名前は〇〇です。", kana: "よやく しています。なまえは 〇〇です。", romaji: "Yoyaku shite imasu. Namae wa ○○ desu.", keywords: ["有預約", "訂位"] },
  { zh: "我沒有預約。", ja: "予約していません。", kana: "よやく していません。", romaji: "Yoyaku shite imasen.", keywords: ["沒有預約", "沒訂位"] },
  { zh: "要等多久？", ja: "どのくらい待ちますか？", kana: "どのくらい まちますか？", romaji: "Dono kurai machimasu ka?", keywords: ["等多久", "要等"] },
  { zh: "請給我菜單。", ja: "メニューをください。", kana: "メニューを ください。", romaji: "Menyū o kudasai.", keywords: ["菜單"] },
  { zh: "有中文菜單嗎？", ja: "中国語のメニューはありますか？", kana: "ちゅうごくごの メニューは ありますか？", romaji: "Chūgokugo no menyū wa arimasu ka?", keywords: ["中文菜單"] },
  { zh: "推薦什麼？", ja: "おすすめは何ですか？", kana: "おすすめは なんですか？", romaji: "Osusume wa nan desu ka?", keywords: ["推薦", "招牌"] },
  { zh: "請給我這個。", ja: "これをください。", kana: "これを ください。", romaji: "Kore o kudasai.", keywords: ["點這個", "我要這個", "給我這個"] },
  { zh: "請給我水。", ja: "お水をください。", kana: "おみずを ください。", romaji: "Omizu o kudasai.", keywords: ["給我水", "要水"] },
  { zh: "不要加冰，謝謝。", ja: "氷なしでお願いします。", kana: "こおり なしで おねがいします。", romaji: "Kōri nashi de onegai shimasu.", keywords: ["去冰", "不要冰", "不加冰"] },
  { zh: "請給我筷子（湯匙）。", ja: "お箸（スプーン）をください。", kana: "おはし（スプーン）を ください。", romaji: "Ohashi (supūn) o kudasai.", keywords: ["筷子", "湯匙"] },
  { zh: "可以幫我加熱嗎？", ja: "温めてもらえますか？", kana: "あたためて もらえますか？", romaji: "Atatamete moraemasu ka?", keywords: ["加熱", "微波", "熱一下"], note: "便利商店結帳時店員常問「温めますか？」＝要加熱嗎" },
  { zh: "營業到幾點？", ja: "何時まで開いていますか？", kana: "なんじまで あいて いますか？", romaji: "Nanji made aite imasu ka?", keywords: ["營業到", "開到幾點", "幾點關"] },
  { zh: "這個要怎麼用？", ja: "これはどうやって使いますか？", kana: "これは どうやって つかいますか？", romaji: "Kore wa dō yatte tsukaimasu ka?", keywords: ["怎麼用", "使用方法"] },
  { zh: "有 Wi-Fi 嗎？", ja: "Wi-Fiはありますか？", kana: "ワイファイは ありますか？", romaji: "Waifai wa arimasu ka?", keywords: ["wifi", "wi-fi", "網路"] },
  { zh: "我對〇〇過敏。", ja: "〇〇アレルギーがあります。", kana: "〇〇 アレルギーが あります。", romaji: "○○ arerugī ga arimasu.", keywords: ["過敏"], note: "蝦 えび ebi／蛋 たまご tamago／花生 ピーナッツ pīnattsu／小麥 こむぎ komugi" },
  { zh: "我不能吃牛肉。", ja: "牛肉が食べられません。", kana: "ぎゅうにくが たべられません。", romaji: "Gyūniku ga taberaremasen.", keywords: ["不吃牛", "牛肉", "不能吃"] },
  { zh: "這個有含酒精嗎？", ja: "これはアルコールが入っていますか？", kana: "これは アルコールが はいって いますか？", romaji: "Kore wa arukōru ga haitte imasu ka?", keywords: ["酒精"] },
  { zh: "內用／外帶。", ja: "店内で／持ち帰りで。", kana: "てんないで／もちかえりで。", romaji: "Tennai de / Mochikaeri de.", keywords: ["內用", "外帶"] },
  { zh: "請結帳。", ja: "お会計をお願いします。", kana: "おかいけいを おねがいします。", romaji: "Okaikei o onegai shimasu.", keywords: ["結帳", "買單"] },
  { zh: "可以分開結帳嗎？", ja: "別々に払えますか？", kana: "べつべつに はらえますか？", romaji: "Betsubetsu ni haraemasu ka?", keywords: ["分開結帳", "分開付"] },

  // 交通・住宿
  { zh: "廁所在哪裡？", ja: "トイレはどこですか？", kana: "トイレは どこですか？", romaji: "Toire wa doko desu ka?", keywords: ["廁所", "洗手間"] },
  { zh: "車站在哪裡？", ja: "駅はどこですか？", kana: "えきは どこですか？", romaji: "Eki wa doko desu ka?", keywords: ["車站"] },
  { zh: "這班電車有到〇〇嗎？", ja: "この電車は〇〇に行きますか？", kana: "この でんしゃは 〇〇に いきますか？", romaji: "Kono densha wa ○○ ni ikimasu ka?", keywords: ["電車", "這班車", "有到"] },
  { zh: "（計程車）請到這個地址。", ja: "この住所までお願いします。", kana: "この じゅうしょまで おねがいします。", romaji: "Kono jūsho made onegai shimasu.", keywords: ["計程車", "地址"] },
  { zh: "我要辦入住。", ja: "チェックインをお願いします。", kana: "チェックインを おねがいします。", romaji: "Chekkuin o onegai shimasu.", keywords: ["入住", "check in", "checkin"] },
  { zh: "可以寄放行李嗎？", ja: "荷物を預かってもらえますか？", kana: "にもつを あずかって もらえますか？", romaji: "Nimotsu o azukatte moraemasu ka?", keywords: ["寄放", "行李"] },

  // 溝通
  { zh: "可以拍照嗎？", ja: "写真を撮ってもいいですか？", kana: "しゃしんを とっても いいですか？", romaji: "Shashin o totte mo ii desu ka?", keywords: ["可以拍照"] },
  { zh: "可以幫我們拍照嗎？", ja: "写真を撮っていただけますか？", kana: "しゃしんを とって いただけますか？", romaji: "Shashin o totte itadakemasu ka?", keywords: ["幫我拍", "幫我們拍"] },
  { zh: "我不會說日文。", ja: "日本語が話せません。", kana: "にほんごが はなせません。", romaji: "Nihongo ga hanasemasen.", keywords: ["不會日文", "不會說日文"] },
  { zh: "請再說一次。", ja: "もう一度お願いします。", kana: "もう いちど おねがいします。", romaji: "Mō ichido onegai shimasu.", keywords: ["再說一次", "聽不懂"] },
  { zh: "可以幫我寫下來嗎？", ja: "書いていただけますか？", kana: "かいて いただけますか？", romaji: "Kaite itadakemasu ka?", keywords: ["寫下來"] },
  { zh: "不好意思（叫人、借過）。", ja: "すみません。", kana: "すみません。", romaji: "Sumimasen.", keywords: ["不好意思", "借過", "對不起"] },
  { zh: "謝謝。", ja: "ありがとうございます。", kana: "ありがとうございます。", romaji: "Arigatō gozaimasu.", keywords: ["謝謝"] },

  // 緊急
  { zh: "我身體不舒服。", ja: "気分が悪いです。", kana: "きぶんが わるいです。", romaji: "Kibun ga warui desu.", keywords: ["不舒服", "生病"] },
  { zh: "請叫救護車！", ja: "救急車を呼んでください！", kana: "きゅうきゅうしゃを よんで ください！", romaji: "Kyūkyūsha o yonde kudasai!", keywords: ["救護車", "急救"], note: "日本急救／消防 119、警察 110" },
  { zh: "藥局在哪裡？", ja: "薬局はどこですか？", kana: "やっきょくは どこですか？", romaji: "Yakkyoku wa doko desu ka?", keywords: ["藥局", "藥妝"] },
  { zh: "我的〇〇不見了。", ja: "〇〇をなくしました。", kana: "〇〇を なくしました。", romaji: "○○ o nakushimashita.", keywords: ["不見", "弄丟", "遺失", "掉了"], note: "錢包 さいふ saifu／護照 パスポート pasupōto／手機 スマホ sumaho" },
];

const norm = (s: string) => s.toLowerCase().replace(/[\s?？!！。、，,（）()「」『』"']/g, "");

function scored(query: string) {
  const q = norm(query);
  if (!q) return [];
  return PHRASES.map((p) => {
    const zh = norm(p.zh);
    let score = zh === q ? 100 : q.length >= 3 && (zh.includes(q) || q.includes(zh)) ? 50 : 0;
    for (const k of p.keywords) if (q.includes(norm(k))) score += k.length;
    return { p, score };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Phrases ranked by keyword overlap with the query. */
export const searchPhrases = (query: string, limit = 3): Phrase[] => scored(query).slice(0, limit).map((r) => r.p);

/** A single clear winner (score ≥ 2, no tie) — safe to answer without the LLM. */
export function bestPhrase(query: string): Phrase | undefined {
  const [first, second] = scored(query);
  if (first && first.score >= 2 && (!second || first.score > second.score)) return first.p;
  return undefined;
}

export function formatPhrase(p: Phrase): string {
  return [`🇯🇵 ${p.ja}`, `🔤 ${p.kana}`, `🗣 ${p.romaji}`, `💬 ${p.zh}`, ...(p.note ? [`📝 ${p.note}`] : [])].join("\n");
}

export const AI_TRANSLATION_WARNING = "⚠️ 這句不在內建句庫，是 AI 翻譯的，可能不準確，建議用翻譯 App 再確認。";

/** True if the text contains a phrase card whose romaji isn't from the phrasebook. */
export function hasUnverifiedPhrase(text: string): boolean {
  return text.includes("🗣") && !PHRASES.some((p) => text.includes(p.romaji));
}

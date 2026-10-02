import { config } from "./config.js";
import { readJson, writeJson } from "./store.js";
import type { Term } from "./knowledge/glossary.js";

/**
 * Dictionary fallback: Japanese fragments from a photo that no local dictionary knows
 * are looked up with Gemini, and every answer is cached so each word is only ever sent once.
 *
 * Privacy: only short OCR text fragments are sent — never photos, chat messages or names.
 * On Gemini's free tier Google may use requests to improve its products.
 */

interface CachedTerm {
  ja: string;
  zh: string;
  note?: string;
  /** false = Gemini said it's not a meaningful word (OCR noise, a name, …); don't ask again. */
  useful: boolean;
}
interface Cache {
  terms: Record<string, CachedTerm>;
  day: string;
  calls: number;
}

const CACHE_KIND = "cache";
const CACHE_ID = "gemini-terms";
const loadCache = (): Cache => readJson<Cache>(CACHE_KIND, CACHE_ID, { terms: {}, day: "", calls: 0 });

export const geminiEnabled = () => Boolean(config.geminiApiKey);

const toTerm = (t: CachedTerm): Term => ({ ja: [t.ja], zh: t.zh, note: t.note, source: "ai" });

const KANA_KANJI = /[぀-ヿ一-鿿]/g;

/**
 * Fragments of OCR text that look like words but aren't explained by any known term.
 * Lines are split on punctuation/prices; known words are removed before judging what's left.
 */
export function unknownFragments(text: string, known: Term[], limit = 15): string[] {
  const knownWords = known.flatMap((t) => t.ja).sort((a, b) => b.length - a.length);
  const out: string[] = [];
  for (const raw of text.split(/[\n\s・･·/／、,，。()（）「」『』【】[\]…:：|｜!！?？※*＊~〜→]+/)) {
    const seg = raw.replace(/[¥￥]?[\d,.]+\s*(?:円|yen|個|貫|g|ml|mL|本|杯|皿|人前)?/g, "").trim();
    const jp = seg.match(KANA_KANJI)?.length ?? 0;
    if (jp < 2 || seg.length > 16) continue;
    let rest = seg;
    for (const w of knownWords) rest = rest.split(w).join("");
    if ((rest.match(KANA_KANJI)?.length ?? 0) < 2) continue;
    if (!out.includes(seg)) out.push(seg);
    if (out.length >= limit) break;
  }
  return out;
}

const SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      input: { type: "STRING" },
      ja: { type: "STRING", description: "正確的日文寫法（OCR 錯字要改正）" },
      zh: { type: "STRING", description: "繁體中文（台灣用語）名稱" },
      note: { type: "STRING", description: "一句話說明，台灣觀光客看得懂" },
      useful: { type: "BOOLEAN", description: "是不是有意義的料理、食材、飲料、商品或告示用語" },
    },
    required: ["input", "useful"],
  },
};

const PROMPT = `以下是日本觀光客拍的照片（菜單、商品、告示）經過 OCR 讀出的日文片段，可能有 OCR 錯字。
對每個片段回傳一筆：
- 如果是料理、食材、飲料、商品或告示用語：useful=true，ja 填正確寫法（OCR 錯字要改正），zh 填繁體中文（台灣用語）名稱，note 用一句話說明它是什麼、口味或特色。
- 如果是店名、人名、無意義的 OCR 雜訊，或你不確定：useful=false。不確定就填 false，不要猜。
片段：
`;

/** Look up unknown fragments: cache first, then one Gemini call for the rest. Never throws. */
export async function lookupTerms(fragments: string[]): Promise<Term[]> {
  if (!geminiEnabled() || fragments.length === 0) return [];
  const cache = loadCache();
  const found = fragments.map((f) => cache.terms[f]).filter((t): t is CachedTerm => Boolean(t?.useful));
  const missing = fragments.filter((f) => !cache.terms[f]);

  const today = new Date().toISOString().slice(0, 10);
  if (cache.day !== today) [cache.day, cache.calls] = [today, 0];
  if (missing.length === 0 || cache.calls >= config.geminiDailyLimit) return found.map(toTerm);

  try {
    cache.calls++;
    const thinking = config.geminiModel.startsWith("gemini-2.5") ? { thinkingConfig: { thinkingBudget: 0 } } : {};
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent`, {
      method: "POST",
      // Key in a header, not the URL, so it never ends up in proxy or access logs.
      headers: { "content-type": "application/json", "x-goog-api-key": config.geminiApiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT + missing.map((m) => `- ${m}`).join("\n") }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema: SCHEMA, ...thinking },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const json = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    const rows = JSON.parse(json) as { input: string; ja?: string; zh?: string; note?: string; useful: boolean }[];
    for (const r of rows) {
      if (!missing.includes(r.input)) continue; // ignore anything we didn't ask about
      const useful = Boolean(r.useful && r.zh && r.ja);
      cache.terms[r.input] = { ja: (r.ja || r.input).slice(0, 30), zh: (r.zh ?? "").slice(0, 40), note: r.note?.slice(0, 80), useful };
      if (useful) found.push(cache.terms[r.input]);
    }
  } catch (err) {
    console.warn("[gemini] lookup failed:", (err as Error).message);
  } finally {
    writeJson(CACHE_KIND, CACHE_ID, cache);
  }
  return found.map(toTerm);
}

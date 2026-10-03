// Download model-eval test data from the web: npm run fetch:eval-data
//   test/data/tatoeba-zh-ja.json   travel sentences with human Japanese translations (Tatoeba, CC BY 2.0 FR)
//   test/data/wikidata-landmarks.json  facts about popular Japanese landmarks (Wikidata, CC0)
import { mkdirSync, writeFileSync } from "node:fs";
import * as OpenCC from "opencc-js";

const UA = { "user-agent": "japan-trip-bot-eval/1.0 (github.com/KJLavender/japan-trip-bot)" };
const toTw = OpenCC.Converter({ from: "cn", to: "twp" });
mkdirSync("test/data", { recursive: true });

// ---- Tatoeba: things a tourist says ----
const KEYWORDS = [
  "多少钱", "车站", "厕所", "信用卡", "预约", "菜单", "酒店", "药", "请给我", "在哪里",
  "几点", "可以吗", "便宜", "推荐", "拍照", "地铁", "机场", "行李", "钱包", "迷路",
  "医院", "退税", "水", "辣", "过敏", "打折", "门票", "出租车", "便利店", "温泉",
];
const pairs: { id: number; zh: string; ja: string[] }[] = [];
for (const q of KEYWORDS) {
  const u = new URL("https://api.tatoeba.org/unstable/sentences");
  for (const [k, v] of Object.entries({ lang: "cmn", q, "trans:lang": "jpn", sort: "relevance", limit: "6", showtrans: "matching" })) {
    u.searchParams.set(k, v);
  }
  const res = await fetch(u, { headers: UA });
  if (!res.ok) {
    console.warn(`tatoeba ${q}: HTTP ${res.status}`);
    continue;
  }
  const { data = [] } = (await res.json()) as { data?: { id: number; text: string; translations?: { lang: string; text: string }[][] }[] };
  for (const s of data) {
    const ja = (s.translations ?? []).flat().filter((t) => t.lang === "jpn").map((t) => t.text);
    const zh = toTw(s.text);
    if (ja.length === 0 || zh.length < 3 || zh.length > 24 || pairs.some((p) => p.zh === zh)) continue;
    pairs.push({ id: s.id, zh, ja });
    if (pairs.filter((p) => KEYWORDS.indexOf(q) >= 0).length && pairs.length % 2 === 0) break; // ~2 per keyword
  }
  await new Promise((r) => setTimeout(r, 500));
}
writeFileSync(
  "test/data/tatoeba-zh-ja.json",
  JSON.stringify({ source: "https://tatoeba.org", license: "CC BY 2.0 FR — sentences by Tatoeba contributors", fetched: new Date().toISOString().slice(0, 10), pairs }, null, 2) + "\n",
);
console.log(`✅ Tatoeba: ${pairs.length} pairs`);

// ---- Wikidata: popular Japanese landmarks ----
const SPARQL = `
SELECT ?item ?zh ?ja ?pref ?height ?inception ?links WHERE {
  VALUES ?type { wd:Q12518 wd:Q5393308 wd:Q845945 wd:Q23413 wd:Q33506 wd:Q570116 wd:Q11303 }
  ?item wdt:P31 ?type ; wdt:P17 wd:Q17 ; wikibase:sitelinks ?links .
  FILTER(?links >= 25)
  ?item rdfs:label ?zh . FILTER(LANG(?zh) IN ("zh-tw","zh-hant"))
  ?item rdfs:label ?ja . FILTER(LANG(?ja) = "ja")
  OPTIONAL { ?item wdt:P131+ ?p . ?p wdt:P31 wd:Q50337 . ?p rdfs:label ?pref . FILTER(LANG(?pref) IN ("zh-tw","zh-hant")) }
  OPTIONAL { ?item wdt:P2048 ?height }
  OPTIONAL { ?item wdt:P571 ?inception }
} ORDER BY DESC(?links) LIMIT 300`;
const res = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(SPARQL), {
  headers: { ...UA, accept: "application/sparql-results+json" },
});
const rows = ((await res.json()) as { results: { bindings: Record<string, { value: string }>[] } }).results.bindings;
const byItem = new Map<string, { name: string; ja: string; pref?: string; height?: number; year?: number }>();
for (const r of rows) {
  const id = r.item.value.split("/").pop()!;
  const e = byItem.get(id) ?? { name: r.zh.value, ja: r.ja.value };
  if (r.pref) e.pref = r.pref.value;
  if (r.height && !e.height) e.height = Math.round(Number(r.height.value));
  const y = r.inception?.value.match(/^(-?\d{1,4})-/)?.[1];
  if (y && !e.year) e.year = Number(y);
  byItem.set(id, e);
}
// Founding years are left out on purpose: Wikidata often disagrees with the commonly cited
// year (東寺 676 vs 796, 淺草寺 645 vs 628), which would mark correct answers wrong.
const questions: { id: string; question: string; kind: "pref" | "height"; answer: string | number }[] = [];
for (const [id, e] of byItem) {
  if (e.pref && questions.filter((q) => q.kind === "pref").length < 12) {
    questions.push({ id, kind: "pref", question: `${e.name}在日本哪個都道府縣？`, answer: e.pref });
  }
}
// Heights: tall, well-known structures (towers, skyscrapers) with an unambiguous number.
const HEIGHTS = `
SELECT ?item ?zh ?height ?links WHERE {
  VALUES ?type { wd:Q12518 wd:Q11303 wd:Q11166728 wd:Q1440476 }
  ?item wdt:P31 ?type ; wdt:P17 wd:Q17 ; wdt:P2048 ?height ; wikibase:sitelinks ?links .
  ?item wdt:P1619|wdt:P571 ?opened .  # built and opened, not a proposal (X-Seed 4000)
  FILTER(?links >= 15)
  ?item rdfs:label ?zh . FILTER(LANG(?zh) IN ("zh-tw","zh-hant","zh"))
} ORDER BY DESC(?links) LIMIT 60`;
const hres = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(HEIGHTS), {
  headers: { ...UA, accept: "application/sparql-results+json" },
});
const seen = new Set<string>();
for (const r of ((await hres.json()) as { results: { bindings: Record<string, { value: string }>[] } }).results.bindings) {
  const id = r.item.value.split("/").pop()!;
  const height = Math.round(Number(r.height.value));
  if (seen.has(id) || height < 100 || questions.filter((q) => q.kind === "height").length >= 8) continue;
  seen.add(id);
  questions.push({ id, kind: "height", question: `${toTw(r.zh.value)}大約有多高（公尺）？`, answer: height });
}
writeFileSync(
  "test/data/wikidata-landmarks.json",
  JSON.stringify({ source: "https://www.wikidata.org", license: "CC0", fetched: new Date().toISOString().slice(0, 10), questions }, null, 2) + "\n",
);
console.log(`✅ Wikidata: ${questions.length} questions (${byItem.size} landmarks)`);

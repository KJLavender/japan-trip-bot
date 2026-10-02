// Real-photo eval: npm run eval:photos [-- --runs=2 qwen3.5:4b gemma3:4b ...]
// Compares three ways to explain a photo, per vision model:
//   pipeline  OCR → code facts → text model (what the bot does today, using OLLAMA_MODEL)
//   vlm       the model looks at the photo alone
//   hybrid    the model looks at the photo AND gets the OCR text + code facts
// Photos are downloaded from their original source into test/photos/ (gitignored).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config, ollamaApiBase } from "../src/config.js";
import { ocrImage } from "../src/ocr.js";
import { analyzeText, buildPrompt, explainPhoto, toVisionImage } from "../src/photo.js";

interface Case { file: string; url: string; question: string; expect: string[]; reject?: string[]; scene: string }
const { cases } = JSON.parse(readFileSync("test/photo-cases.json", "utf8")) as { cases: Case[] };
const args = process.argv.slice(2);
const runs = Number(args.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 2);
const numCtx = Number(args.find((a) => a.startsWith("--ctx="))?.split("=")[1] ?? config.ollamaNumCtx);
const skipPipeline = args.includes("--skip-pipeline");
const models = args.filter((a) => !a.startsWith("--"));
const botOnly = args.includes("--bot-only");
if (!botOnly && models.length === 0) models.push("qwen3.5:4b");

// ---- photos ----
mkdirSync("test/photos", { recursive: true });
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
for (const c of cases) {
  const path = join("test/photos", c.file);
  if (existsSync(path)) continue;
  const res = await fetch(c.url, { headers: { "user-agent": c.url.includes("wikimedia") ? "japan-trip-bot-eval/1.0 (github.com/KJLavender/japan-trip-bot)" : BROWSER_UA } });
  if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) throw new Error(`下載失敗：${c.file}（${res.status}）`);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  console.error(`⬇ ${c.file}`);
}
if (!(await ocrImage(readFileSync(join("test/photos", cases[0].file))))) {
  throw new Error("OCR 服務沒有啟動（ocr/server.py），pipeline 與 hybrid 無法比較");
}

const AGENTS = readFileSync("AGENTS.md", "utf8");
const score = (c: Case, text: string) =>
  c.expect.every((p) => new RegExp(p).test(text)) && !(c.reject ?? []).some((p) => new RegExp(p).test(text));

async function chat(model: string, prompt: string, image?: Buffer): Promise<string> {
  const img = image ? (await toVisionImage(image)).data : undefined;
  const res = await fetch(`${ollamaApiBase()}/api/chat`, {
    method: "POST",
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      options: { num_ctx: numCtx, temperature: 0.6 },
      messages: [
        { role: "system", content: AGENTS },
        { role: "user", content: prompt, ...(img ? { images: [img] } : {}) },
      ],
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return ((await res.json()) as { message: { content: string } }).message.content;
}

const vram = async (model: string) => {
  const ps = (await (await fetch(`${ollamaApiBase()}/api/ps`)).json()) as { models: { name: string; size_vram: number; size: number }[] };
  const m = ps.models.find((x) => x.name.startsWith(model));
  return m ? `${(m.size_vram / 1e9).toFixed(1)}GB${m.size_vram < m.size ? "（部分在 CPU）" : ""}` : "?";
};

interface Row { approach: string; pass: number; total: number; ms: number; vram: string; misses: Map<string, number> }
const rows: Row[] = [];
async function measure(approach: string, model: string, fn: (c: Case, buf: Buffer) => Promise<string>) {
  const row: Row = { approach, pass: 0, total: 0, ms: 0, vram: "", misses: new Map() };
  await fn(cases[0], readFileSync(join("test/photos", cases[0].file))).catch(() => ""); // warm-up / model load
  for (let r = 0; r < runs; r++) {
    for (const c of cases) {
      const buf = readFileSync(join("test/photos", c.file));
      const t = Date.now();
      let out = "";
      try {
        out = await fn(c, buf);
      } catch (err) {
        out = `ERROR ${(err as Error).message}`;
      }
      row.ms += Date.now() - t;
      row.total++;
      if (score(c, out)) row.pass++;
      else row.misses.set(c.file, (row.misses.get(c.file) ?? 0) + 1);
      process.stderr.write(score(c, out) ? "." : "x");
      if (r === 0) writeFileSync(join("test/photos", `out-${approach.replace(/[^\w.-]/g, "_")}-${c.file}.txt`), out);
    }
  }
  row.vram = await vram(model);
  rows.push(row);
  process.stderr.write(` ${approach}\n`);
}

// pipeline: exactly what the bot runs today
if (!skipPipeline) await measure(`bot（OCR + ${config.ollamaModel}）`, config.ollamaModel, (c, buf) => explainPhoto("eval", "小明", buf, c.question));

for (const model of models) {
  await measure(`vlm（${model} 直接看圖）`, model, (c, buf) =>
    chat(model, `${c.question ? `使用者問：「${c.question}」。` : ""}請解說這張照片：這是什麼、上面的日文是什麼意思、對觀光客要注意什麼。`, buf),
  );
  await measure(`hybrid（OCR + ${model} 看圖）`, model, async (c, buf) => {
    const text = ((await ocrImage(buf)) ?? []).filter((l) => l.score >= 0.5).map((l) => l.text.normalize("NFKC")).join("\n");
    if (text.replace(/\s/g, "").length < 4) {
      return chat(model, `${c.question ? `使用者問：「${c.question}」。` : ""}請解說這張照片是什麼，對觀光客有什麼意義。`, buf);
    }
    const a = analyzeText(text);
    return `${a.header.join("\n")}\n${await chat(model, buildPrompt(text, a, c.question) + "\n\n（照片也附上了，OCR 有讀錯或漏讀的地方可以看照片補正。）", buf)}`;
  });
}

console.log(`\n測試日期：${new Date().toISOString().slice(0, 10)}｜${cases.length} 張真實照片 × ${runs} 次\n`);
console.log("| 做法 | 正確率 | 平均時間 | VRAM | 常錯的照片 |");
console.log("|---|---|---|---|---|");
for (const r of rows) {
  const misses = [...r.misses].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f, n]) => `${f.replace(/\.jpg$/, "")}×${n}`).join("、");
  console.log(`| ${r.approach} | ${Math.round((100 * r.pass) / r.total)}% | ${(r.ms / r.total / 1000).toFixed(1)}s | ${r.vram} | ${misses || "—"} |`);
}

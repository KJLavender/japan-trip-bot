import { config, ollamaApiBase } from "./config.js";

const CACHE_MS = 30_000;
let cached: { up: boolean; at: number } | undefined;

/** Cheap reachability probe, cached so an offline Ollama costs at most one 3s wait per 30s. */
export async function isLlmUp(): Promise<boolean> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.up;
  let up = false;
  try {
    const res = await fetch(`${ollamaApiBase()}/api/version`, { signal: AbortSignal.timeout(3000) });
    up = res.ok;
  } catch {
    up = false;
  }
  cached = { up, at: Date.now() };
  return up;
}

export const markLlmDown = () => (cached = { up: false, at: Date.now() });

export const LLM_OFFLINE_MESSAGE =
  "🤖 AI 暫時離線中，自然語言記帳和拍照翻譯先暫停。\n" +
  "這些功能照常可用：結算、帳目、刪除 #編號、成員、匯率、記一下：…、記事、怎麼說「…」\n" +
  "輸入「說明」看完整指令。";

/** Startup check: the model exists and has a context window big enough for our prompt. */
export async function checkModel(): Promise<void> {
  try {
    const res = await fetch(`${ollamaApiBase()}/api/show`, {
      method: "POST",
      body: JSON.stringify({ model: config.ollamaModel }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) {
      console.warn(`⚠️ 找不到模型 ${config.ollamaModel}，請執行：npm run setup:model`);
      return;
    }
    const info = (await res.json()) as { parameters?: string };
    const numCtx = Number(info.parameters?.match(/num_ctx\s+(\d+)/)?.[1] ?? 0);
    if (numCtx < 8192) {
      console.warn(
        `⚠️ ${config.ollamaModel} 的 context 只有 ${numCtx || "預設 4096"} token，system prompt 會被截斷。` +
          "請執行：npm run setup:model",
      );
    } else {
      console.log(`🧠 LLM：${config.ollamaModel}（context ${numCtx}）`);
    }
  } catch {
    console.warn(`⚠️ 連不到 Ollama（${ollamaApiBase()}），AI 功能會暫停，其他功能照常運作。`);
  }
}

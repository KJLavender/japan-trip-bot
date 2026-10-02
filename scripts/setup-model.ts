// Create a bot-tuned variant of a base model: npm run setup:model [-- qwen3.5:4b]
// Ollama's OpenAI-compatible endpoint ignores num_ctx and defaults to a 4096-token
// context, which silently truncates the system prompt. The variant bakes in a bigger one.
import { config, ollamaApiBase } from "../src/config.js";

const base = process.argv[2] ?? config.ollamaBaseModel;
const name = config.ollamaModel;

const res = await fetch(`${ollamaApiBase()}/api/create`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    model: name,
    from: base,
    // Lower temperature makes tool calls and extraction more consistent.
    parameters: { num_ctx: config.ollamaNumCtx, temperature: 0.6 },
    stream: false,
  }),
});
if (!res.ok) {
  console.error(`建立失敗（HTTP ${res.status}）：${await res.text()}`);
  console.error(`請先確認已下載基底模型：ollama pull ${base}`);
  process.exit(1);
}
console.log(`✅ 已建立 ${name}（基底 ${base}，context ${config.ollamaNumCtx}）`);

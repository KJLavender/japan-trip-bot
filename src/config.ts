import { readFileSync, existsSync } from "node:fs";

// Minimal .env loader so we don't need dotenv. Skipped under node:test so tests never pick up
// real API keys (they once burned the day's Gemini quota).
if (existsSync(".env") && !process.env.NODE_TEST_CONTEXT) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  // 0.0.0.0 inside a bridged container; 127.0.0.1 when sharing the host network so the bot
  // is only reachable through the tunnel, not from the LAN.
  host: process.env.HOST ?? "0.0.0.0",
  lineChannelSecret: process.env.LINE_CHANNEL_SECRET ?? "",
  lineAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "",
  botName: process.env.BOT_NAME ?? "小幫手",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  // The bot talks to a variant created by `npm run setup:model` from the base model.
  ollamaModel: process.env.OLLAMA_MODEL ?? "japan-trip-bot",
  ollamaBaseModel: process.env.OLLAMA_BASE_MODEL ?? "qwen3.5:4b",
  ollamaNumCtx: Number(process.env.OLLAMA_NUM_CTX ?? 16384),
  // Give up on the LLM after this long so non-AI features keep working when it's offline.
  llmTimeoutMs: Number(process.env.LLM_TIMEOUT_SECONDS ?? 90) * 1000,
  dataDir: process.env.DATA_DIR ?? "data",
  // Used only when the FX API is unreachable.
  fallbackJpyTwd: Number(process.env.FALLBACK_JPY_TWD ?? 0.21),
  // Keep only the most recent N messages in the LLM context.
  maxContextMessages: Number(process.env.MAX_CONTEXT_MESSAGES ?? 30),
  // OCR sidecar (ocr/server.py). Empty = skip OCR and let the vision model read the photo.
  ocrUrl: (process.env.OCR_URL ?? "http://127.0.0.1:8001").replace(/\/$/, ""),
  // Photo translation needs a vision model (qwen3.5:4b supports it).
  visionEnabled: (process.env.VISION_ENABLED ?? "true") === "true",
  maxImageBytes: Number(process.env.MAX_IMAGE_MB ?? 8) * 1024 * 1024,
  // How long a group photo stays available for "@小幫手 翻譯這張".
  imageWindowMs: Number(process.env.IMAGE_WINDOW_MINUTES ?? 15) * 60 * 1000,
  maxInputChars: 1000,
  // Optional dictionary fallback for words no local dictionary knows. Sends only OCR text
  // fragments (never photos or chat) to Google; on the free tier Google may use them.
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
  geminiDailyLimit: Number(process.env.GEMINI_DAILY_LIMIT ?? 300),
  // Chat brain: "ollama" (local, default) or "gemini" (chat text goes to Google; local model is
  // the fallback). Photos are always explained locally.
  llmProvider: (process.env.LLM_PROVIDER ?? "ollama") as "ollama" | "gemini",
  // Flash-Lite: the free tier of gemini-3.5-flash allowed only 20 requests/day.
  geminiChatModel: process.env.GEMINI_CHAT_MODEL ?? "gemini-3.5-flash-lite",
  // If a slow reply misses the reply token, fall back to push (uses monthly quota).
  allowPushFallback: process.env.ALLOW_PUSH_FALLBACK === "true",
};

/** Native Ollama API root (OLLAMA_BASE_URL points at the OpenAI-compatible /v1). */
export const ollamaApiBase = () => config.ollamaBaseUrl.replace(/\/v1\/?$/, "");

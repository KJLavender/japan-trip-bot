import express, { type ErrorRequestHandler } from "express";
import { messagingApi, middleware, HTTPFetchError, SignatureValidationFailed, type webhook } from "@line/bot-sdk";
import type { ImageContent } from "@mariozechner/pi-ai";
import { config } from "./config.js";
import { handleText } from "./handler.js";

if (!config.lineChannelSecret || !config.lineAccessToken) {
  console.error("缺少 LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN，請參考 .env.example");
  process.exit(1);
}

const client = new messagingApi.MessagingApiClient({ channelAccessToken: config.lineAccessToken });
const blobClient = new messagingApi.MessagingApiBlobClient({ channelAccessToken: config.lineAccessToken });
const nameCache = new Map<string, string>();

const chatIdOf = (source: webhook.Source) =>
  source.type === "group" ? source.groupId : source.type === "room" ? source.roomId : source.userId!;

async function senderName(source: webhook.Source): Promise<string> {
  const userId = source.userId;
  if (!userId) return "某人";
  const key = `${chatIdOf(source)}:${userId}`;
  const cached = nameCache.get(key);
  if (cached) return cached;
  try {
    const profile =
      source.type === "group" ? await client.getGroupMemberProfile(source.groupId, userId)
      : source.type === "room" ? await client.getRoomMemberProfile(source.roomId, userId)
      : await client.getProfile(userId);
    nameCache.set(key, profile.displayName);
    return profile.displayName;
  } catch {
    return "某人";
  }
}

// ---- 拍照翻譯：記住群組最近的照片，等有人 @小幫手 時再處理 ----

interface RecentImage { messageId: string; userId?: string; at: number }
const recentImages = new Map<string, RecentImage[]>();
const IMAGE_HINT = /翻譯|這張|照片|圖片|菜單|看看|看一下|寫什麼|是什麼|說明書/;

function rememberImage(chatId: string, img: RecentImage) {
  const now = Date.now();
  const list = (recentImages.get(chatId) ?? []).filter((i) => now - i.at < config.imageWindowMs);
  list.push(img);
  recentImages.set(chatId, list.slice(-10));
}

/** Prefer the quoted photo; otherwise the sender's latest photo if the text sounds like it's about one. */
function pickImage(chatId: string, msg: webhook.TextMessageContent, userId?: string): RecentImage | undefined {
  const now = Date.now();
  const list = (recentImages.get(chatId) ?? []).filter((i) => now - i.at < config.imageWindowMs);
  if (msg.quotedMessageId) {
    const quoted = list.find((i) => i.messageId === msg.quotedMessageId);
    if (quoted) return quoted;
  }
  if (!IMAGE_HINT.test(msg.text)) return undefined;
  return list.filter((i) => i.userId === userId).at(-1) ?? list.at(-1);
}

async function downloadImage(messageId: string): Promise<ImageContent> {
  const stream = await blobClient.getMessageContent(messageId);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > config.maxImageBytes) {
      stream.destroy();
      throw new Error("image too large");
    }
    chunks.push(chunk as Buffer);
  }
  const buf = Buffer.concat(chunks);
  const mimeType = buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) ? "image/png" : "image/jpeg";
  return { type: "image", data: buf.toString("base64"), mimeType };
}

// ---- 訊息處理 ----

/**
 * In groups the bot only answers when mentioned (LINE @mention or a "小幫手" prefix).
 * Returns the message with the mention stripped, or undefined if not addressed to us.
 */
function addressedText(source: webhook.Source, msg: webhook.TextMessageContent): string | undefined {
  const text = msg.text;
  if (source.type === "user") return text.trim();

  const self = msg.mention?.mentionees.find((m) => m.type === "user" && (m as webhook.UserMentionee).isSelf);
  if (self) return (text.slice(0, self.index) + text.slice(self.index + self.length)).trim();

  const prefix = new RegExp(`^[@＠]?${config.botName}[\\s,，:：]*`);
  if (prefix.test(text)) return text.replace(prefix, "").trim();
  return undefined;
}

async function reply(replyToken: string, to: string, text: string) {
  const messages = [{ type: "text" as const, text: text.slice(0, 5000) }];
  try {
    await client.replyMessage({ replyToken, messages });
  } catch (err) {
    // Reply tokens expire; slow LLM answers can miss the window.
    if (config.allowPushFallback && err instanceof HTTPFetchError && err.status === 400) {
      await client.pushMessage({ to, messages });
    } else {
      throw err;
    }
  }
}

async function handleEvent(event: webhook.Event) {
  if (event.type !== "message" || !event.replyToken || !event.source) return;
  const source = event.source;
  const chatId = chatIdOf(source);

  if (event.message.type === "image") {
    if (!config.visionEnabled) return;
    if (source.type !== "user") {
      rememberImage(chatId, { messageId: event.message.id, userId: source.userId, at: Date.now() });
      return;
    }
    // 1:1 chat: translate right away.
    client.showLoadingAnimation({ chatId, loadingSeconds: 60 }).catch(() => {});
    const image = await downloadImage(event.message.id);
    const answer = await handleText(chatId, await senderName(source), "請翻譯並解釋這張照片", [image]);
    return reply(event.replyToken, chatId, answer);
  }

  if (event.message.type !== "text") return;
  const msg = event.message as webhook.TextMessageContent;
  const text = addressedText(source, msg);
  if (text === undefined) return;

  if (source.type === "user") client.showLoadingAnimation({ chatId, loadingSeconds: 60 }).catch(() => {});

  const images: ImageContent[] = [];
  const picked = config.visionEnabled ? pickImage(chatId, msg, source.userId) : undefined;
  if (picked) {
    try {
      images.push(await downloadImage(picked.messageId));
    } catch (err) {
      console.warn("[image] download failed:", (err as Error).message);
      return reply(event.replyToken, chatId, "照片讀取失敗（可能太大或已過期），請重新傳一次 🙏");
    }
  }

  const name = await senderName(source);
  const prompt = text || (images.length ? "請翻譯並解釋這張照片" : "說明");
  return reply(event.replyToken, chatId, await handleText(chatId, name, prompt, images));
}

const app = express();
app.disable("x-powered-by");
app.get("/", (_req, res) => res.send("ok"));
app.post("/webhook", middleware({ channelSecret: config.lineChannelSecret }), (req, res) => {
  // Ack immediately; LINE doesn't need to wait for the LLM.
  res.sendStatus(200);
  for (const event of req.body.events as webhook.Event[]) {
    handleEvent(event).catch((err) => console.error("[webhook] handle failed:", (err as Error).message));
  }
});

// Never leak stack traces to callers.
const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof SignatureValidationFailed) {
    res.sendStatus(401);
    return;
  }
  console.error("[http]", (err as Error).message);
  res.sendStatus(400);
};
app.use(onError);

app.listen(config.port, () => console.log(`🗾 japan-trip-bot listening on :${config.port}/webhook`));

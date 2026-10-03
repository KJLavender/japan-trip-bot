import express, { type ErrorRequestHandler } from "express";
import { messagingApi, middleware, HTTPFetchError, SignatureValidationFailed, type webhook } from "@line/bot-sdk";
import { config } from "./config.js";
import { handleText, resolveSender, HELP, type Sender } from "./handler.js";
import { explainPhoto, pickImage, type RecentImage } from "./photo.js";
import { checkModel } from "./llm-health.js";

if (!config.lineChannelSecret || !config.lineAccessToken) {
  console.error("缺少 LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN，請參考 .env.example");
  process.exit(1);
}

const client = new messagingApi.MessagingApiClient({ channelAccessToken: config.lineAccessToken });
const blobClient = new messagingApi.MessagingApiBlobClient({ channelAccessToken: config.lineAccessToken });
// Short TTL so display-name changes reach the ledger (see syncUser).
const NAME_TTL_MS = 10 * 60 * 1000;
const nameCache = new Map<string, { name: string; at: number }>();

const chatIdOf = (source: webhook.Source) =>
  source.type === "group" ? source.groupId : source.type === "room" ? source.roomId : source.userId!;

async function senderOf(source: webhook.Source): Promise<Sender> {
  const userId = source.userId;
  if (!userId) return { name: "某人" };
  const key = `${chatIdOf(source)}:${userId}`;
  const cached = nameCache.get(key);
  if (cached && Date.now() - cached.at < NAME_TTL_MS) return { id: userId, name: cached.name };
  try {
    const profile =
      source.type === "group" ? await client.getGroupMemberProfile(source.groupId, userId)
      : source.type === "room" ? await client.getRoomMemberProfile(source.roomId, userId)
      : await client.getProfile(userId);
    nameCache.set(key, { name: profile.displayName, at: Date.now() });
    return { id: userId, name: profile.displayName };
  } catch {
    // Keep using the last known name rather than splitting the user into "某人".
    return { id: userId, name: cached?.name ?? "某人" };
  }
}

// ---- 拍照解說：記住群組最近的照片，等有人 @小幫手 時再處理 ----

const recentImages = new Map<string, RecentImage[]>();
const photosEnabled = () => Boolean(config.ocrUrl) || config.visionEnabled;

function rememberImage(chatId: string, img: RecentImage) {
  const now = Date.now();
  const list = (recentImages.get(chatId) ?? []).filter((i) => now - i.at < config.imageWindowMs);
  list.push(img);
  recentImages.set(chatId, list.slice(-10));
}

async function downloadImage(messageId: string): Promise<Buffer> {
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
  return Buffer.concat(chunks);
}

async function photoReply(chatId: string, source: webhook.Source, messageId: string, question: string): Promise<string> {
  let buf: Buffer;
  try {
    buf = await downloadImage(messageId);
  } catch (err) {
    console.warn("[image] download failed:", (err as Error).message);
    return "照片讀取失敗（可能太大或已過期），請重新傳一次 🙏";
  }
  const name = resolveSender(chatId, await senderOf(source));
  return explainPhoto(chatId, name, buf, question);
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
  if (event.type === "join" && event.replyToken) {
    // Replies are free; introduce ourselves once when invited to a group.
    return reply(event.replyToken, chatIdOf(event.source!), `大家好，我是${config.botName} 🗾 旅途中的分帳、日文、記事和拍照翻譯交給我！\n\n${HELP}`);
  }
  if (event.type === "leave") {
    // Data is kept: re-inviting the bot to the same group resumes the same ledger.
    console.log(`[line] removed from ${event.source?.type}`);
    return;
  }
  if (event.type !== "message" || !event.replyToken || !event.source) return;
  const source = event.source;
  const chatId = chatIdOf(source);

  if (event.message.type === "image") {
    if (!photosEnabled()) return;
    if (source.type !== "user") {
      rememberImage(chatId, { messageId: event.message.id, userId: source.userId, at: Date.now() });
      return;
    }
    // 1:1 chat: explain right away.
    client.showLoadingAnimation({ chatId, loadingSeconds: 60 }).catch(() => {});
    return reply(event.replyToken, chatId, await photoReply(chatId, source, event.message.id, ""));
  }

  if (event.message.type !== "text") return;
  const msg = event.message as webhook.TextMessageContent;
  const text = addressedText(source, msg);
  if (text === undefined) return;

  if (source.type === "user") client.showLoadingAnimation({ chatId, loadingSeconds: 60 }).catch(() => {});

  const picked = photosEnabled() ? pickImage(recentImages.get(chatId) ?? [], msg, source.userId) : undefined;
  if (picked) {
    // Answered once; the next mention should not pick the same photo up again.
    recentImages.set(chatId, (recentImages.get(chatId) ?? []).filter((i) => i !== picked));
    return reply(event.replyToken, chatId, await photoReply(chatId, source, picked.messageId, text));
  }

  return reply(event.replyToken, chatId, await handleText(chatId, await senderOf(source), text || "說明"));
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

app.listen(config.port, config.host, () => {
  console.log(`🗾 japan-trip-bot listening on ${config.host}:${config.port}/webhook`);
  void checkModel();
});

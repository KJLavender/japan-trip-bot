import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { config } from "./config.js";

/** LINE ids are alphanumeric; anything else is hashed so it can never escape DATA_DIR. */
export function safeId(chatId: string): string {
  return /^[A-Za-z0-9_-]{1,64}$/.test(chatId) ? chatId : createHash("sha256").update(chatId).digest("hex").slice(0, 32);
}

export const dataPath = (kind: string, chatId: string) => join(config.dataDir, kind, `${safeId(chatId)}.json`);

export function readJson<T>(kind: string, chatId: string, fallback: T): T {
  const file = dataPath(kind, chatId);
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback;
}

export function writeJson(kind: string, chatId: string, value: unknown) {
  mkdirSync(join(config.dataDir, kind), { recursive: true });
  writeFileSync(dataPath(kind, chatId), JSON.stringify(value, null, 2));
}

/** Move a chat's file into DATA_DIR/archive (used when a trip ends). */
export function archiveJson(kind: string, chatId: string) {
  const file = dataPath(kind, chatId);
  if (!existsSync(file)) return;
  const dir = join(config.dataDir, "archive");
  mkdirSync(dir, { recursive: true });
  renameSync(file, join(dir, `${safeId(chatId)}-${kind}-${Date.now()}.json`));
}

// Local REPL to try the bot without LINE: npm run chat -- 小明
import { createInterface } from "node:readline/promises";
import { handleText } from "../src/handler.js";

const name = process.argv[2] ?? "我自己";
const chatId = "local-test";
const rl = createInterface({ input: process.stdin, output: process.stdout });
console.log(`以「${name}」身分聊天（chatId=${chatId}），Ctrl+C 離開。輸入「說明」看指令。`);
for (;;) {
  const text = await rl.question("> ");
  if (!text.trim()) continue;
  console.log(await handleText(chatId, name, text));
}

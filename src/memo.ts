import { readJson, writeJson, archiveJson } from "./store.js";

export interface Memo {
  id: number;
  text: string;
  author: string;
  createdAt: string;
}

interface MemoBook {
  memos: Memo[];
  nextId: number;
}

const MAX_MEMOS = 100;
const MAX_MEMO_LENGTH = 500;

export const loadMemos = (chatId: string): MemoBook => readJson("memos", chatId, { memos: [], nextId: 1 });

export function addMemo(chatId: string, text: string, author: string): Memo {
  const t = text.trim();
  if (!t) throw new Error("記事內容是空的");
  if (t.length > MAX_MEMO_LENGTH) throw new Error(`記事太長了（上限 ${MAX_MEMO_LENGTH} 字）`);
  const book = loadMemos(chatId);
  if (book.memos.length >= MAX_MEMOS) throw new Error(`記事已達 ${MAX_MEMOS} 則上限，請先刪除一些`);
  const memo = { id: book.nextId++, text: t, author, createdAt: new Date().toISOString() };
  book.memos.push(memo);
  writeJson("memos", chatId, book);
  return memo;
}

export function deleteMemo(chatId: string, id: number): Memo {
  const book = loadMemos(chatId);
  const idx = book.memos.findIndex((m) => m.id === id);
  if (idx < 0) throw new Error(`找不到記事 #${id}`);
  const [memo] = book.memos.splice(idx, 1);
  writeJson("memos", chatId, book);
  return memo;
}

export const archiveMemos = (chatId: string) => archiveJson("memos", chatId);

export function formatMemos(chatId: string): string {
  const { memos } = loadMemos(chatId);
  if (memos.length === 0) return "還沒有任何記事。用「記一下：飯店是 xxx」新增。";
  return ["📒 行程記事", ...memos.map((m) => `#${m.id} ${m.text}（${m.author}）`)].join("\n");
}

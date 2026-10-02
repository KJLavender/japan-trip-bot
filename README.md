# 🗾 japan-trip-bot：日本旅遊群組小幫手

一個住在 LINE 旅遊群組裡的 bot。出發前把它拉進群組，旅途中可以用它分帳、查救急日文、記行程，也能拍照翻譯菜單。

- 🧠 使用 [Pi agent](https://github.com/badlogic/pi-mono)（`@mariozechner/pi-agent-core`），搭配本地 [Ollama](https://ollama.com) 模型，不需要付費的 AI API
- 💴 算錢交給程式、不交給 AI：分帳、結算、台幣換算全部由程式計算，小模型也不會算錯
- 🔒 資料都存在你自己的電腦，不會上傳到第三方 AI 服務


---

## ✨ 功能

### 1. 💴 日圓分帳與即時匯率（核心功能）

用平常說話的方式記帳，旅程結束時一鍵結算，算出最少的轉帳次數。

```
小明：@小幫手 一蘭 ¥5,200 我付，四人分
小幫手：已記帳 #1：一蘭 ¥5,200（≈ NT$1,053），小明付，四人平分，每人約 ¥1,300（≈ NT$263）

小華：@小幫手 唐吉訶德 3,300 日圓，我跟阿凱分
阿珍：@小幫手 結算
小幫手：💴 結算（共 3 筆，總計 ¥26,500 ≈ NT$5,368）
        阿凱 → 阿珍：¥7,450 ≈ NT$1,509
        小華 → 阿珍：¥4,150 ≈ NT$841
        小明 → 阿珍：¥600 ≈ NT$122
```

- 「我」會自動對應到發話者，也支援「我跟小華分」這種指定分攤者的說法
- 可以記台幣花費（例如機票），會依當下匯率換算成日圓入帳
- 匯率來自 [open.er-api.com](https://open.er-api.com)（免費、不需要 API key），快取 1 小時
- 分攤金額以整數日圓計算，餘數分給前幾位，總額不會差 1 円

### 2. 🗣 救急日文

```
@小幫手 怎麼說「可以刷卡嗎」

🇯🇵 カードは使えますか？
🔤 カードは つかえますか？
🗣 Kādo wa tsukaemasu ka?
💬 可以刷卡嗎？
```

- 內建 46 句**人工校對**的旅遊常用句，涵蓋付款、餐廳、交通、住宿與緊急狀況。命中句庫就直接回覆，不經過 AI
- 句庫沒有的句子才交給 AI 翻譯，並自動附上「⚠️ AI 翻譯，可能不準確」的提醒

### 3. 📒 行程記事

```
@小幫手 記一下：明天 9:00 新宿站南口集合，飯店 APA 新宿歌舞伎町，訂房代號 HX4821
@小幫手 明天幾點在哪裡集合？
小幫手：根據 #1：明天 9 點在新宿站南口集合！
```

- 群組共用的記事本，每個群組各自獨立
- 問行程問題時，bot 會根據記事回答並標出來源；記事裡沒有的資訊，會直接說沒有，不會亂編

### 4. 📷 拍照翻譯

在群組裡先傳照片，再**回覆（引用）那張照片**並 `@小幫手 翻譯`；一對一聊天直接傳照片就好。

- 菜單、告示、藥妝或食品包裝都可以，會主動提醒酒精、過敏原、生食和藥品注意事項
- 需要能看圖的模型（`qwen3.5:4b` 支援）

---

## 📋 指令一覽

在群組裡，訊息要 **@小幫手** 或以「小幫手」開頭，bot 才會回應；一對一聊天則不需要。

| 指令 | 說明 | 經過 AI? |
|---|---|---|
| `一蘭 ¥5,200 我付，四人分` | 用自然語言記帳 | ✅ |
| `成員 小明 小華 阿珍 阿凱` | 登記旅伴（「四人分」時會用到） | ❌ |
| `帳目` | 列出所有帳目 | ❌ |
| `結算` | 算出誰該轉給誰 | ❌ |
| `刪除 #3` | 刪除記錯的帳 | ❌ |
| `匯率`／`匯率 3000` | 日圓台幣換算 | ❌ |
| `怎麼說「可以刷卡嗎」` | 救急日文（命中句庫時不經 AI） | 有時 |
| `記一下：飯店是 xxx` | 新增記事 | ❌ |
| `記事`／`刪除記事 #2` | 列出或刪除記事 | ❌ |
| `明天幾點集合？` | 根據記事回答行程問題 | ✅ |
| （引用照片）`翻譯` | 拍照翻譯 | ✅ |
| `新旅程` | 封存本趟的帳目、記事和對話，重新開始 | ❌ |
| `說明` | 顯示指令列表 | ❌ |

不經過 AI 的指令會在 1 秒內回覆。

---

## 🚀 安裝與啟動

### 需要準備

- [Node.js](https://nodejs.org) 20 以上
- [Ollama](https://ollama.com)
- 一個 [LINE Developers](https://developers.line.biz) 帳號
- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)（讓 LINE 連到你家的電腦）

### 步驟 1：下載專案並安裝

```bash
git clone https://github.com/KJLavender/japan-trip-bot.git
cd japan-trip-bot
npm install
```

### 步驟 2：下載模型

```bash
ollama pull qwen3.5:4b
```

先不打開 LINE，在本機試玩看看（可以順便確認 Ollama 正常）：

```bash
npm run chat -- 小明
> 成員 小明 小華 阿珍 阿凱
> 一蘭 ¥5,200 我付，四人分
> 結算
```

### 步驟 3：建立 LINE Messaging API channel

1. 到 [LINE Developers Console](https://developers.line.biz/console/) 建立一個 Provider，再建立 **Messaging API** channel
2. 在 **Basic settings** 複製 **Channel secret**
3. 在 **Messaging API** 分頁最下方發行 **Channel access token (long-lived)**
4. 到 [LINE Official Account Manager](https://manager.line.biz/) 調整回應設定：
   - **Allow bot to join group chats**：打開
   - **Auto-reply messages**：關閉
   - **Webhooks**：打開

### 步驟 4：設定 `.env`

```bash
cp .env.example .env
```

填入剛才取得的兩個值：

```ini
LINE_CHANNEL_SECRET=你的 channel secret
LINE_CHANNEL_ACCESS_TOKEN=你的 access token
```

> ⚠️ `.env` 已經被 `.gitignore` 排除，**不要把它 commit 或貼到任何地方**。

### 步驟 5：啟動 bot 並開通外部連線

```bash
npm start                                         # 或 npm run dev（修改程式時會自動重啟）
cloudflared tunnel --url http://localhost:3000    # 另外開一個終端機
```

cloudflared 會給你一個 `https://xxxx.trycloudflare.com` 網址。到 LINE Developers 的 **Messaging API → Webhook URL** 填入：

```
https://xxxx.trycloudflare.com/webhook
```

按 **Verify** 看到 Success 後，打開 **Use webhook**。

> 💡 quick tunnel 的網址每次重啟都會改變。長期使用的話，建議設定 [Cloudflare named tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/) 搭配固定網域。

### 步驟 6：把 bot 拉進旅遊群組

用 LINE 加 bot 好友（LINE Developers 頁面上有 QR code），再邀請它進群組，輸入 `@小幫手 說明` 試試看。

---

## ⚙️ 設定

所有設定都在 `.env`，完整列表請看 [`.env.example`](.env.example)。

| 變數 | 預設值 | 說明 |
|---|---|---|
| `OLLAMA_MODEL` | `qwen3.5:4b` | 使用的模型 |
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | Ollama 的 OpenAI 相容端點 |
| `BOT_NAME` | `小幫手` | bot 的名字（判斷有沒有被叫到時會用） |
| `VISION_ENABLED` | `true` | 是否開啟拍照翻譯 |
| `IMAGE_WINDOW_MINUTES` | `15` | 群組照片在幾分鐘內可以被翻譯 |
| `ALLOW_PUSH_FALLBACK` | `false` | 回覆太慢導致 reply token 過期時，是否改用 push 補送（會用到免費推播額度） |
| `DATA_DIR` | `data` | 資料存放位置 |

想修改 bot 的個性或規則，直接編輯 [`AGENTS.md`](AGENTS.md)（它就是 system prompt），每則訊息都會重新讀取，不需要重啟。

---

## 🏗 架構

```
LINE ─webhook─▶ src/index.ts ──▶ src/handler.ts ──┬─ 固定指令（結算、記事、句庫…）→ 直接回覆
   ▲            簽章驗證、            fast path      │
   │            @mention 判斷、                      └─ 其他 → src/agent.ts（Pi Agent, Ollama）
   │            照片下載                                         │ 呼叫工具
   └──────────── reply ◀──── 後處理：台幣換算、去 Markdown ◀── src/tools.ts
```

| 檔案 | 用途 |
|---|---|
| `src/index.ts` | LINE webhook：簽章驗證、@mention 判斷、照片處理、回覆 |
| `src/handler.ts` | 固定指令的 fast path（不經 AI），其他交給 agent |
| `src/agent.ts` | 每個群組一個 Pi Agent session，負責對話紀錄、記事注入、回覆後處理 |
| `src/tools.ts` | Agent 工具：`add_expense`、`settle_up`、`fx_rate`、`japanese_phrase`、`memo_add` 等 |
| `src/ledger.ts` | 帳本與結算演算法（貪婪法，最多 n−1 次轉帳） |
| `src/phrases.ts` | 人工校對的旅遊日文句庫 |
| `src/memo.ts` | 行程記事 |
| `src/fx.ts` | 匯率查詢，以及把回覆中的台幣金額改成程式計算的結果 |
| `src/store.ts` | JSON 檔案儲存（含路徑安全處理） |
| `AGENTS.md` | System prompt |

資料以 JSON 存在 `data/`，分成 `ledgers/`、`memos/`、`sessions/` 和 `archive/`。

---

## 🔒 資安設計

- **Webhook 簽章驗證**：每個請求都會用 Channel secret 驗證 `x-line-signature`，失敗回 401，不會洩漏錯誤細節
- **機密不進版控**：token 只從環境變數或 `.env` 讀取；`.env` 和 `data/`（含群組 ID、成員名字、帳目）都在 `.gitignore` 裡
- **路徑安全**：寫檔用的 chatId 只接受英數字，其他一律雜湊，避免路徑穿越
- **工具權限最小化**：agent 只能讀寫自己群組的帳本和記事，沒有執行指令、讀任意檔案或上網的工具
- **提示詞注入防護**：記事內容會標示為「資料而不是指令」，算錢的邏輯也不經過 AI
- **資源限制**：訊息上限 1,000 字、照片上限 8 MB、每個群組最多排隊 3 則請求、記事上限 100 則
- **依賴套件**：已開啟 Dependabot 警示。transitive 依賴 `basic-ftp` 的已知漏洞已透過 `overrides` 升級修補

發現資安問題時，請透過 GitHub 的 [Security Advisories](https://github.com/KJLavender/japan-trip-bot/security/advisories/new) 私下回報，不要開公開 issue。

---

## ⚠️ 已知限制

- **電腦要一直開著**：bot 跑在你家的電腦上，人在日本時 bot 才能用（透過 Cloudflare Tunnel 連回家）
- **小模型的能力有限**：`qwen3.5:4b` 用來記帳和回答記事問題沒問題，但句庫外的日文和看圖翻譯偶爾會出錯，例如會把海老天ぷら翻錯。電腦夠力的話，建議換成更大的模型（改 `OLLAMA_MODEL`）
- **回覆速度**：經過 AI 的訊息大約 2～10 秒，拍照翻譯會更久。LINE 的 reply token 有時效，太慢可能回覆失敗，可以視需要開啟 `ALLOW_PUSH_FALLBACK`
- **群組成員**：LINE 未認證的帳號無法取得群組成員名單，所以要用「成員 …」登記，或讓每個人至少跟 bot 講過一次話
- **不提供交通轉乘查詢**：好用的轉乘 API 大多要付費，請直接用 Google Maps

---

## 🧪 開發

```bash
npm test            # 單元測試（分帳、句庫、記事、路徑安全、Markdown 清理）
npm run typecheck   # TypeScript 型別檢查
npm run chat -- 小明 # 本機 REPL，不需要 LINE
npm run dev         # 開發模式（自動重啟）
```

## 📄 授權

[MIT](LICENSE)

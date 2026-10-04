# 🗾 japan-trip-bot: a helper for your Japan trip group chat

**English** | [繁體中文](README.zh-TW.md)

A bot that lives in your LINE travel group. Add it to the group before you leave; on the trip it splits the bill, gives you emergency Japanese phrases, keeps trip notes, and explains photos of menus, medicine and signs.

- 🧠 Built on [Pi agent](https://github.com/badlogic/pi-mono) (`@mariozechner/pi-agent-core`) with a local [Ollama](https://ollama.com) model — no paid AI API needed
- 🧮 **Facts are handled by code; the AI only understands and explains**: money, allergens, alcohol and medicine dosage are decided by code, never guessed by a small model
- 🔒 Everything runs locally by default (Ollama + local OCR); you can switch to Gemini for better accuracy, and the settings decide exactly what data leaves your machine — see [Security](#-security)

> The bot talks to users in Traditional Chinese, so the commands and chat examples below are kept in Chinese with English explanations.

[![CI](https://github.com/KJLavender/japan-trip-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/KJLavender/japan-trip-bot/actions/workflows/ci.yml)


---

## ✨ Features

### 1. 💴 Yen bill splitting with live exchange rates (core feature)

Log expenses the way you'd normally say them, then settle up in one step at the end of the trip with the fewest possible transfers.

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

*(Xiaoming: "Ichiran ¥5,200, I paid, split four ways" → logged as expense #1. Later someone says 「結算」 "settle up" and the bot lists who pays whom.)*

- Common phrasings (amount, payer and split all stated clearly) are **parsed by code**, not the AI — fast and never mis-recorded. Only casual phrasings (e.g. 「一萬八」 "eighteen thousand", 「跟小華對分」 "split with Xiaohua") go to the AI
- 「我」 ("I/me") maps to whoever sent the message, and "split between me and Xiaohua" style phrasing is supported
- If the AI says "logged" without actually logging anything, the bot catches it and asks you to rephrase, so you're never misled into thinking it was recorded
- Changing your LINE display name doesn't break the ledger (LINE userIds are used internally)
- You can log NT$ expenses (e.g. flights); they're converted to yen at the current rate
- Exchange rates come from [open.er-api.com](https://open.er-api.com) (free, no API key), cached for 1 hour
- Shares are computed in whole yen with the remainder given to the first few people, so totals never drift by ¥1

### 2. 🗣 Emergency Japanese

```
@小幫手 怎麼說「可以刷卡嗎」

🇯🇵 カードは使えますか？
🔤 カードは つかえますか？
🗣 Kādo wa tsukaemasu ka?
💬 可以刷卡嗎？
```

*("How do I say 'Can I pay by card?'" → Japanese, kana reading, romaji and the Chinese meaning.)*

- 46 **human-checked** travel phrases covering payment, restaurants, transport, lodging and emergencies. A phrase-book hit is answered directly without the AI
- Anything not in the phrase book is translated by the AI and automatically tagged "⚠️ AI translation, may be inaccurate"

### 3. 📒 Trip notes

```
@小幫手 記一下：明天 9:00 新宿站南口集合，飯店 APA 新宿歌舞伎町，訂房代號 HX4821
@小幫手 明天幾點在哪裡集合？
小幫手：根據 #1：明天 9 點在新宿站南口集合！
```

*("Note: meet at Shinjuku Station south exit at 9:00 tomorrow, hotel APA Shinjuku Kabukicho, booking code HX4821" → "Where and when do we meet tomorrow?" → "Per note #1: 9 o'clock at the Shinjuku Station south exit!")*

- A shared notebook per group; each group's notes are separate
- When you ask about the itinerary, the bot answers from the notes and cites the source; if the notes don't say, it says so instead of making things up

### 4. 📷 Photo explanations: not just translation, but what it means

A translation app turns 「期間限定」 into "limited period" and 「お通し」 into "appetizer" — you can read the words but don't learn that it means "seasonal item, gone when it sells out" or "this little dish is charged". This bot **explains**:

```
🍽 菜單
⚠️ 過敏原：蝦（海老）
⚠️ 通常也含：小麥（天ぷら）、蛋（天ぷら）
🍺 含酒精：ビール、サワー、梅酒

生ビール 580円（≈ NT$117）→ 生啤酒
海老天ぷら 1,200円（≈ NT$243）→ 蝦天婦羅，裹粉油炸
...
```

*(Menu → allergen: shrimp; usually also contains wheat and egg (tempura); contains alcohol: beer, sour, plum wine; then each item with its price in NT$ and an explanation.)*

Pipeline:

```
photo → OCR (local PP-OCRv5, reads vertical text) → classify (menu / medicine / notice / shrine / product)
      → code detects safety info + travel knowledge base lookup → type-specific prompt → AI writes the explanation
```

- **Safety info is detected by code, not the AI**: Japan's 8 mandatory allergens (shrimp, crab, wheat, buckwheat, egg, milk, peanut, walnut), allergens a dish "usually contains", alcohol (non-alcoholic drinks excluded), raw food, medicine category, dosage, and warnings about drowsiness / age / breastfeeding
- **Three-tier dictionary**: ① human-checked travel knowledge base → ② ~5,000 dishes, drinks and fish imported from [Wikidata](https://www.wikidata.org) (CC0, regenerate with `npm run build:dict`) → ③ only words found in neither are sent to Gemini (optional, see below)
- **Hand-curated travel knowledge base**: menu terms (お通し, 替え玉, 食券…), station notices (運転見合わせ, 振替輸送…), ~60 dishes, shrine fortunes and charms
- Medicine explanations flag common misunderstandings, e.g. 「食間」 means *between* meals, not *during* a meal
- When the AI is offline, the bot still replies with the safety info and term explanations found by code

**How to use**: send a photo in the group, then `@小幫手` with any question ("what's this", "can I eat this", "what is this medicine"); photos sent within two minutes are matched automatically. You can also reply to (quote) an older photo and @ the bot. In a 1-on-1 chat, just send the photo.

---

## 📋 Commands

In a group, a message must **@小幫手** or start with 「小幫手」 for the bot to respond; not needed in 1-on-1 chats.

| Command | What it does | Uses AI? |
|---|---|---|
| `一蘭 ¥5,200 我付，四人分` | Log an expense (parsed by code when the phrasing is clear) | Sometimes |
| `成員 小明 小華 阿珍 阿凱` | Register travel companions (used by "split four ways") | ❌ |
| `帳目` | List all expenses | ❌ |
| `結算` | Work out who pays whom | ❌ |
| `刪除 #3` | Delete a wrong entry | ❌ |
| `匯率` / `匯率 3000` | Yen ↔ NT$ conversion | ❌ |
| `怎麼說「可以刷卡嗎」` | Emergency Japanese (no AI on a phrase-book hit) | Sometimes |
| `記一下：飯店是 xxx` | Add a note | ❌ |
| `記事` / `刪除記事 #2` | List or delete notes | ❌ |
| `明天幾點集合？` | Answer itinerary questions from the notes | ✅ |
| Send a photo, then `@小幫手 這啥` | Photo explanation (safety info decided by code) | ✅ |
| `新旅程` | Archive this trip's ledger, notes and chat, and start over | ❌ |
| `說明` | Show the command list | ❌ |

Commands that skip the AI reply within 1 second.

---

## 🚀 Install and run

### Prerequisites

- [Node.js](https://nodejs.org) 20+
- [Ollama](https://ollama.com)
- [Python](https://www.python.org) 3.10+ (OCR for photo explanations; or use Docker instead, see [Deployment](#️-deployment))
- A [LINE Developers](https://developers.line.biz) account
- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) (so LINE can reach the computer at home)

### Step 1: clone and install

```bash
git clone https://github.com/KJLavender/japan-trip-bot.git
cd japan-trip-bot
npm install
```

### Step 2: pull the model

```bash
ollama pull qwen3.5:4b
npm run setup:model      # creates the japan-trip-bot model variant with a 16k context
```

> Why `setup:model`? Ollama's OpenAI-compatible API ignores the context setting and defaults to 4096 tokens, so once a chat gets long the system prompt (rules and notes) is silently truncated. The bot checks this at startup and warns if it isn't set up. Before switching models, see [Model choice](#-model-choice-measured).

### Step 2.5: start OCR (for photo explanations)

```bash
python -m venv ocr/.venv
ocr/.venv/bin/pip install -r ocr/requirements.txt        # Windows: ocr\.venv\Scripts\pip ...
ocr/.venv/bin/python ocr/server.py                        # in another terminal; downloads ~20 MB of models the first time
```

OCR listens only on `127.0.0.1:8001` and runs on the CPU, about 0.2 s per photo. Without OCR, photos are read directly by the vision model, which is slower and less accurate.

Try it locally before setting up LINE (also confirms Ollama works):

```bash
npm run chat -- 小明
> 成員 小明 小華 阿珍 阿凱
> 一蘭 ¥5,200 我付，四人分
> 結算
```

### Step 3: create a LINE Messaging API channel

1. In the [LINE Developers Console](https://developers.line.biz/console/), create a Provider, then a **Messaging API** channel
2. Under **Basic settings**, copy the **Channel secret**
3. At the bottom of the **Messaging API** tab, issue a **Channel access token (long-lived)**
4. In [LINE Official Account Manager](https://manager.line.biz/), adjust the response settings:
   - **Allow bot to join group chats**: on
   - **Auto-reply messages**: off
   - **Webhooks**: on

### Step 4: configure `.env`

```bash
cp .env.example .env
```

Fill in the two values you just got:

```ini
LINE_CHANNEL_SECRET=your channel secret
LINE_CHANNEL_ACCESS_TOKEN=your access token
```

> ⚠️ `.env` is already in `.gitignore`. **Never commit it or paste it anywhere.**

### Step 5: start the bot and open an external connection

```bash
npm start                                         # or npm run dev (auto-restarts on code changes)
cloudflared tunnel --url http://localhost:3000    # in another terminal
```

cloudflared gives you a `https://xxxx.trycloudflare.com` URL. In LINE Developers, set **Messaging API → Webhook URL** to:

```
https://xxxx.trycloudflare.com/webhook
```

Click **Verify**, and once you see Success, turn on **Use webhook**.

> 💡 A quick tunnel's URL changes every restart. For long-term use, set up a [Cloudflare named tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/get-started/) with a fixed domain.

### Step 6: add the bot to your travel group

Add the bot as a LINE friend (the QR code is on the LINE Developers page), invite it to the group, and try `@小幫手 說明` ("help").

---

## ⚙️ Configuration

All settings live in `.env`; see [`.env.example`](.env.example) for the full list.

| Variable | Default | Meaning |
|---|---|---|
| `OLLAMA_BASE_MODEL` | `qwen3.5:4b` | Base model |
| `OLLAMA_MODEL` | `japan-trip-bot` | Model the bot actually calls (created by `setup:model`) |
| `OLLAMA_NUM_CTX` | `16384` | Context length |
| `LLM_TIMEOUT_SECONDS` | `90` | AI response timeout |
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | Ollama's OpenAI-compatible endpoint |
| `BOT_NAME` | `小幫手` | The bot's name (used to detect when it's addressed) |
| `LLM_PROVIDER` | `ollama` | Chat brain: `ollama` (fully local) or `gemini` (chat content goes to Google, local Ollama as automatic fallback); photos are always processed locally |
| `PHOTO_USE_CLOUD` | `false` | `true` = photos are also explained by Gemini (photos go to Google; falls back to local on failure) |
| `GEMINI_CHAT_MODEL` | `gemini-3.1-flash-lite` | Model used when `LLM_PROVIDER=gemini` (see the chat-brain comparison). On the free tier, gemini-3.5-flash measured only 20 calls/day |
| `GEMINI_API_KEY` | (empty) | Optional: ask Gemini about words the dictionaries don't know; empty = off |
| `GEMINI_DAILY_LIMIT` | `300` | Max Gemini calls per day |
| `OCR_URL` | `http://127.0.0.1:8001` | OCR service address; empty = no OCR |
| `VISION_ENABLED` | `true` | Fall back to the vision model when OCR finds no text (auto-disabled if the model can't see images) |
| `IMAGE_WINDOW_MINUTES` | `15` | How many minutes a group photo can still be explained |
| `ALLOW_PUSH_FALLBACK` | `false` | When a slow reply lets the reply token expire, send it as a push message instead (uses your free push quota) |
| `DATA_DIR` | `data` | Where data is stored |

To change the bot's personality or rules, edit [`AGENTS.md`](AGENTS.md) (it *is* the system prompt). It's re-read on every message, no restart needed.

---

## 🧪 Model choice (measured)

Models differ a lot, and **newer isn't necessarily better**. The table below comes from `npm run eval`. The test questions are this bot's real tasks, not a generic benchmark:

- **Expense logging**: only the casual phrasings the rule parser can't handle (e.g. 「一萬八」, 「跟小華對分」, 「X 請大家」 "X treats everyone"), so it tests the model itself
- **Note Q&A**: find dates, codes and times in the notes; say so when the notes don't contain the answer; don't follow prompt injection hidden in a note
- **Photo explanation**: given OCR text, check the explanation (excluding the code-generated safety info)

Tested 2026-10-02 | RTX 3060 Ti 8GB | average of 3 runs per model | 16k context

| Model | Expenses | Note Q&A | Photos | Total | Avg. response | Verdict |
|---|---|---|---|---|---|---|
| **qwen3.5:4b** (default) | 93% | 100% | 100% | **97%** | 1.5s | ⭐⭐⭐⭐ Recommended. Can see images, ~3.6 GB VRAM |
| qwen3:4b | 87% | 50% | 100% | 79% | 14.9s | ⭐⭐ Leaks its reasoning into replies and often times out |
| qwen2.5:7b | 27% | 92% | 75% | 62% | 2.6s | ⭐⭐ Writes tool calls as text; casual expense logging barely works |
| llama3.2:1b | 13% | 33% | 8% | 18% | 1.0s | ⭐ Not recommended |

- Note that "Expenses" only tests casual phrasings. In real use, clear phrasings (「燒肉 18000 円 阿凱付，大家分」 "Yakiniku ¥18,000, Akai paid, everyone splits") are handled by code, so every model scores 100%
- The question set is small (13 questions × 3 runs), so treat it as a reference. If you have a bigger GPU, try `npm run eval -- <model>` and share the results
- To switch models: set `OLLAMA_BASE_MODEL=<model>` in `.env`, then run `npm run setup:model`

### Chat brain comparison (`npm run eval:models`, test data from the web)

The test data is downloaded with `npm run fetch:eval-data` into `test/data/`: Chinese–Japanese travel sentences from [Tatoeba](https://tatoeba.org) (CC BY 2.0 FR, 58 sentences with multiple human translations) and Japanese landmark facts from [Wikidata](https://www.wikidata.org) (CC0; 12 prefecture questions, 8 building-height questions; disputed founding years are deliberately left out). Automatic fallback is disabled during evaluation, so a model failure counts as wrong.

Tested 2026-10-03 | 1 run per model

| Model | Expenses | Note Q&A | Japanese translation (chrF) | Landmark facts correct / **made up** / don't know | Photos* | Avg. response |
|---|---|---|---|---|---|---|
| qwen3.5:4b (local) | 60% | 100% | 40 | 11 / **9** / 0 | 63% | 4.5s |
| gemini-3.5-flash-lite | 100% | 100% | 43 | 13 / **7** / 0 | 44% | 2.8s |
| **gemini-3.1-flash-lite** (in use) | **100%** | **100%** | **60** | **20 / 0 / 0** | **88%** | 4.9s |
| gemma-4-26b | 100% | 75% | 37 | 13 / **7** / 0 | 44% | 4.5s |
| gemma-4-31b | 60% | 100% | 41 | 11 / **9** / 0 | 69% | 3.8s |

*Photos: cloud models were scored by letting them see the photos. The production bot processes photos locally by default; Gemini only sees photos when `PHOTO_USE_CLOUD=true`.

- Landmark knowledge shows the biggest gap: qwen placed Yasukuni Shrine in Hokkaido and Shuri Castle in Shimane; 3.1 Flash Lite got all 20 right and made nothing up
- The newer 3.5 Flash Lite did worse than 3.1 — **always measure before switching models**
- Knowledge scores were manually reviewed (the grader originally read "203.65 m" as 65; fixed)

### Real-photo evaluation (`npm run eval:photos`)

Photo explanations were tested on CC-licensed real photos from the web (handwritten menus, glare on menus, vertical signboards, sushi order sheets, ticket machines, a drugstore, a station service-suspension notice, two photos with no text). The photos aren't in the repo; they're downloaded from their original sources at evaluation time (sources and licenses in [`test/photo-cases.json`](test/photo-cases.json)).

The photos are split into a **tuning set** (9 photos, used while adjusting dictionaries and prompts) and a **holdout set** (7 photos, never used for tuning). **Only the holdout score reflects real quality.**

Tested 2026-10-03 | RTX 3060 Ti 8GB | 3 runs per photo

| Approach | Holdout accuracy | Avg. time | Conclusion |
|---|---|---|---|
| **Current approach**: OCR + code-decided safety info + three-tier dictionary (curated → Wikidata → Gemini) + qwen3.5:4b also sees the photo; photo explanations use a dedicated prompt without chat history | **57%** | **3.2s** | ✅ Adopted |
| Same, but with chat history included | 67–71% | 21–25s | ❌ Too slow, and the score is inflated (on repeated runs of the same photo, the model sees its own previous answer) |
| Early version: OCR + qwen3.5:4b on text only, sharing the chat system prompt | 39% (tuning set) | — | Chat rules interfered with photo explanations, e.g. calling a sushi shop "Ichiran Ramen" |
| qwen3.5:4b reading the image directly (no OCR) | 56% (tuning set) | — | Safety info can't be enforced by code |
| gemma3:4b reading the image directly | 6% (tuning set) | — | Makes things up (called Haneda Airport "Tengoku-ji Airport") |
| qwen2.5vl:7b, qwen3-vl:8b | — | >3 min | An 8GB card has only ~5.5GB usable; the model doesn't fit and part of it runs on the CPU |

Under the same conditions, the Gemini dictionary fallback raised the holdout score from 67% to 71% (with chat history) — a small but real improvement.

Lessons learned:

- **OCR confidence scores are unreliable**: vertical and handwritten text is often "confidently misread", so confidence can't decide whether to look at the image; the model now always sees the photo too
- **Safety info is still decided only by code from the OCR text**; a model looking at the image may invent text that isn't there
- **Models invent prices**: they wrote "580円" for a sign with no price. Now, if a price in the reply can't be found in the OCR text, a warning is attached
- **Models ignore length limits**: the prompt said "at most 12 lines" and they wrote 18–72. Output length is now enforced by code
- **Photo explanations don't need chat history**: including it bloats the prompt to over ten thousand tokens and stretches replies from 3 s to over 20 s
- Typical holdout errors: reading 「鯛焼」 (taiyaki) as 「鰻焼」, calling 「活平目」 (flounder) sea bream — the limits of a 4B model

---

## 🏗 Architecture

Design principle: **if a rule can handle it, don't hand it to the AI**. The AI only "understands casual language" and "explains verified facts in plain words".

```
text ─▶ handler: fixed commands / expense rule parser / Japanese phrase book ──hit──▶ reply directly (no AI)
              │ miss
              ▼
        agent (Pi Agent + Ollama) ──▶ tools (expenses, notes…); the tool result is the final reply
              │
              ▼
        guards: claims "logged" without a tool call → blocked; NT$ amounts recomputed by code; Markdown stripped

photo ─▶ OCR (ocr/server.py) ─▶ classify ─▶ code detects allergens/alcohol/medicine + knowledge base ─▶ dedicated prompt ─▶ agent
```

| File | Purpose |
|---|---|
| `src/index.ts` | LINE webhook: signature verification, @mention detection, join/leave group, photo matching |
| `src/handler.ts` | Fast path for fixed commands, sender mapping (including name-change tracking) |
| `src/expense-parser.ts` | Rule parser for expense messages (unclear phrasing goes to the AI) |
| `src/agent.ts` | One Pi Agent session per group; note injection, timeouts, guards and reply post-processing |
| `src/tools.ts` | Agent tools: `add_expense`, `settle_up`, `fx_rate`, `japanese_phrase`, `memo_add`, etc. |
| `src/photo.ts` | Photo explanations: photo matching, classification, combining safety info with the knowledge base, dedicated prompts |
| `src/knowledge/` | Hand-curated knowledge base: `safety.ts` (allergens, alcohol, medicine), `glossary.ts` (terms, dishes, shrines) |
| `src/ocr.ts`, `ocr/server.py` | OCR client and service (RapidOCR + PP-OCRv5) |
| `src/ledger.ts` | Ledger and settlement algorithm (greedy, at most n−1 transfers) |
| `src/phrases.ts` | Human-checked travel Japanese phrase book |
| `src/memo.ts` | Trip notes |
| `src/fx.ts` | Exchange rates, and replacing NT$ amounts in replies with code-computed values |
| `src/llm-health.ts` | Ollama health check, model capability and context-length checks |
| `src/store.ts` | JSON file storage (atomic writes, safe paths) |
| `AGENTS.md` | System prompt |

Data is stored as JSON under `data/`, split into `ledgers/`, `memos/`, `sessions/` and `archive/`.

---

## ☁️ Deployment

The setup in [Install and run](#-install-and-run) (home computer + Cloudflare quick tunnel) is good for **development, testing and letting friends try it**. To keep the bot running around the clock, pick one of the architectures below.

### Architecture A: one machine at home does everything (Docker Compose)

```bash
cp .env.example .env              # fill in the two LINE values
docker compose up -d              # the bot connects to Ollama on the host
docker compose --profile ollama up -d   # or: run Ollama in a container too (needs NVIDIA Container Toolkit)
```

- The container runs as a non-root user with a read-only root filesystem and all Linux capabilities dropped; only `data/` is writable
- Ports bind only to `127.0.0.1`; expose it through a Cloudflare Tunnel (a named tunnel keeps the URL stable)

### Architecture B (recommended for real use): bot in the cloud, model at home

```
LINE ──▶ cloud VM (bot + data) ──Tailscale private network──▶ home computer (Ollama + GPU)
```

- The cloud VM can be a free or cheap plan like Oracle Cloud Always Free; it only runs the bot and needs no GPU
- **The bot stays online when the home computer is off**: settling up, the ledger, notes, exchange rates and the phrase book don't use the AI and keep working; AI features reply "temporarily offline"
- Install [Tailscale](https://tailscale.com) on both, and set `OLLAMA_BASE_URL=http://<home computer's Tailscale IP>:11434/v1` in the VM's `.env`

> ⚠️ **Ollama has no authentication. Never expose port 11434 to the internet or forward it on your router.** Anyone who can reach it can use your GPU and download or delete models. Connect only over a private network like Tailscale, and have Ollama listen only on `127.0.0.1` or the Tailscale interface — not `0.0.0.0`.

### Architecture A′: one machine at home + Tailscale Funnel (fixed URL, free, no domain)

A Cloudflare quick tunnel's URL changes on every restart. [Tailscale Funnel](https://tailscale.com/kb/1223/funnel) gives you a fixed `https://<hostname>.<tailnet>.ts.net` URL for free, no domain needed:

```bash
# in the Linux / WSL environment running Docker
docker build -t japan-trip-bot . && docker build -t japan-trip-bot-ocr ocr
docker network create jtb-net
docker run -d --name jtb-ocr --restart unless-stopped --network jtb-net -p 127.0.0.1:8001:8001   --read-only --tmpfs /tmp --cap-drop ALL japan-trip-bot-ocr
docker run -d --name jtb-bot --restart unless-stopped --network host --env-file .env   -e HOST=127.0.0.1 -e OLLAMA_BASE_URL=http://127.0.0.1:11434/v1 -e OCR_URL=http://127.0.0.1:8001 -e DATA_DIR=/app/data   -v /var/lib/japan-trip-bot:/app/data --read-only --tmpfs /tmp --cap-drop ALL japan-trip-bot
tailscale funnel --bg 3000      # the first run prints a URL; click Enable in the Tailscale admin console
```

Paste `https://<hostname>.<tailnet>.ts.net/webhook` into LINE's Webhook URL. The containers use `--restart unless-stopped`, so as long as Docker starts on boot, the bot comes back by itself. Funnel exposes only the bot's port 3000; OCR and Ollama stay private.

> Why `--network host` for the bot? In WSL's mirrored networking mode, outbound connections from Docker's bridge network are flaky (connections to `api.line.me` timed out in testing, so the bot couldn't reply); sharing the host network is stable. Because it shares the host network, you must set `HOST=127.0.0.1`, otherwise other devices on your LAN can reach the bot.

### Architecture C: long-term (Homelab)

If you already run K3s or Kubernetes, you can put the bot, Ollama and monitoring (Grafana, Loki) on the same infrastructure. For just this bot, Docker Compose is enough.

### Cost and maintenance

- Running the home computer 24/7 (estimated for an RTX 3060 Ti–class desktop) uses about 50–70 kWh a month, roughly NT$150–250. Consider enabling the AI only while traveling
- Back up regularly: `npm run backup` copies `data/` to `backups/<timestamp>/`
- Free tiers on platforms like Render and Railway usually **have no persistent disk**, so data disappears on restart — not suitable for this bot as-is

---

## 🔒 Security

- **Webhook signature verification**: every request's `x-line-signature` is verified with the Channel secret; failures return 401 without leaking error details
- **No secrets in version control**: tokens are read only from environment variables or `.env`; `.env` and `data/` (group IDs, member names, expenses) are in `.gitignore`
- **Safe paths**: chatIds used in file names accept only alphanumerics; anything else is hashed, preventing path traversal
- **Least-privilege tools**: the agent can only read and write its own group's ledger and notes; it has no tools to run commands, read arbitrary files or access the web
- **Prompt-injection defense**: note contents and OCR text from photos are marked as "data, not instructions"; money and safety decisions don't go through the AI, so injection can't change them
- **Photo privacy**: OCR always runs locally; photos aren't saved, and images are removed from the chat history. By default photos never go to external services; with `LLM_PROVIDER=gemini` and `PHOTO_USE_CLOUD=true`, **photos are sent to Gemini for explanation** (evaluation accuracy 63% → 88%), while allergen, alcohol and medicine safety info is still decided only by local code
- **Gemini chat brain (optional, off by default)**: with `LLM_PROVIDER=gemini`, **what group members say to the bot (including member names, amounts and note contents) is sent to Google**; photos are still processed locally. If Gemini fails or runs out of quota, the bot falls back to the local model
- **Gemini dictionary (optional, off by default)**: only "Japanese fragments read from a photo that the local dictionaries don't know" (e.g. 「もつ鍋」) are sent — no photos, chat content or member names; looked-up words are cached locally and never re-sent. Medicine photos never use Gemini. ⚠️ Content sent to Gemini's free tier may be used by Google to improve its products and reviewed by humans; if that concerns you, don't set `GEMINI_API_KEY`. The API key goes in an HTTP header, never in URLs or logs
- **Resource limits**: messages up to 1,000 characters, photos up to 8 MB, at most 3 queued messages per group and 8 across all groups, at most 100 notes, 90-second AI timeout
- **Container hardening**: the bot and OCR both run as non-root with read-only root filesystems, all capabilities dropped and `no-new-privileges`; the bot's port binds only to 127.0.0.1 and OCR exposes no port; OCR models are downloaded at build time, so no network is needed at runtime
- **Data integrity**: files are written atomically (write a temp file, then rename), so a crash never leaves a half-written ledger
- **Dependencies**: CI runs `npm audit` on every build, and Dependabot alerts are enabled. A known vulnerability in the transitive dependency `basic-ftp` is patched via `overrides`

If you find a security issue, please report it privately via GitHub [Security Advisories](https://github.com/KJLavender/japan-trip-bot/security/advisories/new) rather than opening a public issue.

---

## ⚠️ Known limitations

Please understand these before using the bot. Ordered by impact:

### 1. The AI can still be wrong (hallucination)

- **Medical, medicine and allergy information is for reference only; always go by the original packaging and what the pharmacist or staff tell you.** Code can only detect wordings listed in the knowledge base; a different wording, or an ingredient not printed on the photo, won't be detected. Not detected doesn't mean not present
- Photo explanations are written by the AI and may mistranslate dish names, miss information, or even invent prices that aren't on the photo (about 57% accuracy on real photos it had never seen). Every photo reply includes a reminder, with an extra warning when prices don't match the OCR
- Japanese outside the phrase book is translated by the AI and may be wrong; replies include a warning
- Casual expense phrasings (e.g. 「一萬八」, 「跟小華對分」) rely on the AI and may record the wrong person or amount — check the confirmation message; if the AI claims "logged" without actually logging, the bot catches it

### 2. Model quality determines the experience

- The default `qwen3.5:4b` is a compromise that runs smoothly on an 8GB GPU and scored 97% overall, but the test set is small and real use can still go wrong (see [Model choice](#-model-choice-measured))
- Run `npm run eval` before switching models; newer isn't always better — some models write tool calls as text and can't log expenses at all

### 3. The knowledge base is limited

- ~60 dishes and ~80 terms; quality drops for regional dishes or uncommon terms
- PRs to extend `src/knowledge/` are welcome (please include a source or how you verified it)

### 4. Concurrent use queues up

- All groups share one Ollama, which handles one AI request at a time. Each takes about 1–10 s, so when everyone sends photos at once, later requests wait
- At most 3 queued per group and 8 in total; beyond that the bot asks everyone to wait
- Commands that don't use the AI (settle up, notes, phrase book, clear expenses) aren't affected

### 5. Photos

- OCR often misreads handwritten, vertical or glare-affected text; the model also looks at the photo to correct it, but vertical signboards and ticket machines are still error-prone
- An 8GB GPU can't run vision models of 7B or larger (see [Real-photo evaluation](#real-photo-evaluation-npm-run-evalphotos)); the local models have limited knowledge, e.g. they don't recognize shark fin and mistake omikuji for shimenawa
- Menu items shown only as pictures, with no text, can't be explained

### 6. When notes pile up

- All notes go into the AI's context (up to 100). With many notes, a small model may not find the right one. A structured itinerary (day, time, place) is planned so questions like "where are we staying on day 3" can be answered by lookup

### 7. LINE platform limits

- Unverified LINE accounts can't get a group's member list, so register members with 「成員 …」 or have everyone talk to the bot at least once
- When someone changes their LINE name, the ledger updates the next time they speak
- Data is kept when the bot is removed from a group; re-inviting it to the same group continues the old ledger
- Replies have a time limit (reply token); if the AI is too slow the reply may fail — enable `ALLOW_PUSH_FALLBACK` if needed (uses your monthly free push quota)

### 8. Running costs

- "Free" assumes you already have the computer, electricity and internet. See [Deployment](#️-deployment) for 24/7 power costs and backups
- If it runs only on the home computer, the bot is completely unavailable when that computer is off; consider Architecture B

### 9. Not yet available

- Transit directions: Japanese rail data is license-restricted and the Google Maps API doesn't return public transit routes. Hand-curated common routes with Google Maps links are planned

---

## 🧪 Development

```bash
npm test            # unit tests (bill splitting, expense parsing, photo classification and safety detection, phrase book, notes, renames, path safety…)
npm run typecheck   # TypeScript type check
npm run eval -- qwen3.5:4b gemma3:4b   # model evaluation (needs Ollama)
npm run setup:model # create the model variant with a larger context
npm run chat -- 小明 # local REPL, no LINE needed
npm run dev         # dev mode (auto-restart)
npm run backup      # back up data/
npm run build       # compile to dist/ (used by Docker)
```

## 📄 License

[MIT](LICENSE)

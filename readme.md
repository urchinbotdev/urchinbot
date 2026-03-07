# urchinbot

A local-first AI agent that lives in your browser. It thinks step-by-step, scans Solana tokens, tracks wallets, builds websites, and remembers everything - powered by **UrchinLoop**, a custom reasoning engine with 55 tools.

![urchinbot](https://github.com/urchinbotdev/urchinbot/blob/main/urchinbot.png)

[Website](https://urchinbot.fun) | [Twitter/X](https://x.com/urchinbot) | [GitHub](https://github.com/urchinbotdev/urchinbot) | [Install](https://github.com/urchinbotdev/urchinbot/blob/main/urchinbot_v0.110.zip)

---

## Install

> Download VIA chromestore (Updates might not be as frequent as github) [urchinbot on Chromestore](https://chromewebstore.google.com/detail/urchinbot/imckdppocjejemgfdbllcdkdeinmkeno)

1. Download [urchinbot_v0.13.zip](https://github.com/urchinbotdev/urchinbot/blob/main/urchinbot_v0.13.zip)
2. Unzip it
3. Go to `chrome://extensions` > turn on **Developer mode**
4. Click **Load unpacked** > select the `urchinbot-extension` folder
5. Pin urchinbot from the puzzle piece icon

---

## Features

### Agent Chat

Full AI agent overlay on any webpage - 55 tools, chain-of-thought reasoning, up to 24 chained tool calls per request.

**Crypto Intelligence**
- Live token prices via Jupiter with change tracking
- DexScreener integration - volume, liquidity, FDV, 5m/1h/6h/24h price changes, inline chart previews
- Token scanning - top holders, concentration, risk score (1-100), fresh wallet flags
- Multi-token comparison - scan up to 5 tokens side-by-side
- Cross-referencing - detects holder overlaps between scanned tokens
- Wallet balance, token holdings, and transaction history
- Auto-detects crypto pages (DexScreener, Birdeye, pump.fun, Jupiter, Solscan)

**Web & Vision**
- Real-time web search via DuckDuckGo
- Screenshot capture and visual analysis
- Reverse image search - identify people, memes, logos
- Read and summarize any URL

**Memory & Context**
- Sees your current page, selected text, tweets, DEX pairs, wallet addresses
- Semantic memory search with embeddings + cosine similarity
- Relevance-filtered injection - only relevant memories loaded, not everything
- Remembers wallets, preferences, and conversations permanently

**Responses**
- Markdown rendering with bold, links, lists, code
- Inline clickable address cards - click any Solana address to scan
- Streaming text in real-time
- Thumbs up/down feedback on every response
- Retry any response with one click
- Export chat as Markdown

---

### Wallet PnL & Activity Tracking

Track wallets and get automatic notifications when they make moves - zero LLM cost for polling.

| Feature | Details |
|---------|---------|
| **PnL Check** | Full portfolio report - SOL + all tokens valued in USD, delta since last check |
| **Watchlist** | Track up to 20 wallets with labels, persists across sessions |
| **Activity Tracker** | Polls via RPC + Jupiter (no LLM calls). Detects buys, sells, large SOL moves |
| **Notifications** | Auto-pings on significant moves (configurable USD threshold) |
| **Daily Digest** | Scheduled briefing with PnL changes and activity summary across all watched wallets |
| **PnL Cards** | Shareable visual snapshots - % change since first scan, downloadable PNG |

---

### Pump.fun Trading & Deploy

Direct on-chain pump.fun operations powered by a locally encrypted deployer wallet. No external wallet popups, no third-party APIs for signing - the agent builds, signs, and broadcasts transactions directly.

| Feature | Details |
|---------|---------|
| **Token Info** | Real-time bonding curve state, graduation progress %, market cap, reply count |
| **Buy** | Buy tokens on the pump.fun bonding curve - amount in SOL, configurable slippage and priority fee |
| **Sell** | Sell tokens - amount in tokens or percentage, same configurable params |
| **Deploy** | Launch a new token on pump.fun - name, ticker, description, image, optional initial buy in a single atomic transaction |
| **Vanity Mint** | Provide a pre-ground keypair for a custom contract address |
| **Deployer Wallet** | AES-256-GCM encrypted private key stored locally, unlocked with a PIN per transaction |

Transactions interact directly with the Pump program (`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`) on Solana. Deploy uses `createV2` (Token2022) with atomic create+buy in a single transaction. All PDAs are derived locally. Signed with Ed25519 (tweetnacl) and broadcast to your configured Solana RPC. Use a burner wallet - never your main.

---

### X/Twitter Research

Scrape Twitter/X data directly from the agent for sentiment analysis and research - no API keys required.

| Feature | Details |
|---------|---------|
| **Profile Lookup** | Bio, follower/following count, verified status, profile image |
| **Tweet Search** | Search recent tweets by keyword - full text, engagement metrics, timestamps |
| **User Tweets** | Fetch a user's recent tweets with retweet/like/reply counts |

Uses guest token authentication against Twitter's v1.1 and GraphQL APIs.

---

### Companion Mode

Floating mascot that follows you across every page.

- Drag anywhere - position persists across pages
- Hover for quick-chat button
- Chat bubble replies with typewriter effect
- Dismissable - won't re-show the same message
- Click to open full panel
- Background results appear in the bubble + badge on mascot
- Unified history - companion and panel share the same conversation

---

### Site Builder

Describe a site > get full HTML/CSS/JS > edit with prompts > deploy to Netlify.

- AI self-critique scores design (1-10), auto-fixes below 8
- Live site tracking with green LIVE indicator
- Edit and push live in one click
- Upload images or grab from any page
- Preview, download ZIP, or deploy
- Manage all Netlify sites - view, visit, bulk-delete

---

### Autonomous Tasks & Monitoring

The agent works in the background - but only when you ask.

| Tool | What It Does |
|------|-------------|
| **Monitor** | Recurring checks on a schedule (min 5 min). Full agent loop each tick with change detection. Auto-expires after 6 hours |
| **Set Timer** | One-shot delayed task - runs full agent loop when it fires |
| **Schedule Task** | Queue immediate background work, non-blocking |
| **List / Stop** | View active monitors or cancel any time |

Results delivered via chat, companion bubble, and Chrome notifications.

---

### Self-Evolving Skills

The agent learns from every interaction and gets better over time. [Full skills guide >](docs/skills.md)

- Saves preferences and patterns automatically
- Every skill has a quality score (0-100) updated via evaluation + user feedback
- Thumbs up/down directly adjusts skill scores
- Detects satisfaction signals - corrections, praise, frustration
- Auto-prunes low-scoring and unused skills
- Ask "what have you learned?" to see all skills, or tell it to forget one

---

### Goal Tracking

Multi-session project planning that persists across conversations.

- Set goals with milestones and descriptions
- Update progress, mark milestones done
- Active goals auto-loaded into every conversation
- Up to 10 concurrent projects

---

### Goal Decomposition

Complex multi-phase requests are automatically broken into ordered subtasks with dependency tracking, executed recursively through the full loop, then synthesized into a single response.

---

### Token Scanner

Paste any Solana mint address > top holders, concentration, risk score, cross-referencing, fresh wallet flags, Solscan links.

---

### Right-Click Menu

Send text, links, images, or full page context to urchinbot from any page.

---

## Agent Tools (55)

![urchinbot Toolkit](https://github.com/urchinbotdev/urchinbot/blob/main/diagrams/urchinloop-tools.png)

<details>
<summary>View all 55 tools</summary>

| Tool | What It Does |
|------|-------------|
| Web Search | Real-time search via DuckDuckGo |
| Screenshot | Capture and visually analyze current page |
| Reverse Image Search | Identify people, memes, logos via vision + web search |
| Fetch URL | Read and summarize any webpage |
| Token Price | Live Solana token price via Jupiter |
| DexScreener Charts | Market data - price changes, volume, liquidity, FDV, inline chart preview |
| Wallet Balance | SOL + token holdings via RPC |
| Wallet History | Recent transaction history |
| Token Scan | Top holders, concentration, risk score |
| Multi-Scan | Compare up to 5 tokens side-by-side |
| Detect Mints | Extract Solana addresses from text |
| PnL Check | Full portfolio report with USD values |
| Watch / Unwatch Wallet | Manage persistent watchlist |
| List Watchlist | Show all watched wallets |
| Wallet Activity | Query tracked buys, sells, SOL moves |
| Set / Get Digest | Configure daily briefing schedule |
| PnL Card | Visual PnL snapshot with downloadable PNG |
| List Scans | View all scanned tokens with entry prices |
| Build Site | Generate static website with AI self-critique |
| Edit Site | Modify with follow-up prompts |
| Deploy Site | Push to Netlify |
| List / Delete Sites | Manage Netlify deploys |
| Token Launch | Pump.fun auto-fill |
| Memory (Remember/Recall) | Save and retrieve info across sessions |
| Search Memory | Semantic search via embeddings |
| Set Alert | Price and wallet alerts with notifications |
| Remind Me | Scheduled follow-ups with intelligent execution |
| Set Timer | Delayed background tasks |
| Schedule Task | Immediate non-blocking background work |
| Monitor / List / Stop | Recurring checks with change detection |
| Continue | Self-extend reasoning budget (up to 24 steps) |
| Learn / List / Forget Skill | Self-evolving behavioral instructions |
| Set / Update / Get Goals | Multi-session project planning |
| Set My Wallet | Save your main Solana wallet for PnL tracking |
| Get My Wallet | Check saved wallet address |
| Set Deployer Key | Save encrypted deployer wallet for on-chain ops |
| Get Deployer Key | Check deployer public address and balance |
| Pump Token Info | Pump.fun bonding curve state, graduation %, market cap |
| Pump Buy | Buy tokens on pump.fun bonding curve (signed locally) |
| Pump Sell | Sell tokens on pump.fun bonding curve |
| Pump Deploy | Launch a new token on pump.fun with optional initial buy |
| X Profile | Fetch Twitter/X profile data (bio, followers, verified) |
| X Search | Search recent tweets by query for sentiment/research |
| X User Tweets | Get a user's recent tweets with engagement metrics |

</details>

---

## How UrchinLoop Works

UrchinLoop is the agent runtime behind urchinbot - a multi-step reasoning engine, not a chatbot wrapper.

Every request enters a loop: **think > act > observe > decide**. The agent can chain up to 24 tool calls, fire tools in parallel, extend its own step budget, schedule follow-up work, and learn from the interaction.

### Architecture

![UrchinLoop Architecture](https://github.com/urchinbotdev/urchinbot/blob/main/diagrams/urchinloop-architecture.png)

### The Loop

![UrchinLoop Reasoning Pipeline](https://github.com/urchinbotdev/urchinbot/blob/main/diagrams/urchinloop-flow.png)

### Routing

Requests are classified before entering the loop:

| Type | Steps | Examples |
|------|-------|---------|
| Quick | 1 | Greetings, memory lookups |
| Standard | 3 | Price checks, web searches |
| Deep | 8+ | Multi-tool analysis, research chains |

The agent can self-extend mid-loop with the CONTINUE tool, up to 24 steps.

### Parallel Execution

Independent tools fire simultaneously:

```
THINK: "I need price, DexScreener data, and deployer wallet"
  |-> GET_TOKEN_PRICE  
  |-> DEX_DATA           all return -> next THINK step
  |-> GET_WALLET_BALANCE 
```

---

## Memory System

![UrchinLoop Memory System](https://github.com/urchinbotdev/urchinbot/blob/main/diagrams/urchinloop-memory.png)

| Layer | What | Limits |
|-------|------|--------|
| Condensed History | Compressed narrative of all past conversations | Never expires |
| Recent Chat | Last 30 messages at full fidelity | Rolling |
| User Profile | Auto-extracted knowledge (wallets, preferences) | 50 keys max |
| Session Summaries | Bullet points from past sessions | Last 20 |
| Manual Memories | Anything you tell it to remember | 100 max |
| Learned Skills | Behavioral instructions, scored 0-100 | Auto-pruned |
| Project Plans | Goals, milestones, progress | 10 max |

**Context rot prevention** - memory injection is relevance-filtered using embeddings. Only memories matching your current message are loaded. Skills below score threshold are excluded. Hard context budget of 80K chars. Tool outputs are capped per-tool.

Click the **brain icon** in the Ask tab to view or wipe all memory.

---

## Setup

Click the urchinbot icon > **Settings**.

### LLM Provider (required)

| Provider | Get Key | Recommended Model | Cost |
|----------|---------|-------------------|------|
| **Ollama (Local)** | No key needed — [install Ollama](https://ollama.com) | llama3.1 or qwen2.5:14b | **Free** |
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | gpt-4.1 or gpt-4.1-mini | Paid |
| Anthropic | [console.anthropic.com](https://console.anthropic.com/settings/keys) | claude-sonnet-4-20250514 | Paid |
| OpenAI Compatible | Your provider's dashboard | Any chat model | Varies |

**Run for free with Ollama** — install Ollama, pull a model (`ollama pull llama3.1`), select "Ollama (Local — Free)" in settings. All AI runs on your machine with zero cost and full privacy. [Full Ollama setup guide >](docs/ollama-guide.md)

For fastest cloud replies, use **gpt-4.1-mini** or **Claude 3.5 Haiku**.

### Solana RPC (optional)

Required for token scanning, wallet checks, transaction history, and pump.fun trading.

| Provider | Free Tier |
|----------|-----------|
| [Helius](https://www.helius.dev) | 100k requests/day |
| [QuickNode](https://www.quicknode.com) | Limited |

### Netlify Token (optional)

For one-click deploys: [Get token](https://app.netlify.com/user/applications#personal-access-tokens) > name it `urchinbot` > paste in Settings.

---

## Example Prompts

```
what are you?
what token is this page about?
search for latest Solana news
what's the price of JUP?
```

```
check wallet 7xKX... balance and recent transactions
compare these tokens: MINT1, MINT2, MINT3
take a screenshot and tell me what you see
reverse image search this meme
```

```
build me a crypto dashboard with dark theme
deploy my site to netlify
edit the footer and push it live
```

```
monitor this token every 15 minutes
check this token again in 30 minutes
watch this wallet - label it "whale1"
set up daily digest at 8:30am
show my pnl on BONK
```

```
set a goal: launch token landing page by Friday
what skills have you learned?
what do you remember about me?
```

```
get pump.fun info on <mint>
buy 0.1 SOL of <mint> on pump.fun
deploy a token called URCHIN with ticker $URCH
look up @urchinbot on twitter
search tweets about "solana memecoin"
```

---

## Project Structure

```
urchinbot-extension/
  manifest.json           Chrome MV3 config
  background.js           UrchinLoop engine, 55 tools, autonomous tasks, monitors,
                          direct on-chain pump.fun deploy (createV2 + buy)
  content.js              Overlay UI, companion mode, page context
  sidepanel.html/js       Chrome side panel UI
  popup.html/js           Toolbar menu
  options.html/js         Settings page
  styles.css              Host element styles
  urchin.png              Logo
  icons/                  Toolbar icons
  lib/
    jszip.min.js          ZIP generation for site builder
    nacl-fast.min.js      Ed25519 signing (tweetnacl) for Solana transactions
    solana-lite.js        Minimal Solana primitives (keypair, base58, RPC, tx building,
                          PDA derivation, ATA derivation, Borsh serialization)

vanity-grinder/           Standalone vanity mint address grinder
pump-dev-updates/         Pump.fun program update changelog & knowledge base
launchpad-plan/           Urchin Launchpad architecture & revenue model plan
urchinloop/               Portable UrchinLoop engine (standalone)
diagrams/                 Architecture diagrams, flow charts, promo assets
docs/                     Skills guide and documentation
```

---

## Security

- **Local-first** - all keys and data stay in `chrome.storage.local`
- **Deployer key encrypted** - AES-256-GCM with PBKDF2-derived key from your PIN, never stored in plaintext
- **No custodial access** - the agent never sees your main wallet's private key
- **No tracking** - zero analytics, zero telemetry
- **External calls only to** - your LLM provider, Solana RPC, DuckDuckGo, Jupiter, DexScreener, Netlify, pump.fun API (metadata upload), Twitter/X API
- **Background tasks** - run in your browser's service worker, not on any remote server
- **Deployer wallet** - use a dedicated burner wallet, never your main

---

## Roadmap

- Telegram bot - same agent, same tools, no extension
- Skill sharing - export/import between users
- Custom tool definitions - teach it to call new APIs
- Multi-agent collaboration - specialist sub-agents for complex tasks
- Vision-in-the-loop - multimodal reasoning during tool chains
- Code execution sandbox

---

## Disclaimers

Not financial advice. Memecoins are risky. DYOR.

- Pump.fun buy/sell/deploy execute real on-chain transactions signed with your deployer wallet - double-check amounts and slippage
- AI-generated websites should be reviewed before production use
- Token scanning shows on-chain data - interpretation is up to you
- Background tasks consume LLM API credits when they execute
- X/Twitter scraping uses guest tokens - availability depends on Twitter's rate limits

---

## Guides & Documentation

| Guide | Description |
|-------|-------------|
| [Run Free with Ollama](https://github.com/urchinbotdev/urchinbot/blob/main/ollama-guide.md) | Set up urchinbot with local AI — zero cost, full privacy, no API key |
| [Free Cloud Providers](docs/free-providers.md) | Use Groq, Cerebras, or Google AI Studio for free cloud-hosted AI |
| [Self-Evolving Skills](docs/skills.md) | How the agent learns, scores, and prunes behavioral skills |
| [UrchinLoop Engine](urchinloop.md/) | Portable reasoning engine — drop into any JS project |

---

## License

MIT

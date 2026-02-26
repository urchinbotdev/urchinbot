# urchinbot

**urchinbot** — a local-first AI agent that lives in your browser (and soon, your Telegram). It thinks step-by-step, searches the web, scans Solana tokens, checks wallets, builds and deploys websites, manages your Netlify sites, and remembers everything across sessions. Powered by UrchinLoop.

> Telegram bot coming soon. Same brain. Same tools. No extension needed.

**Follow:** [x.com/urchinbot](https://x.com/urchinbot)

![urchinbot](https://github.com/urchinbotdev/urchinbot/blob/main/urchin.png)

## Install

**Chrome Web Store (recommended):**

> Coming soon — [Chrome Web Store Link Placeholder]

**Manual install (developer mode):**

1. Download or clone this repo
2. Open Chrome and go to `chrome://extensions`
3. Turn on **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `urchinbot-extension` folder
6. Pin urchinbot from the puzzle piece icon in your toolbar

## What It Does

### Agent Chat (Ask Tab)

A full AI agent overlay on any webpage. It reasons step-by-step with mandatory chain-of-thought, uses 16 tools, and remembers everything across sessions.

- Sees your current page, selected text, tweets, DEX pairs, and wallet addresses
- Auto-detects crypto pages (DexScreener, Birdeye, pump.fun, Jupiter, Solscan, Raydium)
- Searches the web for real-time prices, news, and project info
- Takes screenshots and visually analyzes pages
- Checks live Solana token prices via Jupiter
- Scans any wallet for SOL balance, token holdings, and transaction history
- Compares multiple tokens side-by-side for safety
- Reads any URL you paste and summarizes it
- Remembers your wallets, preferences, and past conversations permanently
- Builds, edits, and deploys websites directly from chat
- Lists and deletes your Netlify sites from chat
- Plans multi-step tasks with up to 12 chained tool calls

### Site Builder (Build Tab)

Describe a website in plain text and get a full static site (HTML + CSS + JS) with self-critique quality review.

- AI critic scores the design and auto-fixes issues before delivery
- Upload images from your computer or grab them from any page
- Grabbed images are embedded directly into the built site
- Preview inline, download as ZIP, or deploy to Netlify in one click
- Manage all your Netlify sites — view, visit, or bulk-delete old deploys

### Token Deployer (Deploy Tab)

Prepare pump.fun launch packets with auto-fill.

- Fill in token name, symbol, description
- Upload a token image
- Click to open pump.fun/create with everything pre-filled (including the image)
- Generate a token landing page and deploy it live to Netlify
- Pull launch info from your chat history automatically

### Token Scanner (Scan Tab)

Paste any Solana mint address and see:

- Top 10 holders with ownership percentages
- Holder concentration analysis
- Fresh wallet flags (potential sybil/rug signals)
- Direct links to Solscan

### Right-Click Menu

- **Send selection** — highlight text and send to urchinbot
- **Send link** — right-click any link
- **Send image** — right-click any image
- **Capture page** — send full page context

## Setup

Click the urchinbot icon, then **Settings**.

### LLM Provider (required)

Powers all AI features. Choose one:

| Provider | Get Key | Recommended Model |
|----------|---------|-------------------|
| OpenAI | https://platform.openai.com/api-keys | gpt-4o or gpt-4o-mini |
| Anthropic | https://console.anthropic.com/settings/keys | claude-sonnet-4-20250514 |
| OpenAI Compatible | Your provider's dashboard | Any chat model |

For OpenAI Compatible providers (Groq, Together, Ollama, etc.), also set the base URL.

### Solana RPC (optional)

Required for token scanning, wallet checks, and transaction history.

| Provider | Link | Free Tier |
|----------|------|-----------|
| Helius | https://www.helius.dev | 100k requests/day |
| QuickNode | https://www.quicknode.com | Limited |

### Netlify Token (optional)

Required for one-click web deploy and site management.

1. Go to https://app.netlify.com/user/applications#personal-access-tokens
2. Create a new token named `urchinbot`
3. Paste it in Settings

## Example Prompts

```
what are you?
what token is this page about?
search for latest Solana news
what's the price of JUP?
check wallet 7xKX... balance and recent transactions
compare these tokens: MINT1, MINT2, MINT3
take a screenshot and tell me what you see
read this URL: https://example.com/article
build me a crypto dashboard with dark theme
deploy my site to netlify
show me my netlify sites
delete the old ones
change the hero section to a gradient background
deploy a token called DogWifHat with ticker WIF
remember my wallet is 7xKX...
what do you remember about me?
```

## Agent Tools (16)

| Tool | What It Does |
|------|-------------|
| Web Search | Real-time search via DuckDuckGo |
| Screenshot | Captures and visually analyzes current page |
| Fetch URL | Read and summarize any webpage |
| Token Price | Live Solana token price via Jupiter |
| Wallet Balance | SOL + top token holdings via RPC |
| Wallet History | Recent transaction history for any wallet |
| Token Scan | Top holders, concentration, fresh wallet flags |
| Multi-Scan | Compare up to 5 tokens side-by-side for safety |
| Detect Mints | Extract Solana addresses from any text |
| Build Site | Generate full static website with AI self-critique |
| Edit Site | Modify existing site via chat |
| Deploy Site | Push current site to Netlify from chat |
| List Sites | Show all your Netlify sites |
| Delete Site | Remove a Netlify site by ID |
| Token Launch | Prepare pump.fun launch packet + auto-fill |
| Memory | Save/recall info across sessions (REMEMBER/RECALL) |

## How UrchinLoop Works

UrchinLoop is the agent runtime that powers urchinbot. It's not a chatbot — it's a reasoning loop that thinks, plans, acts, and learns.

### The Loop

Every time you send a message, UrchinLoop runs this cycle:

```
You send a message
       |
  [Load Memory] — condensed history, user profile, session summaries, saved memories
       |
  [Build Context] — page URL, visible text, selected text, tweets, DEX pairs,
                     crypto links, form data, uploaded files, current project
       |
  [Auto-Detect] — identify page type (DexScreener, Birdeye, pump.fun, etc.),
                   extract mint addresses, cashtags, prices from the page
       |
  [THINK] — agent reasons internally (hidden from you):
            "What does the user want? What tools do I need? What do I already know?"
       |
  [ACT] — call a tool (search, scan, screenshot, build, deploy, fetch, remember...)
       |
  [OBSERVE] — get the tool result back
       |
  [DECIDE] — need more info? loop back to THINK > ACT > OBSERVE (up to 12 steps)
             have enough? write the final answer
       |
  [RESPOND] — send the answer back to you
       |
  [REMEMBER] — background: save session summary, update user profile,
               compress old history (non-blocking, doesn't slow you down)
```

The agent can chain up to 12 tool calls in a single request. For example, asking "compare these 3 tokens and check the deployer wallets" might trigger: MULTI_SCAN then GET_WALLET_BALANCE then GET_WALLET_HISTORY then WEB_SEARCH then final analysis.

### What Makes It Smart

- **Mandatory chain-of-thought** — the agent thinks before every action, planning its approach in hidden reasoning blocks
- **Auto-context** — detects what kind of crypto page you're on and pre-loads relevant data (mints, pairs, prices) without you asking
- **Proactive behavior** — notices patterns, suggests next steps, cross-references data between scans, and learns your preferences
- **Self-critique on builds** — AI critic scores the design (1-10) and auto-fixes issues if below 8
- **Non-blocking memory** — memory updates happen in the background after the response, so you never wait

## Agent Memory

The agent has a 5-layer memory system:

1. **Condensed History** — compressed narrative of all past conversations (never expires)
2. **Recent Chat** — last 30 messages at full fidelity
3. **User Profile** — auto-extracted permanent knowledge (wallets, preferences, projects)
4. **Session Summaries** — detailed bullet points from past sessions (last 20 kept)
5. **Manual Memories** — anything you tell it to remember

Click the **brain icon** in the Ask tab to view or wipe all memory.

## Project Structure

```
urchinbot-extension/
  manifest.json       Chrome MV3 config
  background.js       Service worker, agent loop, LLM, 16 tools
  content.js          Overlay UI, Shadow DOM, smart page context
  styles.css          Host element styles
  popup.html          Toolbar bubble menu
  popup.js            Popup logic
  options.html        Settings page
  options.js          Settings save/load, model picker
  urchin.png          Logo
  icons/              16, 48, 128px toolbar icons
  lib/jszip.min.js    ZIP generation (vendored)
```

## Security

- **Local-first** — all keys and data stay in chrome.storage.local on your machine
- **No custodial keys** — never asks for or stores seed phrases or private keys
- **No tracking** — zero analytics, zero telemetry, zero data collection
- **External calls** — only to your configured LLM provider, Solana RPC, DuckDuckGo (search), Jupiter (prices), and Netlify (deploy)
- **Memory is local** — persistent memory stored in chrome.storage.local, never sent to external servers

## Roadmap

### Coming Soon

- Telegram bot — full urchinbot agent in your DMs, same 16 tools and memory
- Upgraded agent reasoning — deeper multi-step planning, smarter tool selection
- One-command site deploys with custom domains
- Token launch automation improvements

### Future

- Announcements Coming Soon!

## Disclaimers

This is a research and experimentation tool. Not financial advice.

- Memecoins are extremely risky. DYOR.
- Pump.fun integration only auto-fills forms. You review and confirm all transactions yourself.
- AI-generated websites should be reviewed before production use.
- Token scanning shows on-chain data — interpretation is up to you.

## License

MIT

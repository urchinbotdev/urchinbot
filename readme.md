# urchinbot

![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)
![Solana](https://img.shields.io/badge/Solana-Mainnet-9945FF?logo=solana&logoColor=white)
![Netlify](https://img.shields.io/badge/Deploy-Netlify-00C7B7?logo=netlify&logoColor=white)
![MIT](https://img.shields.io/badge/License-MIT-green)

**UrchinLoop Crypto Agent** — an AI agent that lives in your browser. It sees your page, thinks step-by-step, searches the web, remembers everything, builds websites, scans Solana tokens, and deploys memecoins.

![urchinbot](urchinbot-extension/urchin.png)

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

A full AI agent overlay on any webpage. It reasons step-by-step, uses tools, and remembers everything across sessions.

- Sees your current page, selected text, tweets, DEX pairs, and wallet addresses
- Auto-detects crypto pages (DexScreener, Birdeye, pump.fun, Jupiter, Solscan, Raydium)
- Searches the web for real-time prices, news, and project info
- Takes screenshots and visually analyzes pages
- Checks live Solana token prices via Jupiter
- Scans any wallet for SOL balance, token holdings, and transaction history
- Compares multiple tokens side-by-side for safety
- Reads any URL you paste and summarizes it
- Remembers your wallets, preferences, and past conversations permanently
- Builds and deploys websites directly from chat
- Plans multi-step tasks with up to 12 chained tool calls

### Site Builder (Build Tab)

Describe a website in plain text and get a full static site (HTML + CSS + JS) with self-critique quality review.

- AI critic scores the design and auto-fixes issues before delivery
- Upload images from your computer or grab them from any page
- Grabbed images are embedded directly into the built site
- Preview inline, download as ZIP, or deploy to Netlify in one click

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

Required for one-click web deploy.

1. Go to https://app.netlify.com/user/applications#personal-access-tokens
2. Create a new token named `urchinbot`
3. Paste it in Settings

## Example Prompts

```
what token is this page about?
search for latest Solana news
what's the price of JUP?
check wallet 7xKX... balance and recent transactions
compare these tokens: MINT1, MINT2, MINT3
take a screenshot and tell me what you see
read this URL: https://example.com/article
build me a crypto dashboard with dark theme
deploy my site to netlify
change the hero section to a gradient background
deploy a token called DogWifHat with ticker WIF
remember my wallet is 7xKX...
what do you remember about me?
```

## Agent Tools

| Tool | What It Does |
|------|-------------|
| Web Search | Real-time search via DuckDuckGo |
| Screenshot | Captures and visually analyzes current page |
| Token Price | Live price via Jupiter aggregator |
| Wallet Balance | SOL + top token holdings via RPC |
| Wallet History | Recent transaction history |
| Multi-Scan | Compare multiple tokens for safety |
| Fetch URL | Read and summarize any webpage |
| Build Site | Generate full static website with AI self-review |
| Edit Site | Modify existing site via chat |
| Deploy Site | Push to Netlify from chat |
| Token Launch | Prepare pump.fun launch packet |
| Memory | Save and recall info across sessions |
| Detect Mints | Extract Solana addresses from text |

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
  background.js       Service worker, agent loop, LLM, tools
  content.js          Overlay UI, Shadow DOM, page context
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
- **Memory is local** — persistent memory is stored in chrome.storage.local, never sent to external servers

## Disclaimers

This is a research and experimentation tool. Not financial advice.

- Memecoins are extremely risky. DYOR.
- Pump.fun integration only auto-fills forms. You review and confirm all transactions yourself.
- AI-generated websites should be reviewed before production use.
- Token scanning shows on-chain data — interpretation is up to you.

## License

MIT

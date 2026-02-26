# urchinbot

![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)
![Solana](https://img.shields.io/badge/Solana-Mainnet-9945FF?logo=solana&logoColor=white)
![Netlify](https://img.shields.io/badge/Deploy-Netlify-00C7B7?logo=netlify&logoColor=white)
![MIT](https://img.shields.io/badge/License-MIT-green)

**UrchinLoop Crypto Agent** — local-first Chrome extension overlay for AI chat, site building, Solana scanning, and Pump.fun launch assist.

![urchinbot](urchinbot-extension/urchin.png)

## What is urchinbot?

A Chrome extension that puts an AI agent overlay on any webpage. It sees your page, answers questions, builds entire websites, scans Solana tokens for rug signals, and helps deploy memecoins on Pump.fun — all from a floating panel in your browser.

## Features

- **Ask** — Chat with an advanced AI agent that sees your page, reasons step-by-step, searches the web, and remembers things across sessions
- **Vision** — Take screenshots and get visual analysis of any webpage
- **Web Search** — Real-time web search for prices, news, project info
- **Token Price** — Live Solana token prices via Jupiter aggregator
- **Wallet Scanner** — Check any wallet's SOL balance and top token holdings
- **Persistent Memory** — Agent remembers important info across sessions and auto-summarizes conversations
- **Self-Critique** — Sites are auto-reviewed by an AI critic and improved before delivery
- **Build** — Generate full static websites from a text prompt with quality self-review, preview, ZIP, or deploy live
- **Deploy** — Prepare Pump.fun launch packets, auto-fill pump.fun/create with token info and image
- **Scan** — Analyze Solana token mints for top holder concentration, fresh wallet flags, rug signals
- **Edit via Chat** — Say "change the background to dark purple" and it edits your built site in place
- **Page Images** — Grab images from any webpage to use in builds or token deploys
- **Right-Click** — Send selected text, links, or images to urchinbot from the context menu
- **Netlify** — One-click deploy any generated site to a live .netlify.app URL
- **Multi-Step Planning** — Agent can chain up to 10 tool calls per request, reasoning between each step

## Installation

Clone the repo:

```
git clone https://github.com/YOUR_USERNAME/urchinbot.git
```

Then load it in Chrome:

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `urchinbot-extension` folder
5. Click the puzzle piece icon in your toolbar and pin urchinbot

## Setup

Click the urchinbot icon in your toolbar, then click **Settings** (or right-click the icon and choose Options).

### LLM Provider (required)

This powers all AI features. Pick one:

**OpenAI**

- Get your key at https://platform.openai.com/api-keys
- Recommended: `gpt-4o-mini` (fast + cheap) or `gpt-4o` (better quality)

**Anthropic**

- Get your key at https://console.anthropic.com/settings/keys
- Recommended: `claude-sonnet-4-20250514`

**OpenAI Compatible (Groq, Together, Ollama, etc.)**

- Set the base URL (example: `http://localhost:11434/v1/chat/completions` for Ollama)
- Pick or type your model name

Steps:

1. Pick your provider from the dropdown
2. Paste your API key
3. Select a model from the dropdown (or choose Custom and type one)
4. Click **Save**

### Solana RPC (optional)

Only needed for the Scan tab (token holder analysis).

- **Helius** (recommended) — https://www.helius.dev/ — 100k requests/day free
- **QuickNode** — https://www.quicknode.com/ — limited free tier

Steps:

1. Sign up and copy your RPC URL
2. Paste it in the Solana RPC URL field
3. Click **Save**

### Netlify Token (optional)

Only needed for one-click web deploy from the Build and Deploy tabs.

Steps:

1. Go to https://app.netlify.com/user/applications#personal-access-tokens
2. Click **New access token** and name it `urchinbot`
3. Copy the token (only shown once)
4. Paste it in the Netlify Personal Access Token field
5. Click **Save**

## Usage

### Ask Tab

Type anything in the chat. The bot sees your page and has tools.

Example prompts:

```
what token is being discussed on this page?
build me a crypto dashboard with dark theme and animated cards
change the header to a purple gradient
scan this token for me
deploy a token called DogWifHat with ticker WIF
```

Other features:

- Upload files/images with the paperclip button
- Grab images from the page with the Page Images button
- Sites built from chat auto-appear in the Build tab

### Build Tab

1. Describe the site you want
2. Click **Build Site** — generates index.html, styles.css, app.js
3. **Preview** the site inline
4. **Download ZIP** to save locally
5. **Deploy to Netlify** to push it live

### Deploy Tab

1. Fill in token name, symbol, description
2. Upload a token image
3. Click **Generate Launch Packet** or **From Chat Context**
4. Click **Open & Autofill Pump.fun** — opens pump.fun/create and fills everything
5. Click **Deploy Token Landing Page** — creates a token site and deploys to Netlify

### Scan Tab

1. Paste a Solana mint address
2. See top 10 holders, concentration %, fresh wallet flags
3. Click links to view on Solscan

### Right-Click Menu

- Highlight text, right-click: **Send selection to urchinbot**
- Right-click a link: **Send link to urchinbot**
- Right-click an image: **Send image to urchinbot**
- Right-click the page: **Capture current page**

### Keyboard Shortcuts

- `Ctrl+Shift+U` — Toggle the overlay panel
- `Escape` — Close the overlay

## Project Structure

```
urchinbot-extension/
  manifest.json          - Chrome MV3 config
  background.js          - Service worker, LLM, tools, agent loop
  content.js             - Overlay UI, Shadow DOM injection
  styles.css             - Host element styles
  popup.html             - Toolbar bubble menu
  popup.js               - Popup logic
  options.html           - Settings page
  options.js             - Settings logic
  urchin.png             - Logo
  icons/                 - 16, 48, 128px icons
  lib/
    jszip.min.js         - ZIP generation (vendored)
```

## Security

- **Local-first** — API keys stay in chrome.storage.local on your machine. Nothing leaves your browser except calls to the LLM provider you choose.
- **No custodial keys** — urchinbot never touches wallet private keys. Pump.fun transactions are confirmed and signed by you.
- **No tracking** — Zero analytics. Zero telemetry. Zero data collection.

## Disclaimers

This is a research and experimentation tool. Not financial advice.

- Memecoins are extremely risky. DYOR.
- Pump.fun integration only auto-fills forms. You review and confirm all transactions.
- AI-generated sites should be reviewed before production use.

## License

MIT

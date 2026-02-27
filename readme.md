# urchinbot

**urchinbot** — a local-first AI agent that lives in your browser (and soon, your Telegram). It thinks step-by-step, searches the web, scans Solana tokens, checks wallets, builds and deploys websites, runs autonomous background tasks, learns new skills over time, and remembers everything across sessions. Powered by UrchinLoop.

> Telegram bot coming soon. Same brain. Same tools. No extension needed.

**Follow:** [x.com/urchinbot](https://x.com/urchinbot)

![urchinbot](https://github.com/urchinbotdev/urchinbot/blob/main/urchinbot.png)

## Install

**Chrome Web Store:**

> Coming soon!

**Manual install:**

1. [Download urchinbot_v.001.zip](https://github.com/urchinbotdev/urchinbot/blob/main/urchinbot_v.001.zip)
2. Unzip it
3. Open Chrome and go to `chrome://extensions`
4. Turn on **Developer mode** (top right)
5. Click **Load unpacked**
6. Select the `urchinbot-extension` folder from the unzipped files
7. Pin urchinbot from the puzzle piece icon in your toolbar

## What It Does

### Agent Chat (Ask Tab)

A full AI agent overlay on any webpage. It reasons step-by-step with mandatory chain-of-thought, uses 27 tools, runs autonomous background tasks, learns new skills, and remembers everything across sessions.

- Sees your current page, selected text, tweets, DEX pairs, and wallet addresses
- Auto-detects crypto pages (DexScreener, Birdeye, pump.fun, Jupiter, Solscan, Raydium)
- Searches the web for real-time prices, news, and project info
- Takes screenshots and visually analyzes pages
- Reverse image search — identifies people, memes, logos on screen via vision + web search
- Checks live Solana token prices via Jupiter with price change tracking
- DexScreener API integration — volume, liquidity, pair age, FDV
- Token risk scoring (1-100) with breakdown on every scan
- On-chain cross-referencing — detects holder overlaps between scanned tokens
- Scans any wallet for SOL balance, token holdings, and transaction history
- Compares multiple tokens side-by-side for safety
- Reads any URL you paste and summarizes it
- Semantic memory search — fuzzy recall across all saved info
- Remembers your wallets, preferences, and past conversations permanently
- Builds, edits, and deploys websites directly from chat
- Lists and deletes your Netlify sites from chat
- Price and wallet alerts with Chrome notifications
- Scheduled reminders with intelligent execution — reminders run through the full agent loop
- Autonomous background tasks — schedule work that runs without you waiting
- Self-scheduling — the agent can queue its own follow-up tasks and monitoring chains
- Self-evolving skills — learns your preferences and useful procedures over time
- Self-extending reasoning — can expand its step budget for complex analysis (up to 24 steps)
- Proactive briefings on open — price updates, wallet balances, active alerts
- Background task results delivered via companion speech bubble + Chrome notifications
- Notification badge on mascot for unread background results
- Markdown-rendered responses with bold, links, lists, code
- Inline clickable address cards — click any Solana address to scan
- Conversation retry — re-run any response with one click
- Export chat history as Markdown
- Streaming responses — see text appear in real-time
- Parallel tool execution — multiple tools fire simultaneously
- Smart self-routing — simple questions answered instantly
- Plans multi-step tasks with up to 24 chained tool calls

### Autonomous Background Tasks

The agent can work while you're not watching. Schedule tasks that run through the full UrchinLoop with all tools available, then deliver results when ready.

- **SET_TIMER** — "check this token in 30 minutes and analyze the change" → fires on schedule → full agent loop → result delivered
- **SCHEDULE_TASK** — queue immediate or delayed background work, non-blocking
- **Self-scheduling** — the agent proactively schedules its own follow-ups (re-checks, monitoring, research)
- **Task chaining** — autonomous tasks can schedule more tasks, creating self-sustaining monitoring chains
- **Persistent queue** — tasks survive browser restarts, tracked as pending → running → done/failed
- **Result delivery** — background results appear in chat with a purple separator, show in the companion speech bubble, trigger Chrome notifications, and display a red badge on the mascot

### Self-Evolving Skills

The agent gets smarter the more you use it. It learns behavioral skills that persist permanently and get applied to every future conversation.

- **Manual learning** — tell it a preference or correct it, and it saves a skill automatically
- **Auto-learning** — every 7th conversation, analyzes recent interactions for learnable patterns
- **Skill injection** — all learned skills are loaded into every conversation context
- **Skill management** — ask "what have you learned?" to see all skills, or tell it to forget one
- **Usage tracking** — each skill tracks how many times it's been applied
- **Examples of learned skills:**
  - "Always build websites with dark mode as default"
  - "When scanning tokens, also fetch DexScreener data and check the deployer wallet"
  - "User prefers concise answers without emojis"
  - "For memecoins, always check Twitter sentiment first"

### Site Builder (Build Tab)

A full website workspace. Describe a site, build it, then keep editing it with follow-up prompts and push updates to your live Netlify URL — all without leaving the extension.

- **Build from a prompt** — describe what you want and get a full static site (HTML + CSS + JS) with AI self-critique
- **Edit with prompts** — after building, type follow-up changes like "make the header purple" or "add a contact form" and the AI rewrites your code
- **Live site tracking** — once deployed, your Netlify URL stays pinned at the top with a green LIVE indicator. Every edit can be pushed to the same URL
- **Edit and Push Live** — one-click to apply changes and immediately update your live site
- **Start fresh anytime** — click "+ New" to wipe the workspace and build something new
- **Edit history** — see all the changes you've made as chips above the edit prompt
- Upload images from your computer or grab them from any page
- Grabbed images are embedded directly into the built site
- Preview inline, download as ZIP, or deploy to Netlify
- Manage all your Netlify sites — view, visit, or bulk-delete old deploys
- Collapsible source file viewer with per-file copy buttons

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
- Risk score (1-100) with breakdown
- Cross-reference with previous scans — flag shared holders
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

**Faster replies?** Use **gpt-4o-mini** (OpenAI) or **Claude Opus 4.6** (Anthropic) in Settings for snappier responses.

For OpenAI Compatible providers (Groq, Together, Ollama, etc.), also set the base URL.

### Solana RPC (optional)

Required for token scanning, wallet checks, and transaction history.

| Provider | Link | Free Tier |
|----------|------|-----------|
| Helius | https://www.helius.dev | 100k requests/day |
| QuickNode | https://www.quicknode.com | Limited |

### Netlify Token (optional)

Required for one-click web deploy, live site updates, and site management.

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
who are these people in this image?
reverse image search this meme
read this URL: https://example.com/article
build me a crypto dashboard with dark theme
make the hero section bigger and add animations
deploy my site to netlify
edit the footer and push it live
show me my netlify sites
delete the old ones
deploy a token called DogWifHat with ticker WIF
remember my wallet is 7xKX...
what do you remember about me?
check this token again in 30 minutes and tell me if the price changed
monitor this wallet for the next hour
what skills have you learned?
forget the dark-mode-preference skill
```

## Agent Tools (27)

| Tool | What It Does |
|------|-------------|
| Web Search | Real-time search via DuckDuckGo |
| Screenshot | Captures and visually analyzes current page |
| Reverse Image Search | Identifies people, memes, logos via vision + web search |
| Fetch URL | Read and summarize any webpage |
| Token Price | Live Solana token price via Jupiter + price change tracking |
| DexScreener Data | Structured market data — volume, liquidity, pair age, FDV |
| Wallet Balance | SOL + top token holdings via RPC |
| Wallet History | Recent transaction history for any wallet |
| Token Scan | Top holders, concentration, risk score, cross-referencing |
| Multi-Scan | Compare up to 5 tokens side-by-side for safety |
| Detect Mints | Extract Solana addresses from any text |
| Build Site | Generate full static website with AI self-critique |
| Edit Site | Modify existing site with follow-up prompts |
| Deploy Site | Push current site to Netlify (new or update existing) |
| List Sites | Show all your Netlify sites |
| Delete Site | Remove a Netlify site by ID |
| Token Launch | Prepare pump.fun launch packet + auto-fill |
| Memory | Save/recall info across sessions (REMEMBER/RECALL) |
| Search Memory | Fuzzy keyword search across all saved memories |
| Set Alert | Price and wallet alerts with Chrome notifications |
| Remind Me | Schedule follow-up tasks with intelligent execution |
| Set Timer | Schedule autonomous background tasks that run through the full agent loop |
| Schedule Task | Queue immediate or delayed background work, non-blocking |
| Continue | Self-extend reasoning budget for complex multi-step analysis |
| Learn Skill | Teach itself new behavioral instructions that persist permanently |
| List Skills | Show all learned skills with usage stats |
| Forget Skill | Remove an outdated or wrong learned skill |

## How UrchinLoop Works

UrchinLoop is the open-source agent runtime that powers urchinbot. It's not a chatbot — it's a reasoning loop that thinks, plans, acts, learns, and evolves.

Full technical documentation: [URCHINLOOP.md](https://github.com/urchinbotdev/urchinbot/blob/main/URCHINLOOP.md)

### The Loop

Every time you send a message, UrchinLoop runs this cycle:

```
You send a message
       |
  [Load Memory] — condensed history, user profile, session summaries,
                   saved memories, learned skills
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
  [ACT] — call a tool (search, scan, screenshot, build, deploy, fetch, remember,
           schedule background task, learn skill...)
       |
  [OBSERVE] — get the tool result back
       |
  [DECIDE] — need more info? loop back to THINK > ACT > OBSERVE (up to 24 steps)
             have enough? write the final answer
       |
  [RESPOND] — send the answer back to you
       |
  [LEARN] — background: save session summary, update user profile,
            compress old history, auto-learn new skills
       |
  [SCHEDULE] — if needed: queue autonomous follow-up tasks,
               set timers for future checks, chain monitoring jobs
```

The agent can chain up to 24 tool calls in a single request. For example, asking "compare these 3 tokens and check the deployer wallets" might trigger: MULTI_SCAN then GET_WALLET_BALANCE then GET_WALLET_HISTORY then WEB_SEARCH then final analysis — and then schedule a re-check in 30 minutes.

### What Makes It Smart

- **Mandatory chain-of-thought** — the agent thinks before every action, planning its approach in hidden reasoning blocks
- **Auto-context** — detects what kind of crypto page you're on and pre-loads relevant data (mints, pairs, prices) without you asking
- **Proactive behavior** — notices patterns, suggests next steps, cross-references data between scans, and learns your preferences
- **Self-evolving skills** — learns behavioral instructions from your interactions that persist permanently and get applied to every future conversation
- **Autonomous execution** — can schedule background tasks that run through the full agent loop without you waiting, then deliver results via notifications and the companion bubble
- **Self-scheduling** — autonomous tasks can chain: a background task can schedule more background tasks, creating persistent monitoring loops
- **Self-extending reasoning** — can expand its own step budget (up to 24 steps) for complex analysis instead of cutting short
- **Self-critique on builds** — AI critic scores the design (1-10) and auto-fixes issues if below 8
- **Live site editing** — edit your deployed site with natural language prompts and push updates to the same Netlify URL
- **Non-blocking memory** — memory updates and skill learning happen in the background after the response, so you never wait

## Agent Memory

The agent has a 6-layer memory system:

1. **Condensed History** — compressed narrative of all past conversations (never expires)
2. **Recent Chat** — last 30 messages at full fidelity
3. **User Profile** — auto-extracted permanent knowledge (wallets, preferences, projects)
4. **Session Summaries** — detailed bullet points from past sessions (last 20 kept)
5. **Manual Memories** — anything you tell it to remember
6. **Learned Skills** — self-evolving behavioral instructions (permanent, injected into every conversation)

Click the **brain icon** in the Ask tab to view or wipe all memory.

## Project Structure

```
urchinbot_v.001.zip
  urchinbot-extension/
    manifest.json       Chrome MV3 config
    background.js       Service worker, agent loop, LLM, 27 tools, autonomous runner
    content.js          Overlay UI, Shadow DOM, smart page context, result delivery
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
- **Memory is local** — persistent memory, skills, and task queue stored in chrome.storage.local, never sent to external servers
- **Autonomous tasks are local** — background tasks run in your browser's service worker, not on any remote server

## Roadmap

### Coming Soon

- Telegram bot — full urchinbot agent in your DMs, same 27 tools and memory
- Skill sharing — export/import learned skills between users
- Custom tool definitions — teach the agent to call new APIs
- One-command site deploys with custom domains
- Token launch automation improvements

### Future

- Updates coming soon!

## Disclaimers

This is a research and experimentation tool. Not financial advice.

- Memecoins are extremely risky. DYOR.
- Pump.fun integration only auto-fills forms. You review and confirm all transactions yourself.
- AI-generated websites should be reviewed before production use.
- Token scanning shows on-chain data — interpretation is up to you.
- Autonomous background tasks consume LLM API credits when they execute.

## License

MIT

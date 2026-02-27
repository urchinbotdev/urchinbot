# urchinbot

**urchinbot** — a local-first AI agent that lives in your browser. It thinks step-by-step, searches the web, scans Solana tokens, checks wallets, builds and deploys websites, runs autonomous background tasks, monitors tokens continuously, learns new skills over time, tracks multi-session project goals, and remembers everything across sessions. Powered by UrchinLoop — a custom multi-step reasoning engine with 33 tools.

> Telegram bot coming soon. Same brain. Same tools. No extension needed.

**Follow:** [x.com/urchinbot](https://x.com/urchinbot)

![urchinbot](https://github.com/urchinbotdev/urchinbot/blob/main/urchinbot.png)

## Install

**Chrome Web Store:**

> Coming soon!

**Manual install:**

1. [Download urchinbot_v0.08.zip](https://github.com/urchinbotdev/urchinbot/blob/main/urchinbot_v0.08.zip)
2. Unzip it
3. Open Chrome and go to `chrome://extensions`
4. Turn on **Developer mode** (top right)
5. Click **Load unpacked**
6. Select the `urchinbot-extension` folder from the unzipped files
7. Pin urchinbot from the puzzle piece icon in your toolbar

## What It Does

### Agent Chat (Ask Tab)

A full AI agent overlay on any webpage. It reasons step-by-step with mandatory chain-of-thought, uses 33 tools, runs autonomous background tasks, monitors tokens continuously, learns new skills, tracks project goals across sessions, and remembers everything.

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
- Semantic memory search — embeddings-based recall with cosine similarity (keyword fallback)
- Relevance-filtered memory — only injects memories relevant to your current message, not everything
- Remembers your wallets, preferences, and past conversations permanently
- Builds, edits, and deploys websites directly from chat
- Lists and deletes your Netlify sites from chat
- Price and wallet alerts with Chrome notifications
- Scheduled reminders with intelligent execution — reminders run through the full agent loop
- Autonomous background tasks — schedule work that runs without you waiting
- Self-scheduling — the agent can queue its own follow-up tasks and monitoring chains
- Self-evolving skills — learns your preferences, scores skill quality, reads satisfaction signals, and auto-prunes bad ones
- Explicit user feedback — thumbs up/down buttons on every response directly adjust skill scores
- Goal decomposition — automatically breaks complex multi-phase requests into ordered subtask chains with dependency tracking
- Long-term project planning — set multi-session goals with milestones, track progress across conversations
- Self-extending reasoning — can expand its step budget for complex analysis (up to 24 steps)
- Proactive briefings on open — price updates, wallet balances, active alerts
- Background task results delivered via companion chat bubble + Chrome notifications
- Notification badge on mascot for unread background results
- Markdown-rendered responses with bold, links, lists, code
- Inline clickable address cards — click any Solana address to scan
- Thumbs up/down feedback — rate responses to improve skill quality over time
- Conversation retry — re-run any response with one click
- Export chat history as Markdown
- Streaming responses — see text appear in real-time
- Parallel tool execution — multiple tools fire simultaneously
- Smart self-routing — simple questions answered instantly
- Plans multi-step tasks with up to 24 chained tool calls

### Companion Mode

A floating urchinbot mascot that follows you across every page. Chat without opening the full panel — your conversation stays synced everywhere.

- **Draggable mascot** — drag the urchin anywhere on screen, position persists across pages
- **Hover chat button** — hover over the mascot to reveal a quick-chat button without opening the full panel
- **Unified chat history** — messages sent in companion mode appear in the Ask tab, and vice versa. One conversation, two views
- **Chat bubble replies** — urchinbot replies in a compact scrollable box next to the mascot with a typewriter effect
- **Dismissable messages** — close the reply bubble and it won't re-show the same message
- **Click to open panel** — click the mascot to open the full urchinbot panel at any time
- **Background result delivery** — autonomous task results appear in the companion bubble + notification badge on the mascot
- **Always-on-top mascot** — the urchin stays visible above all reply bubbles and chat elements

### Continuous Monitoring

Tell the agent to monitor a token or wallet, and it will run recurring full-intelligence checks on a schedule — not just dumb threshold alerts.

- **MONITOR** — "monitor this token every 15 minutes" → recurring alarm → full agent loop with all tools each check → results delivered with change analysis
- **Configurable interval** — minimum 5 minutes, default 15
- **Auto-expiry** — monitors auto-stop after a set time (default 6 hours) to protect your API credits
- **Smart change detection** — each check compares against previous results and highlights what changed
- **Full tool access** — each monitor tick can scan tokens, check prices, query DexScreener, search the web, check wallets — whatever the instructions say
- **LIST_MONITORS** — see all active monitors, checks run, time remaining
- **STOP_MONITOR** — cancel any monitor at any time

### Autonomous Background Tasks

The agent can work while you're not watching — but only when you ask it to. It never schedules background work on its own.

- **SET_TIMER** — "check this token in 30 minutes and analyze the change" → fires on schedule → full agent loop → result delivered
- **SCHEDULE_TASK** — queue immediate or delayed background work, non-blocking
- **Suggest, don't force** — the agent will suggest background work when useful ("want me to keep monitoring this?") but never schedules it without your explicit confirmation
- **Persistent queue** — tasks survive browser restarts, tracked as pending → running → done/failed
- **Result delivery** — background results appear in chat with a purple separator, show in the companion bubble, trigger Chrome notifications, and display a red badge on the mascot

### Self-Evolving Skills

The agent gets smarter the more you use it. It learns behavioral skills, scores their effectiveness using multiple signal sources, and auto-prunes ones that don't help.

- **Manual learning** — tell it a preference or correct it, and it saves a skill automatically
- **Auto-learning** — every 7th conversation, analyzes recent interactions for learnable patterns
- **Skill scoring** — every skill has a quality score (0-100) updated via exponential moving average
- **Self-evaluation** — every 10th conversation, the agent evaluates whether active skills actually helped and adjusts scores
- **Implicit satisfaction signals** — detects corrections ("that's wrong"), frustration ("try again"), praise ("perfect"), and conversation length to nudge skill scores up or down every turn
- **Explicit user feedback** — thumbs up/down on responses directly adjust skill scores (+12 / -18) for skills used in that turn
- **Auto-pruning** — skills scoring below 10 after 2+ evaluations are deleted; unused skills older than 30 days are cleaned up
- **Skill injection** — only skills above the score threshold are loaded into conversation context
- **Skill management** — ask "what have you learned?" to see all skills with scores, or tell it to forget one
- **Usage tracking** — each skill tracks usage count, score, signal count, feedback count, and evaluation history
- **Examples of learned skills:**
  - "Always build websites with dark mode as default"
  - "When scanning tokens, also fetch DexScreener data and check the deployer wallet"
  - "User prefers concise answers without emojis"
  - "For memecoins, always check Twitter sentiment first"

### Goal Decomposition

When you send a complex multi-phase request, the agent automatically detects it, plans subtasks, and executes them in dependency order.

- **Automatic detection** — triggers when your message contains multiple independent phases (e.g. "research X, then build a site about it, then deploy it")
- **Dependency tracking** — subtasks declare which prior steps they need results from; the orchestrator passes outputs forward
- **Recursive execution** — each subtask runs through the full UrchinLoop with its own reasoning steps and tool access
- **Synthesis** — after all subtasks complete, the agent merges results into a single coherent response
- **Graceful fallback** — if decomposition fails or isn't needed, the request runs through the normal reasoning loop

### Long-Term Project Planning

The agent can track multi-session goals, milestones, and progress — so complex projects don't get lost between conversations.

- **SET_GOAL** — define a project with a title, description, and list of milestones
- **UPDATE_GOAL** — mark milestones as done, add notes, update progress mid-project
- **GET_GOALS** — retrieve all active projects with their current status
- **Context injection** — active project plans are automatically loaded into every conversation so the agent always knows what you're working on
- **Auto-cap** — max 10 active projects, oldest evicted when exceeded

### Explicit User Feedback

Rate any bot response with thumbs up or thumbs down. Feedback directly impacts the skills that were active during that response.

- **Thumbs up** — boosts active skill scores by +12
- **Thumbs down** — penalizes active skill scores by -18
- **Available everywhere** — feedback buttons appear on every response in both panel mode and companion mode
- **Tracked per skill** — each skill records total feedback count and last feedback timestamp

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
monitor this token every 15 minutes
keep an eye on this wallet for the next 2 hours
stop monitoring
show active monitors
what skills have you learned?
forget the dark-mode-preference skill
set a goal: launch token landing page by Friday
update goal 1 — milestone 2 done
what are my active projects?
```

## Agent Tools (33)

![urchinbot Toolkit](https://github.com/urchinbotdev/urchinbot/blob/main/diagrams/urchinloop-tools.png)

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
| Search Memory | Semantic search via embeddings + cosine similarity (keyword fallback) |
| Set Alert | Price and wallet alerts with Chrome notifications |
| Remind Me | Schedule follow-up tasks with intelligent execution |
| Set Timer | Schedule autonomous background tasks that run through the full agent loop |
| Schedule Task | Queue immediate or delayed background work, non-blocking |
| Monitor | Continuous recurring monitoring with full agent analysis each tick |
| List Monitors | Show all active monitors with status and time remaining |
| Stop Monitor | Cancel a running monitor |
| Continue | Self-extend reasoning budget for complex multi-step analysis |
| Learn Skill | Teach itself new behavioral instructions that persist permanently |
| List Skills | Show all learned skills with usage stats |
| Forget Skill | Remove an outdated or wrong learned skill |
| Set Goal | Save a project plan with goals and milestones |
| Update Goal | Mark milestones complete, add notes, adjust progress |
| Get Goals | List all active projects and their status |

## How UrchinLoop Works

UrchinLoop is the custom agent runtime that powers urchinbot. It's not a chatbot wrapper — it's a multi-step reasoning engine that thinks, plans, acts, observes, learns, and evolves autonomously.

Every request runs through a structured loop. The agent doesn't just call an LLM and return the response — it enters a cycle where it can chain up to 24 tool calls, reason about intermediate results, extend its own step budget, schedule follow-up work, and learn new skills from the interaction.

### Architecture

![UrchinLoop Architecture](https://github.com/urchinbotdev/urchinbot/blob/main/diagrams/urchinloop-architecture.png)

### The Loop

Every time you send a message, UrchinLoop runs this cycle:

![UrchinLoop Reasoning Pipeline](https://github.com/urchinbotdev/urchinbot/blob/main/diagrams/urchinloop-flow.png)

### Smart Routing

Before entering the reasoning loop, UrchinLoop classifies the request:

- **Quick reply** (1 step) — greetings, simple questions, memory lookups
- **Standard** (3 steps) — single tool tasks like price checks or web searches
- **Deep** (8+ steps) — multi-tool analysis, comparisons, research chains

The agent can also self-extend its step budget mid-loop using the CONTINUE tool, up to a maximum of 24 steps.

### Parallel Tool Execution

When the agent needs multiple independent pieces of data, it fires tools in parallel. A single THINK step can emit multiple tool calls:

```
THINK: "I need the token price, DexScreener data, and deployer wallet info"
  ├── GET_TOKEN_PRICE (fires)
  ├── DEX_DATA (fires)
  └── GET_WALLET_BALANCE (fires)
       all results return → next THINK step
```

### Autonomous Execution

UrchinLoop doesn't just respond — it can schedule future work:

- **Timers** — `SET_TIMER` schedules a full agent loop to run later. When the alarm fires, UrchinLoop spins up, runs the task with all 33 tools, and pushes the result back to you
- **Monitors** — `MONITOR` creates a recurring alarm. Every tick runs a full loop with the monitoring instructions, compares against previous results, and alerts on changes
- **Background tasks** — `SCHEDULE_TASK` queues immediate non-blocking work so the agent can do research while you keep browsing
- **Self-continuation** — the agent can extend its own reasoning with `CONTINUE` when it needs more steps

All autonomous tasks run in the Chrome service worker. Results are delivered via Chrome notifications, the companion chat bubble, and the Ask tab thread.

### What Makes It Smart

- **Mandatory chain-of-thought** — the agent thinks before every action, planning its approach in hidden reasoning blocks
- **Auto-context** — detects what kind of crypto page you're on and pre-loads relevant data (mints, pairs, prices) without you asking
- **Proactive suggestions** — notices patterns, suggests next steps, cross-references data between scans, and learns your preferences
- **Self-evolving skills** — learns behavioral instructions from your interactions, scores their effectiveness via LLM evaluation and implicit satisfaction signals, and auto-prunes low-quality ones
- **Goal decomposition** — detects multi-phase requests, plans subtask chains with dependencies, executes each through the full loop, and synthesizes a unified response
- **Continuous monitoring** — tell it to monitor a token or wallet, and it runs recurring full-intelligence checks with change detection on a configurable schedule
- **Autonomous execution** — can schedule background tasks that run through the full agent loop without you waiting, then deliver results via notifications and the companion bubble
- **Ask first, act second** — the agent suggests background work and monitoring when useful, but never schedules anything without your explicit confirmation
- **Self-extending reasoning** — can expand its own step budget (up to 24 steps) for complex analysis instead of cutting short
- **Self-critique on builds** — AI critic scores the design (1-10) and auto-fixes issues if below 8
- **Live site editing** — edit your deployed site with natural language prompts and push updates to the same Netlify URL
- **Relevance-filtered memory** — only memories and session summaries relevant to your current message are injected, preventing context rot as memory grows
- **Non-blocking memory** — memory updates, skill learning, skill evaluation, satisfaction signals, and user feedback processing happen in the background after the response, so you never wait
- **Unified companion chat** — companion mode and the full panel share the same conversation thread seamlessly

## Agent Memory

![UrchinLoop Memory System](https://github.com/urchinbotdev/urchinbot/blob/main/diagrams/urchinloop-memory.png)

The agent has a 7-layer memory system:

1. **Condensed History** — compressed narrative of all past conversations (never expires)
2. **Recent Chat** — last 30 messages at full fidelity
3. **User Profile** — auto-extracted permanent knowledge (wallets, preferences, projects), capped at 50 keys
4. **Session Summaries** — detailed bullet points from past sessions (last 20 kept)
5. **Manual Memories** — anything you tell it to remember (capped at 100, oldest evicted)
6. **Learned Skills** — self-evolving behavioral instructions, scored 0-100, auto-pruned when ineffective
7. **Project Plans** — multi-session goals, milestones, progress (up to 10 projects)

### Context Rot Prevention

Memory injection is relevance-filtered to prevent context rot — the gradual degradation that happens when too much stale or irrelevant info floods the LLM context:

- **Relevance filtering** — when you have more than a few memories, only the ones semantically relevant to your current message are injected. Uses the same embeddings infrastructure as Search Memory. Falls back to keyword matching for Anthropic users.
- **Profile cap** — user profile auto-prunes to the newest 50 keys
- **Memory cap** — manual memories are capped at 100 entries; oldest by timestamp are evicted when the cap is exceeded
- **Skill scoring + pruning** — skills below score 15 are excluded from context; skills below 10 after 2+ evaluations are deleted
- **Session rotation** — session summaries capped at 20, oldest deleted first
- **Condensation** — old conversations are LLM-compressed into a dense 4000-char narrative
- **Hard context budget** — all injected context is trimmed to 80K chars max to prevent window overflow
- **Tool result summarization** — large tool outputs are capped and truncated per-tool
- **Embedding cache** — memory embeddings cached (max 300) for fast re-use; invalidated when memories are overwritten

The most recent session summary is always included regardless of relevance score to maintain conversational continuity.

Click the **brain icon** in the Ask tab to view or wipe all memory.

## Project Structure

```
urchinbot_v.001.zip
  urchinbot-extension/
    manifest.json       Chrome MV3 config
    background.js       Service worker — UrchinLoop engine, LLM calls, 33 tools,
                        autonomous task runner, monitor scheduler, skill manager
    content.js          Overlay UI — Shadow DOM panel, companion mode, speech bubble,
                        smart page context, chat thread, result delivery
    styles.css          Host element styles
    popup.html          Toolbar bubble menu
    popup.js            Popup logic
    options.html        Settings page (provider, model, RPC, Netlify token)
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

- Telegram bot — full urchinbot agent in your DMs, same 33 tools and memory
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

## Future Updates

- **Multi-agent collaboration** — spawn specialist sub-agents (researcher, coder, analyst) that collaborate on complex tasks, each with their own tool access and expertise, orchestrated by a coordinator agent
- **Structured project memory** — persistent multi-session project plans that track goals, milestones, blockers, and progress across conversations (**implemented** — use SET_GOAL, UPDATE_GOAL, GET_GOALS)
- **Fine-grained skill policies** — replace free-text skill instructions with structured condition/action rules for more precise behavioral control
- **Vision-in-the-loop** — multimodal LLM calls during reasoning steps so the agent can interpret screenshots and images inline, not just as side-tool calls
- **Code execution sandbox** — run and test generated code in an isolated environment before presenting results

## License

MIT

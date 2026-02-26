# UrchinLoop

**UrchinLoop** is an open-source agentic reasoning engine. It powers [urchinbot](https://x.com/urchinbot) but is designed to work anywhere — browser extensions, Telegram bots, CLIs, servers, or any JavaScript runtime.

UrchinLoop is not a chatbot wrapper. It is a deterministic think-act-observe loop with persistent memory, tool execution, chain-of-thought reasoning, and auto-context detection.

## Architecture

```
                    UrchinLoop Engine
  ┌─────────────────────────────────────────────┐
  │                                             │
  │   ┌──────────┐    ┌──────────┐              │
  │   │  Memory   │    │  Context  │              │
  │   │  System   │    │  Builder  │              │
  │   └────┬─────┘    └─────┬────┘              │
  │        │                │                   │
  │        v                v                   │
  │   ┌─────────────────────────┐               │
  │   │      Message Builder    │               │
  │   │  (layers 1-5 injected)  │               │
  │   └────────────┬────────────┘               │
  │                │                            │
  │                v                            │
  │   ┌─────────────────────────┐               │
  │   │     Reasoning Loop      │               │
  │   │                         │               │
  │   │  THINK ─> ACT ─> OBSERVE ─> DECIDE     │
  │   │    ^                          │         │
  │   │    └──────────────────────────┘         │
  │   │       (up to 12 iterations)             │
  │   └────────────┬────────────┘               │
  │                │                            │
  │                v                            │
  │   ┌─────────────────────────┐               │
  │   │    Post-Response Jobs   │               │
  │   │  (memory save, profile  │               │
  │   │   extract, condense)    │               │
  │   └─────────────────────────┘               │
  │                                             │
  └─────────────────────────────────────────────┘
           │              │              │
     ┌─────┘        ┌─────┘        ┌─────┘
     v              v              v
  ┌──────┐    ┌──────────┐    ┌─────────┐
  │ LLM  │    │  Tools   │    │ Storage │
  │ API  │    │ (16+)    │    │ (local) │
  └──────┘    └──────────┘    └─────────┘
```

## The Loop

Every request runs through this cycle:

### 1. Load Memory

Five layers of memory are loaded and injected into the LLM context:

| Layer | Source | Persistence | Size |
|-------|--------|-------------|------|
| Condensed History | Compressed narrative of all past conversations | Permanent, rewritten on overflow | Up to 4000 chars |
| Recent Messages | Last 30 chat messages at full fidelity | Session-persistent, rolls off | 30 messages |
| User Profile | Auto-extracted user knowledge (wallets, preferences, projects) | Permanent, auto-updated | Unlimited keys |
| Session Summaries | Bullet-point summaries of past sessions | Last 20 kept, 1500 chars each | 20 entries |
| Manual Memories | Explicitly saved via REMEMBER tool | Permanent until wiped | Unlimited keys |

### 2. Build Context

The engine constructs a rich context object from the environment:

- Page URL, title, visible text (up to 4000 chars)
- Selected text (up to 1000 chars)
- Platform-specific extraction (Twitter tweets, DexScreener pairs, pump.fun form data, Solscan data)
- Crypto-relevant links on the page
- Currently built project (file list)
- Uploaded files and images

### 3. Auto-Detect

The engine identifies the page type and pre-extracts relevant data:

| Page Type | What Gets Extracted |
|-----------|-------------------|
| DexScreener | Trading pairs, token addresses |
| Birdeye | Token data, analytics |
| pump.fun | Form fields, token info |
| Jupiter | Swap data, token addresses |
| Solscan | Wallet/token/transaction data |
| Raydium | Pool data, token addresses |
| Twitter/X | Tweet text, cashtags, mint addresses |

Extracted mint addresses, cashtags, and prices are injected as hints so the agent can act on them without the user asking.

### 4. Reasoning Loop (THINK > ACT > OBSERVE > DECIDE)

The core loop runs up to 12 iterations:

```
for each step (max 12):
    1. Call LLM with system prompt + messages
    2. Extract <<THINK>> blocks (hidden reasoning, logged but not shown to user)
    3. Check for <<TOOL:NAME:param>> tags
    4. If tool found:
         - Execute the tool
         - Append tool result to message history
         - Continue to next step
    5. If no tool found:
         - Treat response as final answer
         - Break loop
```

#### Chain-of-Thought

The system prompt enforces mandatory `<<THINK>>` blocks:

```
<<THINK>>
The user wants to compare three tokens. I should:
1. Use MULTI_SCAN to scan all three at once
2. Check the deployer wallets for the riskiest one
3. Search for any news about these projects
4. Give a final comparison
<</THINK>>
```

Think blocks are stripped from the user-visible response but logged for debugging.

#### Tool Execution

Tools are invoked via text tags in the LLM response:

```
<<TOOL:SCAN_TOKEN:7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU>>
```

The engine matches the tag, executes the corresponding function, and feeds the result back as a new message. The LLM then decides whether to use another tool or provide a final answer.

### 5. Post-Response Jobs

After the response is sent to the user, background jobs run asynchronously (non-blocking):

- **Session summary** — every 3rd conversation, summarize the last 10 messages into detailed bullet points
- **Profile extraction** — every 5th conversation, extract user info (wallets, preferences, projects) into a permanent profile
- **History condensation** — when chat history exceeds 40 messages, compress old messages into a narrative

These jobs use `setTimeout` so they never delay the user's response.

## Tool Protocol

Tools follow a simple text-tag protocol:

```
<<TOOL:TOOL_NAME:parameter>>       — tool with parameter
<<TOOL:TOOL_NAME>>                 — tool without parameter
```

The regex that matches tools:

```javascript
/<<TOOL:(\w+)(?::([\s\S]+?))?>>/
```

### Registering a Tool

To add a new tool, you need three things:

**1. Add it to the system prompt** so the LLM knows it exists:

```
<<TOOL:MY_TOOL:param>> — Description of what it does.
```

**2. Add a case to the tool switch** in the reasoning loop:

```javascript
case 'MY_TOOL': {
  try {
    const result = await myToolFunction(toolParam.trim());
    toolResult = { success: true, ...result };
  } catch (e) {
    toolResult = { error: e.message };
  }
  break;
}
```

**3. Implement the tool function:**

```javascript
async function myToolFunction(param) {
  // Do something
  return { data: 'result' };
}
```

Tool results are serialized to JSON and fed back to the LLM as:

```
[Tool result for MY_TOOL]: {"success":true,"data":"result"}
```

## Current Tools (16)

| Tool | Parameters | Description |
|------|-----------|-------------|
| `SCAN_TOKEN` | mint address | Solana token holder analysis |
| `MULTI_SCAN` | comma-separated mints | Compare multiple tokens |
| `DETECT_MINTS` | text | Extract Solana addresses from text |
| `PREPARE_LAUNCH` | JSON (name, symbol, description) | Create pump.fun launch packet |
| `BUILD_SITE` | JSON (description) | Generate static website with self-critique |
| `EDIT_SITE` | JSON (changes) | Modify existing site |
| `DEPLOY_SITE` | none | Deploy to Netlify |
| `LIST_SITES` | none | List all Netlify sites |
| `DELETE_SITE` | site ID | Delete a Netlify site |
| `SCREENSHOT` | none | Capture and analyze page visually |
| `WEB_SEARCH` | query string | DuckDuckGo instant answers |
| `FETCH_URL` | URL | Fetch and parse webpage content |
| `GET_TOKEN_PRICE` | mint or symbol | Jupiter aggregator price |
| `GET_WALLET_BALANCE` | wallet address | SOL + token holdings |
| `GET_WALLET_HISTORY` | wallet address | Recent transactions |
| `REMEMBER` | JSON (key, value) | Save to persistent memory |
| `RECALL` | key or "all" | Read from persistent memory |

## Memory System

### Storage Keys

| Key | Type | Description |
|-----|------|-------------|
| `urchinCondensed` | string | Compressed narrative of old conversations |
| `urchinMemory` | object | Session summaries + manual memories + metadata |
| `urchinProfile` | object | Auto-extracted user profile (key-value pairs) |
| `urchinChatHistory` | array | Raw chat messages (max 200) |
| `urchinCurrentProject` | object | Currently built website project |
| `urchinLaunchData` | object | Current token launch packet |
| `urchinLogs` | array | Request logs with step-by-step traces |

### Memory Flow

```
User sends message
       │
       ├── Load urchinCondensed (layer 1)
       ├── Load urchinChatHistory, take last 30 (layer 2)
       ├── Load urchinProfile (layer 4)
       ├── Load urchinMemory sessions + manual (layer 5)
       │
       v
  [Agent processes and responds]
       │
       └── Background (non-blocking):
           ├── Every 3rd message: save session summary to urchinMemory
           ├── Every 5th message: extract profile to urchinProfile
           └── If history > 40: condense old messages to urchinCondensed
```

## LLM Provider Interface

UrchinLoop supports any LLM that speaks OpenAI-compatible or Anthropic API:

```javascript
async function callLLMChat(systemPrompt, messages, settings)
```

- `messages` is an array of `{ role: 'user'|'assistant', content: string }`
- For Anthropic: uses `x-api-key` header, `anthropic-version: 2023-06-01`, and the `system` field
- For OpenAI/compatible: uses `Authorization: Bearer` header, system message prepended to messages array
- 120-second timeout via `AbortController`
- Vision support via `callLLMVision()` for image analysis (Anthropic base64 format, OpenAI image_url format)

## Self-Critique (Site Builder)

When building websites, UrchinLoop runs a quality loop:

```
1. Generate site from description (SITE_BUILDER_PROMPT)
2. Validate project structure (must have index.html, styles.css, app.js)
3. Send to AI critic (SELF_REFLECT_PROMPT) — scores 1-10
4. If score < 8: send critique + site back to builder for fixes
5. If uploaded images exist: inject data URLs into HTML
6. Return final project
```

## Extending UrchinLoop

UrchinLoop is designed to be portable. The core loop logic is in `urchinLoop()` and depends on:

- An LLM caller (`callLLMChat`)
- A storage interface (`chrome.storage.local` — swap for any key-value store)
- Tool functions (plain async functions)

To port UrchinLoop to another platform (Telegram, CLI, server):

1. Replace `chrome.storage.local` with your storage (Redis, SQLite, filesystem)
2. Replace `chrome.tabs.captureVisibleTab` with your screenshot method (or remove SCREENSHOT tool)
3. Keep the LLM caller, tool protocol, and reasoning loop as-is
4. Wire up your input/output (Telegram messages, CLI stdin/stdout, HTTP endpoints)

## License

MIT

## Links

- [urchinbot on X](https://x.com/urchinbot)
- [GitHub](https://github.com/YOUR_USERNAME/urchinbot)

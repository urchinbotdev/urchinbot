# Run urchinbot for Free with Ollama (Local AI)

[Back to main README](../readme.md) | [urchinbot Website](https://urchinbot.fun) | [Twitter/X](https://x.com/urchinbot) | [GitHub](https://github.com/urchinbotdev/urchinbot)

Run urchinbot entirely on your own computer with no API key and zero cost using [Ollama](https://ollama.com).

---

## Quick Start

### 1. Install Ollama

Download and install from [ollama.com](https://ollama.com). Available for Windows, macOS, and Linux.

Ollama runs as a local server on `localhost:11434`.

### 2. Pull a Model

Open a terminal and run:

```bash
ollama pull llama3.1
```

This downloads the Llama 3.1 8B model (~4.7 GB). See [Recommended Models](#recommended-models) for other options.

### 3. Configure urchinbot

1. Click the urchinbot icon > **Settings**
2. **Provider:** select `Ollama (Local — Free)`
3. **Model:** select `Llama 3.1 8B` from the dropdown (or type a custom model name)
4. Click **Save Settings**

No API key needed. The settings page auto-detects if Ollama is running and shows available models.

### 4. Start chatting

That's it. All AI processing happens on your machine. Nothing is sent to OpenAI, Anthropic, or any external service.

---

## Recommended Models

| Model | Pull Command | Size | RAM Needed | Quality | Best For |
|-------|-------------|------|-----------|---------|----------|
| **Llama 3.1 8B** | `ollama pull llama3.1` | 4.7 GB | 8 GB | Good | General use, recommended starting point |
| **Qwen 2.5 14B** | `ollama pull qwen2.5:14b` | 9 GB | 16 GB | Very good | Better reasoning, stronger tool use |
| **Qwen 2.5 7B** | `ollama pull qwen2.5:7b` | 4.7 GB | 8 GB | Good | Fast, good tool following |
| **Mistral 7B** | `ollama pull mistral` | 4.1 GB | 8 GB | Good | Fast responses |
| **Gemma 2 9B** | `ollama pull gemma2:9b` | 5.4 GB | 8 GB | Good | Google's model, solid general use |
| **DeepSeek R1 8B** | `ollama pull deepseek-r1:8b` | 4.9 GB | 8 GB | Good | Chain-of-thought reasoning |
| **Llama 3.1 70B** | `ollama pull llama3.1:70b` | 40 GB | 48 GB+ | Excellent | Near GPT-4 quality, needs beefy hardware |
| **LLaVA 7B** | `ollama pull llava` | 4.5 GB | 8 GB | Good | **Only local model with vision support** |

### Minimum: 8 GB RAM with any 7-8B model
### Recommended: 16 GB RAM with a 14B model
### Best: 32+ GB RAM or GPU with VRAM for 70B models

---

## Optional: Semantic Memory Search

urchinbot uses embeddings for semantic memory search (finding relevant memories by meaning, not just keywords). To enable this with Ollama:

```bash
ollama pull nomic-embed-text
```

This is a small embedding model (~274 MB). Without it, memory search falls back to keyword matching — still functional but less accurate.

---

## What Works

Everything that doesn't require vision or external API access works fully with Ollama:

| Feature | Works? | Notes |
|---------|--------|-------|
| Chat / Q&A | ✅ Yes | |
| Web search | ✅ Yes | Uses DuckDuckGo, no LLM dependency |
| Fetch / summarize URLs | ✅ Yes | |
| Token scanning | ✅ Yes | Uses Solana RPC directly |
| Wallet balance / history | ✅ Yes | Uses Solana RPC directly |
| DexScreener data | ✅ Yes | API call, no LLM dependency |
| Token price (Jupiter) | ✅ Yes | API call, no LLM dependency |
| PnL tracking / cards | ✅ Yes | |
| Wallet watchlist / activity | ✅ Yes | Zero-LLM-cost polling |
| Pump.fun token info | ✅ Yes | Uses Solana RPC |
| Pump.fun buy / sell | ✅ Yes | On-chain, no LLM dependency |
| Pump.fun deploy | ✅ Yes | On-chain, no LLM dependency |
| Site builder | ✅ Yes | Quality depends on model size |
| Site deploy (Netlify) | ✅ Yes | |
| Memory (remember / recall) | ✅ Yes | |
| Semantic memory search | ✅ Yes* | *Requires `nomic-embed-text` model |
| Skills (learn / forget) | ✅ Yes | |
| Goals / project tracking | ✅ Yes | |
| Monitors / timers / tasks | ✅ Yes | |
| Twitter/X research | ✅ Yes | Uses guest token, no LLM dependency |
| Right-click context menu | ✅ Yes | |
| Companion mode | ✅ Yes | |
| Multi-token comparison | ✅ Yes | |
| Alerts / notifications | ✅ Yes | |
| Daily digest | ✅ Yes | |

---

## What Doesn't Work (or Works Poorly)

| Feature | Status | Why |
|---------|--------|-----|
| **Screenshot analysis** | ❌ Won't work | Requires vision model. Most local models can't process images. Use LLaVA if you need this. |
| **Reverse image search** | ❌ Won't work | Requires vision to analyze the image before searching. Use LLaVA if you need this. |
| **Complex multi-step reasoning** | ⚠️ Degraded | Smaller models (7-8B) sometimes miss `<<TOOL:...>>` tags or chain fewer steps. 14B+ models handle this much better. |
| **Goal decomposition** | ⚠️ Degraded | Subtask planning works best with larger models. 8B models may produce simpler plans. |
| **Site builder quality** | ⚠️ Degraded | Generated websites are simpler. Larger models produce better HTML/CSS/JS. |
| **Self-critique (site builder)** | ⚠️ Degraded | The AI self-review loop works but smaller models are less critical. |
| **Semantic memory search** | ⚠️ Requires setup | Need to run `ollama pull nomic-embed-text` separately. Without it, falls back to keyword matching. |
| **Embeddings (batch)** | ⚠️ Slower | Ollama processes embeddings sequentially, slower than cloud APIs. |

### Vision Workaround

If you need screenshot/vision capabilities with Ollama, pull a vision-capable model:

```bash
ollama pull llava
```

Then select `LLaVA 7B (vision capable)` in urchinbot settings. LLaVA can process images but is slower and less accurate than GPT-4o or Claude for visual analysis.

---

## Troubleshooting

### "Cannot connect to Ollama at localhost:11434"

- Make sure Ollama is running. On Windows, check the system tray. On macOS/Linux, run `ollama serve` in a terminal.
- Check if another app is using port 11434.
- Try opening `http://localhost:11434` in your browser — you should see "Ollama is running".

### Responses are very slow

- Check which model is loaded: `ollama ps`
- Try a smaller model (`mistral` or `qwen2.5:7b`)
- If you have an NVIDIA GPU, make sure CUDA is being used (check `ollama ps` for GPU usage)
- Close other heavy applications to free RAM

### Agent misses tool calls or gives plain text

- This happens more with smaller models. Try `qwen2.5:14b` or `llama3.1:70b` for better tool-call accuracy.
- The `<<TOOL:...>>` tag format requires models with good instruction following. Llama 3.1 8B+ handles it well.

### Semantic memory search not working

- Run `ollama pull nomic-embed-text` to download the embedding model.
- Memory search falls back to keyword matching without it — still works, just less smart.

### Model not showing up in settings

- Make sure you've pulled it: `ollama list` shows all downloaded models.
- The dropdown shows common models. For other models, select "Custom..." and type the exact model name.

---

## Performance Tips

1. **Use a GPU** — Ollama automatically uses your GPU if available (NVIDIA CUDA, Apple Metal, AMD ROCm). This makes responses 5-10x faster.

2. **Keep the model loaded** — Ollama keeps the last-used model in memory. Don't close and reopen Ollama between uses.

3. **Match model to RAM** — If a model needs more RAM than you have, it swaps to disk and becomes extremely slow. Stick to models that fit in your available memory.

4. **Close unnecessary browser tabs** — Large numbers of tabs compete for RAM with the model.

5. **Set `keep_alive`** — By default Ollama unloads models after 5 minutes of inactivity. To keep it loaded longer:
   ```bash
   OLLAMA_KEEP_ALIVE=30m ollama serve
   ```

---

## Comparison: Local vs Cloud

| | Ollama (Local) | OpenAI | Anthropic |
|---|---|---|---|
| **Cost** | Free | $2-60/M tokens | $3-75/M tokens |
| **Speed** | Depends on hardware | Fast | Fast |
| **Privacy** | 100% local | Data sent to OpenAI | Data sent to Anthropic |
| **Quality (8B)** | Good | — | — |
| **Quality (14B+)** | Very good | — | — |
| **Quality (70B)** | Excellent | — | — |
| **Quality** | — | Excellent (GPT-4.1) | Excellent (Claude Sonnet 4) |
| **Vision** | LLaVA only | Full support | Full support |
| **Embeddings** | nomic-embed-text | text-embedding-3-small | Not supported |
| **Internet required** | No (for AI) | Yes | Yes |
| **Setup** | Install Ollama + pull model | Get API key | Get API key |

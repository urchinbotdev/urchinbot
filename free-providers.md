# Free Cloud LLM Providers for urchinbot

[Back to main README](../readme.md) | [Ollama (Local) Guide](ollama-guide.md) | [urchinbot Website](https://urchinbot.fun) | [GitHub](https://github.com/urchinbotdev/urchinbot)

Don't want to run models locally? These cloud providers offer **free tiers** with strong models — no credit card required.

All of them work through urchinbot's **OpenAI Compatible** provider option.

---

## Quick Comparison

| Provider | Best Free Model | Speed | Rate Limit (free) | Vision | Sign Up |
|----------|----------------|-------|-------------------|--------|---------|
| **Groq** | Llama 3.3 70B | Extremely fast | 30 req/min, 14.4K req/day | No | [console.groq.com](https://console.groq.com) |
| **Cerebras** | Llama 3.3 70B | Extremely fast | 30 req/min, 1K req/day | No | [cloud.cerebras.ai](https://cloud.cerebras.ai) |
| **Google AI Studio** | Gemini 2.0 Flash | Fast | 15 req/min, 1.5K req/day | Yes | [aistudio.google.com](https://aistudio.google.com) |
| **OpenRouter** | Many free models | Varies | Varies by model | Some | [openrouter.ai](https://openrouter.ai) |
| **Together AI** | Llama 3.1 8B | Fast | $1 free credit on sign-up | No | [api.together.xyz](https://api.together.xyz) |

---

## Setup (All Providers)

The setup is the same for every provider:

1. Click the urchinbot icon > **Settings**
2. **Provider:** select `OpenAI Compatible`
3. **API Key:** paste your key from the provider
4. **Base URL:** paste the provider's API endpoint (see below)
5. **Model:** type the exact model name
6. Click **Save Settings**

---

## Groq — Recommended Free Option

Groq runs models on custom LPU hardware. Llama 3.3 70B responses come back in under a second.

### Get Started

1. Go to [console.groq.com](https://console.groq.com) and sign up (Google/GitHub SSO)
2. Create an API key at [console.groq.com/keys](https://console.groq.com/keys)
3. In urchinbot settings:
   - **Provider:** `OpenAI Compatible`
   - **API Key:** your Groq key (`gsk_...`)
   - **Base URL:** `https://api.groq.com/openai/v1/chat/completions`
   - **Model:** `llama-3.3-70b-versatile`

### Available Free Models

| Model | ID | Context | Notes |
|-------|----|---------|-------|
| **Llama 3.3 70B** | `llama-3.3-70b-versatile` | 128K | Best quality, recommended |
| Llama 3.1 8B | `llama-3.1-8b-instant` | 128K | Fastest, lighter tasks |
| Gemma 2 9B | `gemma2-9b-it` | 8K | Good general use |
| Mixtral 8x7B | `mixtral-8x7b-32768` | 32K | Strong reasoning |

### Limits

- 30 requests/minute, 14,400 requests/day
- 6,000 tokens/minute on 70B models
- More than enough for normal urchinbot use

---

## Cerebras — Fastest Inference

Cerebras uses wafer-scale chips for inference. Similar speed to Groq with good free limits.

### Get Started

1. Go to [cloud.cerebras.ai](https://cloud.cerebras.ai) and sign up
2. Create an API key from the dashboard
3. In urchinbot settings:
   - **Provider:** `OpenAI Compatible`
   - **API Key:** your Cerebras key
   - **Base URL:** `https://api.cerebras.ai/v1/chat/completions`
   - **Model:** `llama-3.3-70b`

### Available Free Models

| Model | ID | Context | Notes |
|-------|----|---------|-------|
| **Llama 3.3 70B** | `llama-3.3-70b` | 8K | Best quality |
| Llama 3.1 8B | `llama-3.1-8b` | 8K | Fastest |

### Limits

- 30 requests/minute, 1,000 requests/day
- 60,000 tokens/minute
- Rate limits may change — check their dashboard

---

## Google AI Studio — Best Free Vision Support

Gemini models support vision natively, which means urchinbot's screenshot and reverse image search tools work — something that local Ollama and other free providers can't do (without LLaVA).

### Get Started

1. Go to [aistudio.google.com](https://aistudio.google.com) and sign in with Google
2. Click **Get API Key** > create a key
3. In urchinbot settings:
   - **Provider:** `OpenAI Compatible`
   - **API Key:** your Gemini key (`AIza...`)
   - **Base URL:** `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
   - **Model:** `gemini-2.0-flash`

### Available Free Models

| Model | ID | Context | Notes |
|-------|----|---------|-------|
| **Gemini 2.0 Flash** | `gemini-2.0-flash` | 1M | Fast, vision support, recommended |
| Gemini 2.0 Flash Lite | `gemini-2.0-flash-lite` | 1M | Faster, less capable |
| Gemini 1.5 Flash | `gemini-1.5-flash` | 1M | Stable, good quality |
| Gemini 1.5 Pro | `gemini-1.5-pro` | 2M | Best quality, lower rate limits |

### Limits

- 15 requests/minute, 1,500 requests/day (Flash)
- 2 requests/minute, 50 requests/day (Pro)
- Vision is included — no extra cost

---

## OpenRouter — Model Marketplace

OpenRouter aggregates many providers. Some models are marked as free (with rate limits).

### Get Started

1. Go to [openrouter.ai](https://openrouter.ai) and sign up
2. Go to [openrouter.ai/keys](https://openrouter.ai/keys) > create a key
3. In urchinbot settings:
   - **Provider:** `OpenAI Compatible`
   - **API Key:** your OpenRouter key (`sk-or-...`)
   - **Base URL:** `https://openrouter.ai/api/v1/chat/completions`
   - **Model:** see free models below

### Free Models (look for `:free` suffix)

| Model | ID |
|-------|----|
| Llama 3.1 8B | `meta-llama/llama-3.1-8b-instruct:free` |
| Gemma 2 9B | `google/gemma-2-9b-it:free` |
| Qwen 2.5 7B | `qwen/qwen-2.5-7b-instruct:free` |
| Mistral 7B | `mistralai/mistral-7b-instruct:free` |

Free models on OpenRouter have strict rate limits and may be slow. Groq or Cerebras are faster for free use.

---

## Feature Compatibility

| Feature | Groq | Cerebras | Google AI Studio | OpenRouter |
|---------|------|----------|-----------------|------------|
| Chat / Q&A | ✅ | ✅ | ✅ | ✅ |
| Tool use / agent loop | ✅ | ✅ | ✅ | ✅ |
| Screenshot analysis | ❌ | ❌ | ✅ | Depends on model |
| Reverse image search | ❌ | ❌ | ✅ | Depends on model |
| Semantic memory (embeddings) | ❌ | ❌ | ❌ | ❌ |
| Site builder | ✅ | ✅ | ✅ | ✅ |
| Pump.fun trading/deploy | ✅ | ✅ | ✅ | ✅ |
| Wallet/token scanning | ✅ | ✅ | ✅ | ✅ |

Embeddings (semantic memory search) require either OpenAI, or Ollama with `nomic-embed-text`. Free cloud providers don't offer embedding APIs on their free tiers — memory search falls back to keyword matching.

---

## Recommendation

| Use Case | Best Free Option |
|----------|-----------------|
| **Best overall free experience** | Groq with `llama-3.3-70b-versatile` |
| **Need vision (screenshots)** | Google AI Studio with `gemini-2.0-flash` |
| **Completely offline / private** | [Ollama (local)](ollama-guide.md) |
| **Maximum quality (paid)** | OpenAI `gpt-4.1` or Anthropic `claude-sonnet-4` |

---

## Tips

1. **Groq + Ollama combo** — Use Groq as your primary provider (fast, free) and keep Ollama running locally for embeddings (`nomic-embed-text`). This gives you the best of both worlds: fast cloud inference + local semantic memory.

2. **Stay under rate limits** — urchinbot's background monitors and timers consume API calls. Set monitor intervals to 15+ minutes on free tiers.

3. **Switch providers easily** — All settings are in urchinbot's Settings page. Switch between providers any time without losing memory or skills.

4. **API key safety** — Free tier keys are still API keys. Don't share them publicly.

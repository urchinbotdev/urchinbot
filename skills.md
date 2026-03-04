# Self-Evolving Skills

urchinbot learns from how you use it. Skills are behavioral instructions that the agent saves permanently and applies to every future conversation — so it gets smarter over time without you repeating yourself.

This guide covers how skills work, how to manage them, and how the scoring system decides which skills stay and which get pruned.

---

## Quick Start

You don't need to do anything special. Just use urchinbot normally and it will learn from:

- **Corrections** — "no, always use dark mode" → learns a dark-mode preference skill
- **Preferences** — "I like concise answers" → learns a brevity skill
- **Patterns** — after several conversations, auto-detects recurring behaviors

You can also teach it directly:

```
"learn that when scanning tokens, always check the deployer wallet too"
"remember to always build sites with a dark theme"
```

Check what it knows:

```
"what have you learned?"
"show your skills"
```

Remove a bad skill:

```
"forget the dark-mode-preference skill"
"unlearn that"
```

---

## How Skills Are Stored

Each skill is a JSON object stored in `chrome.storage.local`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique ID (`skill-{timestamp}-{random}`) |
| `name` | string | Kebab-case name (e.g. `dark-mode-preference`) |
| `instruction` | string | The actual behavioral rule the agent follows |
| `score` | number | Quality score from 0-100 (starts at 60 for manual, 50 for auto) |
| `learnedAt` | number | Timestamp when the skill was created |
| `updatedAt` | number | Timestamp of last update |
| `usageCount` | number | How many conversations this skill has been active in |
| `evalCount` | number | How many times the skill has been evaluated |
| `signalCount` | number | How many implicit satisfaction signals detected |
| `feedbackCount` | number | How many explicit thumbs up/down received |
| `source` | string | `"manual"` (you taught it) or `"auto"` (agent learned it) |

**Limits:** Maximum 50 skills. When exceeded, the oldest is removed.

---

## Three Ways Skills Are Created

### 1. You Teach It (Manual)

Tell the agent a preference, correction, or procedure. It calls the `LEARN_SKILL` tool internally.

```
You: "when scanning tokens, always fetch DexScreener data too"
Agent: ✅ Skill "dexscreener-on-scan" learned. I'll apply it in all future conversations.
```

Manual skills start with a score of **60**.

Good skills are **specific and actionable**:

| Good | Bad |
|------|-----|
| "Always build websites with dark mode as default" | "User likes dark things" |
| "When scanning tokens, also check the deployer wallet" | "Be thorough with tokens" |
| "User prefers concise answers without emojis" | "User has preferences" |
| "For memecoins, always check Twitter sentiment first" | "Memecoins are risky" |

### 2. Agent Learns Automatically

Every **7th conversation**, the agent analyzes recent interactions and extracts up to 2 new skills. These are patterns it noticed — procedures that worked, preferences you expressed, or strategies worth repeating.

Auto-learned skills start with a score of **50** (lower than manual, since they're unconfirmed).

### 3. Agent Updates Existing Skills

If you correct a skill or refine a preference, the agent will `FORGET_SKILL` the old one and `LEARN_SKILL` with the updated instruction. The score resets to at least 50.

---

## How Skills Are Scored

Every skill has a quality score from 0-100. The score determines whether the skill stays active, gets excluded, or gets deleted.

### Score Sources

| Source | When | Effect |
|--------|------|--------|
| **Thumbs up** | You click 👍 on a response | Active skills get **+12** |
| **Thumbs down** | You click 👎 on a response | Active skills get **-18** |
| **Positive signals** | You say "perfect", "thanks", "great", "nailed it" | Active skills get up to **+10** |
| **Negative signals** | You say "wrong", "try again", "not helpful", "stop doing that" | Active skills get up to **-15** |
| **Long conversations** | 8+ messages in a session | Active skills get **+5** |
| **Short + no praise** | 2 or fewer messages, no positive signal | Active skills get **-3** |
| **LLM evaluation** | Every 10th conversation | Score blended via EMA (60% old + 40% new) |

### Score Thresholds

| Score Range | What Happens |
|-------------|-------------|
| **60-100** | Fully active — injected into every conversation |
| **16-59** | Active but lower priority |
| **11-15** | Excluded from context — not injected into conversations |
| **0-10** | Marked for deletion if 2+ evaluations have occurred |

### Implicit Satisfaction Signals

After every conversation, the agent scans your last few messages for patterns:

**Negative patterns** (skill score goes down):
- "that's wrong", "try again", "not helpful", "useless"
- "no, that's not what I...", "stop doing that"
- "incorrect", "I didn't ask for that"

**Positive patterns** (skill score goes up):
- "thanks", "perfect", "great", "awesome"
- "exactly", "good job", "love it", "nailed it"

### LLM Self-Evaluation

Every **10th conversation**, the agent runs a self-evaluation:

1. Takes the recent conversation and all active skills
2. Asks the LLM to score each skill 0-100 based on whether it actually helped
3. Blends the new score with the old using exponential moving average: `new = old × 0.6 + eval × 0.4`
4. Updates eval count and timestamp

This catches skills that seem fine on paper but aren't actually useful in practice.

---

## Auto-Pruning

Skills don't last forever if they're not pulling their weight.

| Condition | Action |
|-----------|--------|
| Score drops below **10** after **2+ evaluations** | Skill is deleted |
| Skill unused for **30+ days** | Skill is deleted |
| More than **50 skills** total | Oldest skill is removed |

Pruning happens automatically after evaluations. You'll never notice it unless you check `LIST_SKILLS`.

---

## How Skills Are Injected

When you send a message, the agent loads all skills with a score above **15** and appends them to your context:

```
[Learned skills (apply these):
  • dark-mode-preference [score:78]: Always build websites with dark mode as default
  • dexscreener-on-scan [score:65]: When scanning tokens, also fetch DexScreener data
  • concise-answers [score:82]: User prefers concise answers without emojis]
```

Each time a skill is injected, its `usageCount` increments and `lastUsedAt` updates.

---

## Managing Skills

### View All Skills

```
"what have you learned?"
"show your skills"
"list skills"
```

Returns every skill with its name, instruction, score, usage count, eval count, and when it was learned.

### Remove a Skill

```
"forget the dark-mode-preference skill"
"unlearn the concise-answers skill"
"forget that"
```

The agent will call `FORGET_SKILL` and confirm it's been removed.

### Update a Skill

There's no direct update — the agent forgets the old one and learns a new version:

```
"update the dark-mode skill — actually, default to light mode with a dark mode toggle"
```

Updated skills reset to a score of at least 50.

### Rate Responses

Use the 👍 / 👎 buttons on any response. This directly adjusts scores for all skills that were active during that response.

- **👍** → +12 to active skill scores
- **👎** → -18 to active skill scores

The asymmetry is intentional — bad skills should die faster than good ones grow.

---

## Examples

### Scenario 1: Learning a Scan Preference

```
You: "scan this token: 7xKX..."
Agent: [scans token, shows holders]

You: "next time also check the deployer wallet when you scan"
Agent: ✅ Skill "check-deployer-on-scan" learned.

[Next time you scan a token]
Agent: [scans token AND checks deployer wallet automatically]
```

### Scenario 2: Auto-Learning

After 7 conversations where you consistently ask for DexScreener data after every scan, the agent auto-learns:

```
Skill: "auto-dexscreener-after-scan"
Instruction: "After scanning a token, automatically fetch DexScreener data for volume and liquidity context"
Score: 50 (auto-learned, needs validation)
```

Over time, if you keep finding it useful (positive signals, thumbs up), the score climbs. If you find it annoying, it drops and eventually gets pruned.

### Scenario 3: Skill Gets Pruned

```
Auto-learned skill: "always-mention-rug-risk"
Instruction: "Always warn about rug pull risk when discussing any token"
Score starts at: 50

You: "what's the price of SOL?" → Agent warns about rug risk → You: "I just asked for the price"
Score: 50 → 35 (negative signal)

Next eval: LLM scores it 20 (irrelevant to most conversations)
Score: 35 × 0.6 + 20 × 0.4 = 29

Another bad interaction...
Score: 29 → 12

After 2nd evaluation with score < 10:
Skill deleted ✂️
```

---

## Technical Reference

### Storage Key

All skills are stored in `chrome.storage.local` under the key `urchinSkills` as a JSON array.

### Tool Protocol

Skills use the same text-tag protocol as all UrchinLoop tools:

```
<<TOOL:LEARN_SKILL:{"name":"skill-name","instruction":"what to do"}>>
<<TOOL:LIST_SKILLS>>
<<TOOL:FORGET_SKILL:skill-name>>
```

### Background Processing

All skill operations happen in the Chrome service worker (`background.js`). Scoring, evaluation, and pruning run asynchronously after each response — they never block or slow down your conversation.

---

## FAQ

**Can skills conflict with each other?**
Yes. If two skills give contradictory instructions, the agent uses its judgment. If one consistently causes problems, its score will drop and it'll get pruned.

**Do skills transfer between devices?**
No. Skills are stored locally in `chrome.storage.local`. If you want to back them up, ask the agent to list all skills and save the output.

**Can I import skills from someone else?**
Not yet — skill sharing is on the roadmap.

**How many skills can I have?**
Maximum 50. If you go over, the oldest skill is removed.

**Do auto-learned skills use LLM credits?**
Yes — the auto-learning analysis (every 7th conversation) and self-evaluation (every 10th) each make one LLM call. These are short calls and cost very little.

---

[Back to main README](../readme.md) | [urchinbot Website](https://urchinbot.fun) | [urchinbot on X](https://x.com/urchinbot) | [GitHub](https://github.com/urchinbotdev/urchinbot)

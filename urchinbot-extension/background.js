/* background.js — UrchinLoop service worker */
importScripts('lib/jszip.min.js');

/* ── Side Panel setup ── */
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel) {
    chrome.storage.local.get('sidePanelOnClick', (data) => {
      const enabled = !!data.sidePanelOnClick;
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: enabled }).catch(() => {});
      if (enabled) chrome.action.setPopup({ popup: '' });
    });
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.sidePanelOnClick && chrome.sidePanel) {
    const enabled = !!changes.sidePanelOnClick.newValue;
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: enabled }).catch(() => {});
    chrome.action.setPopup({ popup: enabled ? '' : 'popup.html' });
  }
});

/* ── Side Panel open/close tracking via port ── */
function broadcastSidePanelState(open) {
  chrome.tabs.query({}, tabs => {
    for (const tab of tabs) {
      try { chrome.tabs.sendMessage(tab.id, { action: 'SIDE_PANEL_STATE', open }); } catch {}
    }
  });
}

chrome.runtime.onConnect.addListener(port => {
  if (port.name === 'urchin-sidepanel') {
    broadcastSidePanelState(true);
    port.onDisconnect.addListener(() => { broadcastSidePanelState(false); });
  }
});

/* ── Context budget — prevent context window overflow ── */
const MAX_CONTEXT_CHARS = 80000;
function trimMessagesToBudget(messages, budget = MAX_CONTEXT_CHARS) {
  let total = messages.reduce((s, m) => s + (m.content || '').length, 0);
  let i = 0;
  while (total > budget && i < messages.length - 2) {
    const old = messages[i].content.length;
    messages[i].content = messages[i].content.slice(0, 200) + '…[trimmed]';
    total -= old - messages[i].content.length;
    i++;
  }
  return messages;
}

/* ── Tool result summarizer — compress oversized tool outputs ── */
function summarizeToolResult(toolName, result) {
  const raw = JSON.stringify(result);
  if (raw.length <= 3000) return raw;
  if (toolName === 'FETCH_URL') return raw.slice(0, 2500) + '…[truncated]';
  if (toolName === 'GET_WALLET_BALANCE' && result.topTokens) {
    result.topTokens = result.topTokens.slice(0, 5);
    return JSON.stringify(result);
  }
  if (toolName === 'GET_WALLET_HISTORY' && result.recentTransactions) {
    result.recentTransactions = result.recentTransactions.slice(0, 5);
    return JSON.stringify(result);
  }
  if (toolName === 'REVERSE_IMAGE_SEARCH' && result.searchResults) {
    result.searchResults = result.searchResults.slice(0, 3).map(r => ({ query: r.query, results: (r.results || []).slice(0, 2) }));
    return JSON.stringify(result);
  }
  if (toolName === 'LIST_SITES' && Array.isArray(result)) {
    return JSON.stringify(result.slice(0, 15));
  }
  return raw.slice(0, 2500) + '…[truncated]';
}

/* ── Context Menus ── */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'urchin-selection', title: 'Send selection to urchinbot (Ask)', contexts: ['selection'] });
  chrome.contextMenus.create({ id: 'urchin-link',      title: 'Send link to urchinbot (Ask)',      contexts: ['link'] });
  chrome.contextMenus.create({ id: 'urchin-image',     title: 'Send image to urchinbot (Build/Deploy)', contexts: ['image'] });
  chrome.contextMenus.create({ id: 'urchin-page',      title: 'Capture current page',              contexts: ['page'] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let payload = {};
  switch (info.menuItemId) {
    case 'urchin-selection': payload = { type: 'text', value: info.selectionText }; break;
    case 'urchin-link':      payload = { type: 'link', value: info.linkUrl };       break;
    case 'urchin-image':     payload = { type: 'image', value: info.srcUrl };       break;
    case 'urchin-page':      payload = { type: 'page', value: tab.url, title: tab.title }; break;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'CONTEXT_CAPTURE', payload });
  } catch (_) { /* content script may not be loaded */ }
});

/* ── Settings helper ── */
async function getSettings() {
  const defaults = {
    llmProvider: 'openai', llmApiKey: '', llmModel: 'gpt-4o-mini', llmBaseUrl: '',
    solanaRpc: '', enableSummaries: true, enableAllSites: false,
    companionMode: false,
    netlifyToken: '',
    pumpTokenName: '', pumpTokenSymbol: '', pumpUseImage: true
  };
  const stored = await chrome.storage.local.get(Object.keys(defaults));
  return { ...defaults, ...stored };
}

/* ── LLM Caller (single message — used by Build/Deploy/Scan) ── */
async function callLLM(systemPrompt, userMessage, settings) {
  return callLLMChat(systemPrompt, [{ role: 'user', content: userMessage }], settings);
}

/* ── Vision LLM call — sends image + text to a vision-capable model ── */
async function callLLMVision(systemPrompt, textPrompt, imageDataUrl, settings) {
  const provider = settings.llmProvider || 'openai';
  const mimeMatch = imageDataUrl.match(/^data:([^;]+);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
  const b64Data = imageDataUrl.split(',')[1];

  if (provider === 'anthropic') {
    const messages = [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: b64Data } },
        { type: 'text', text: textPrompt }
      ]
    }];
    return callLLMChat(systemPrompt, messages, settings);
  } else {
    const messages = [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageDataUrl } },
        { type: 'text', text: textPrompt }
      ]
    }];
    return callLLMChat(systemPrompt, messages, settings);
  }
}

/* ── Screenshot capture ── */
async function captureScreenshot() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 70 });
  return dataUrl;
}

/* ── LLM Caller (conversation — used by ASK agent) ── */
async function callLLMChat(systemPrompt, messages, settings) {
  const provider = settings.llmProvider || 'openai';
  let baseUrl, headers, body;

  const model = settings.llmModel || (provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4.1');
  const maxTok = /claude-opus-4-6/i.test(model) ? 32768
    : /claude-opus-4-5/i.test(model) ? 32768
    : /claude-3-opus/i.test(model) ? 4096
    : /claude-3-5-haiku|haiku/i.test(model) ? 8192
    : /claude/i.test(model) ? 16384
    : /o3-mini|o4-mini/i.test(model) ? 16384
    : /o3|o4/i.test(model) ? 32768
    : /gpt-4\.1-nano/i.test(model) ? 16384
    : /gpt-4\.1/i.test(model) ? 32768
    : /gpt-4o/i.test(model) ? 16384
    : 8192;

  if (provider === 'anthropic') {
    baseUrl = 'https://api.anthropic.com/v1/messages';
    headers = { 'Content-Type': 'application/json', 'x-api-key': settings.llmApiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
    body = JSON.stringify({
      model,
      max_tokens: maxTok,
      system: systemPrompt,
      messages
    });
  } else {
    baseUrl = (provider === 'openai_compatible' && settings.llmBaseUrl) ? settings.llmBaseUrl : 'https://api.openai.com/v1/chat/completions';
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.llmApiKey}` };
    const isReasoning = /^o[0-9]/.test(model);
    const oaiBody = { model, messages: [{ role: 'system', content: systemPrompt }, ...messages] };
    if (isReasoning) { oaiBody.max_completion_tokens = maxTok; }
    else { oaiBody.temperature = 0.7; oaiBody.max_tokens = maxTok; }
    body = JSON.stringify(oaiBody);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);
  let res;
  try {
    res = await fetch(baseUrl, { method: 'POST', headers, body, signal: controller.signal });
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') throw new Error('LLM request timed out (180s). Try a simpler prompt or faster model.');
    throw e;
  }
  clearTimeout(timeout);
  if (!res.ok) throw new Error(`LLM API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  if (provider === 'anthropic') return data.content?.[0]?.text || '';
  return data.choices?.[0]?.message?.content || '';
}

/* ── Streaming LLM call — sends chunks to content.js in real-time ── */
async function callLLMChatStream(systemPrompt, messages, settings, onChunk) {
  const provider = settings.llmProvider || 'openai';
  const model = settings.llmModel || (provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4.1');
  const maxTok = /claude-opus-4-6/i.test(model) ? 32768
    : /claude-opus-4-5/i.test(model) ? 32768
    : /claude-3-opus/i.test(model) ? 4096
    : /claude-3-5-haiku|haiku/i.test(model) ? 8192
    : /claude/i.test(model) ? 16384
    : /o3-mini|o4-mini/i.test(model) ? 16384
    : /o3|o4/i.test(model) ? 32768
    : /gpt-4\.1-nano/i.test(model) ? 16384
    : /gpt-4\.1/i.test(model) ? 32768
    : /gpt-4o/i.test(model) ? 16384
    : 8192;

  let baseUrl, headers, body;
  if (provider === 'anthropic') {
    baseUrl = 'https://api.anthropic.com/v1/messages';
    headers = { 'Content-Type': 'application/json', 'x-api-key': settings.llmApiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
    body = JSON.stringify({ model, max_tokens: maxTok, system: systemPrompt, messages, stream: true });
  } else {
    baseUrl = (provider === 'openai_compatible' && settings.llmBaseUrl) ? settings.llmBaseUrl : 'https://api.openai.com/v1/chat/completions';
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.llmApiKey}` };
    const isReasoning = /^o[0-9]/.test(model);
    const oaiBody = { model, messages: [{ role: 'system', content: systemPrompt }, ...messages], stream: true };
    if (isReasoning) { oaiBody.max_completion_tokens = maxTok; }
    else { oaiBody.temperature = 0.7; oaiBody.max_tokens = maxTok; }
    body = JSON.stringify(oaiBody);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);
  let res;
  try {
    res = await fetch(baseUrl, { method: 'POST', headers, body, signal: controller.signal });
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') throw new Error('LLM request timed out (180s).');
    throw e;
  }
  if (!res.ok) { clearTimeout(timeout); throw new Error(`LLM API ${res.status}: ${(await res.text()).slice(0, 300)}`); }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        try {
          const json = JSON.parse(line.slice(6));
          let chunk = '';
          if (provider === 'anthropic') {
            if (json.type === 'content_block_delta') chunk = json.delta?.text || '';
          } else {
            chunk = json.choices?.[0]?.delta?.content || '';
          }
          if (chunk) { full += chunk; onChunk(chunk, full); }
        } catch (_) {}
      }
    }
  } finally { clearTimeout(timeout); }
  return full;
}

/* ── Broadcast live progress to content script ── */
async function broadcastProgress(data) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { action: 'URCHIN_PROGRESS', ...data });
  } catch (_) {}
}

/* ── Web Search (uses DuckDuckGo Instant Answer or Google Custom Search if configured) ── */
async function webSearch(query, settings) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url);
    const data = await res.json();
    const results = [];
    if (data.AbstractText) results.push({ title: data.Heading || query, snippet: data.AbstractText, url: data.AbstractURL });
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 5)) {
        if (topic.Text) results.push({ snippet: topic.Text, url: topic.FirstURL || '' });
        if (topic.Topics) {
          for (const sub of topic.Topics.slice(0, 2)) {
            if (sub.Text) results.push({ snippet: sub.Text, url: sub.FirstURL || '' });
          }
        }
      }
    }
    if (results.length === 0) results.push({ snippet: data.Abstract || 'No results found. Try a more specific query.', url: '' });
    return results.slice(0, 8);
  } catch (e) {
    return [{ snippet: `Search error: ${e.message}`, url: '' }];
  }
}

/* ── Token Price (uses Jupiter aggregator API for Solana tokens) ── */
async function getTokenPrice(mintOrSymbol, settings) {
  try {
    const ids = mintOrSymbol.trim();
    const res = await fetch(`https://api.jup.ag/price/v2?ids=${encodeURIComponent(ids)}`);
    if (!res.ok) throw new Error(`Jupiter API ${res.status}`);
    const data = await res.json();
    if (data.data && Object.keys(data.data).length > 0) {
      const entry = Object.values(data.data)[0];
      return {
        mint: entry.id,
        symbol: entry.mintSymbol || ids,
        price: entry.price,
        type: entry.type || 'token'
      };
    }
    return { error: 'Token not found. Make sure you use the correct mint address.' };
  } catch (e) {
    return { error: e.message };
  }
}

/* ── Wallet Balance (SOL + top tokens via RPC) ── */
async function getWalletBalance(walletAddress, rpcUrl) {
  const solBalance = await tools.rpcCall('getBalance', [walletAddress], rpcUrl);
  const solAmount = (solBalance.value || 0) / 1e9;

  let tokenAccounts = [];
  try {
    const tokenRes = await tools.rpcCall('getTokenAccountsByOwner', [
      walletAddress,
      { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
      { encoding: 'jsonParsed' }
    ], rpcUrl);
    tokenAccounts = (tokenRes.value || []).map(acc => {
      const info = acc.account.data.parsed.info;
      return {
        mint: info.mint,
        amount: info.tokenAmount.uiAmountString || info.tokenAmount.amount,
        decimals: info.tokenAmount.decimals
      };
    }).filter(t => parseFloat(t.amount) > 0).sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount)).slice(0, 10);
  } catch (_) {}

  return { wallet: walletAddress, solBalance: solAmount, topTokens: tokenAccounts };
}

/* ── Fetch & parse a URL into readable text ── */
async function fetchPageContent(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; UrchinBot/1.0)' }
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
    return text.slice(0, 8000);
  } catch (e) {
    clearTimeout(timeout);
    throw new Error(`Failed to fetch ${url}: ${e.message}`);
  }
}

/* ── Token Risk Scoring — weighted 1-100 score from scan data ── */
function computeRiskScore(scanResult) {
  if (!scanResult || scanResult.error) return null;
  let score = 100;
  const breakdown = [];

  const top1 = parseFloat(scanResult.top1Pct || 0);
  const top5 = parseFloat(scanResult.top5Pct || 0);
  const top10 = parseFloat(scanResult.top10Pct || 0);
  const fresh = scanResult.freshOwnerCount || 0;
  const holders = (scanResult.topHolders || []).length;

  if (top1 > 50) { score -= 35; breakdown.push(`Top holder owns ${top1}% — extreme concentration`); }
  else if (top1 > 30) { score -= 25; breakdown.push(`Top holder owns ${top1}% — high concentration`); }
  else if (top1 > 15) { score -= 12; breakdown.push(`Top holder owns ${top1}% — moderate`); }

  if (top5 > 80) { score -= 20; breakdown.push(`Top 5 hold ${top5}% — very concentrated`); }
  else if (top5 > 60) { score -= 10; breakdown.push(`Top 5 hold ${top5}%`); }

  if (top10 > 90) { score -= 15; breakdown.push(`Top 10 hold ${top10}% — almost all supply`); }

  if (fresh > 5) { score -= 20; breakdown.push(`${fresh} fresh/low-SOL wallets in top holders — sybil risk`); }
  else if (fresh > 2) { score -= 10; breakdown.push(`${fresh} fresh wallets in top holders`); }

  if (holders < 5) { score -= 15; breakdown.push('Very few holders detected'); }

  score = Math.max(1, Math.min(100, score));
  const rating = score >= 75 ? 'LOW RISK' : score >= 45 ? 'MODERATE RISK' : 'HIGH RISK';
  return { score, rating, breakdown };
}

/* ── Price Change Tracking — store & compare prices ── */
async function trackPrice(mint, currentPrice) {
  if (!currentPrice) return null;
  try {
    const { urchinPriceHistory = {} } = await chrome.storage.local.get('urchinPriceHistory');
    const prev = urchinPriceHistory[mint];
    const now = { price: parseFloat(currentPrice), ts: Date.now() };
    urchinPriceHistory[mint] = now;
    const keys = Object.keys(urchinPriceHistory);
    if (keys.length > 50) { delete urchinPriceHistory[keys[0]]; }
    await chrome.storage.local.set({ urchinPriceHistory });
    if (prev) {
      const delta = ((now.price - prev.price) / prev.price * 100).toFixed(2);
      const ago = Math.round((Date.now() - prev.ts) / 60000);
      const agoStr = ago < 60 ? `${ago}m ago` : `${Math.round(ago / 60)}h ago`;
      return { previous: prev.price, current: now.price, changePct: delta, since: agoStr };
    }
    return null;
  } catch (_) { return null; }
}

/* ── On-chain Cross-referencing — detect deployer/holder overlaps ── */
async function crossReferenceScan(scanResult) {
  if (!scanResult || !scanResult.topHolders) return null;
  try {
    const { urchinScanHistory = [] } = await chrome.storage.local.get('urchinScanHistory');
    const overlaps = [];
    const currentAddresses = scanResult.topHolders.map(h => h.address);
    for (const pastScan of urchinScanHistory) {
      if (pastScan.mint === scanResult.mint) continue;
      const pastAddresses = (pastScan.topHolders || []).map(h => h.address);
      const shared = currentAddresses.filter(a => pastAddresses.includes(a));
      if (shared.length > 0) {
        overlaps.push({ mint: pastScan.mint, sharedHolders: shared.length, addresses: shared.slice(0, 3) });
      }
    }
    urchinScanHistory.push({ mint: scanResult.mint, topHolders: scanResult.topHolders.slice(0, 10), ts: Date.now() });
    if (urchinScanHistory.length > 30) urchinScanHistory.shift();
    await chrome.storage.local.set({ urchinScanHistory });
    return overlaps.length > 0 ? overlaps : null;
  } catch (_) { return null; }
}

/* ── Semantic Memory Search — fuzzy keyword match across all memory ── */
function semanticRecall(query, memory) {
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (keywords.length === 0) return { results: [] };
  const results = [];
  for (const [key, value] of Object.entries(memory)) {
    if (key.startsWith('_')) continue;
    const combined = `${key} ${value}`.toLowerCase();
    const matchCount = keywords.filter(kw => combined.includes(kw)).length;
    if (matchCount > 0) {
      results.push({ key, value, relevance: matchCount / keywords.length });
    }
  }
  results.sort((a, b) => b.relevance - a.relevance);
  return { results: results.slice(0, 10) };
}

/* ── DexScreener API — structured token pair data ── */
async function fetchDexScreenerData(mintOrQuery) {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mintOrQuery)}`);
    if (!res.ok) throw new Error(`DexScreener API ${res.status}`);
    const data = await res.json();
    if (!data.pairs || data.pairs.length === 0) return { error: 'No pairs found on DexScreener' };
    return data.pairs.slice(0, 3).map(p => ({
      dex: p.dexId, chain: p.chainId, baseToken: p.baseToken?.symbol, quoteToken: p.quoteToken?.symbol,
      price: p.priceUsd, priceChange24h: p.priceChange?.h24, volume24h: p.volume?.h24,
      liquidity: p.liquidity?.usd, pairAge: p.pairCreatedAt ? Math.round((Date.now() - p.pairCreatedAt) / 86400000) + 'd' : 'unknown',
      fdv: p.fdv, url: p.url
    }));
  } catch (e) { return { error: e.message }; }
}

/* ── Smart page parser — extracts structured data from crypto sites ── */
function parsePageForCryptoData(url, pageText) {
  const data = { pageType: 'unknown', tokens: [], addresses: [], prices: [], links: [] };

  if (/dexscreener\.com/i.test(url)) {
    data.pageType = 'dexscreener';
  } else if (/birdeye\.so/i.test(url)) {
    data.pageType = 'birdeye';
  } else if (/pump\.fun/i.test(url)) {
    data.pageType = 'pump.fun';
  } else if (/jup\.ag|jupiter/i.test(url)) {
    data.pageType = 'jupiter';
  } else if (/solscan\.io/i.test(url)) {
    data.pageType = 'solscan';
  } else if (/x\.com|twitter\.com/i.test(url)) {
    data.pageType = 'twitter';
  } else if (/raydium\.io/i.test(url)) {
    data.pageType = 'raydium';
  }

  const mintRe = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
  const mints = pageText.match(mintRe) || [];
  data.addresses = [...new Set(mints)].filter(m => m.length >= 32 && m.length <= 44).slice(0, 10);

  const priceRe = /\$[\d,]+\.?\d*/g;
  data.prices = [...new Set((pageText.match(priceRe) || []))].slice(0, 10);

  const cashtags = pageText.match(/\$[A-Z]{2,10}/g) || [];
  data.tokens = [...new Set(cashtags)].slice(0, 10);

  return data;
}

/* ── Multi-token scan — scan multiple mints and compare ── */
async function multiTokenScan(mints, rpcUrl) {
  const results = [];
  for (const mint of mints.slice(0, 5)) {
    try {
      const scan = await tools.solanaScanMint(mint.trim(), rpcUrl);
      results.push({ mint: mint.trim(), ...scan });
    } catch (e) {
      results.push({ mint: mint.trim(), error: e.message });
    }
  }
  if (results.length > 1) {
    const valid = results.filter(r => !r.error && r.topHolders);
    if (valid.length > 1) {
      const ranked = valid.sort((a, b) => {
        const aConc = a.topHolders?.reduce((s, h) => s + (h.pct || 0), 0) || 100;
        const bConc = b.topHolders?.reduce((s, h) => s + (h.pct || 0), 0) || 100;
        return aConc - bConc;
      });
      results.push({ _comparison: `Safest distribution: ${ranked[0].mint} — Most concentrated: ${ranked[ranked.length - 1].mint}` });
    }
  }
  return results;
}

/* ── Transaction history for wallet ── */
async function getWalletTransactions(walletAddress, rpcUrl) {
  const sigs = await tools.rpcCall('getSignaturesForAddress', [walletAddress, { limit: 15 }], rpcUrl);
  const txns = [];
  for (const sig of (sigs || []).slice(0, 10)) {
    txns.push({
      signature: sig.signature,
      slot: sig.slot,
      time: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : null,
      err: sig.err ? 'failed' : 'success',
      memo: sig.memo || null
    });
  }
  return { wallet: walletAddress, recentTransactions: txns };
}

/* ── Tools ── */
const tools = {
  detectSolanaMints(text) {
    const re = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
    const matches = text.match(re) || [];
    return [...new Set(matches)].filter(m => m.length >= 32 && m.length <= 44);
  },

  async rpcCall(method, params, rpcUrl) {
    const res = await fetch(rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    const json = await res.json();
    if (json.error) throw new Error(`RPC error: ${json.error.message}`);
    return json.result;
  },

  async solanaScanMint(mint, rpcUrl) {
    const supply = await tools.rpcCall('getTokenSupply', [mint], rpcUrl);
    const totalSupply = parseFloat(supply.value.uiAmountString || supply.value.amount);
    const decimals = supply.value.decimals;

    const largest = await tools.rpcCall('getTokenLargestAccounts', [mint], rpcUrl);
    const accounts = largest.value || [];

    let top1 = 0, top5 = 0, top10 = 0;
    const ownerAddresses = [];
    for (let i = 0; i < Math.min(accounts.length, 10); i++) {
      const pct = (parseFloat(accounts[i].uiAmountString || accounts[i].amount) / totalSupply) * 100;
      if (i < 1) top1 += pct;
      if (i < 5) top5 += pct;
      top10 += pct;
      ownerAddresses.push(accounts[i].address);
    }

    let freshOwnerCount = 0;
    if (ownerAddresses.length > 0) {
      try {
        const accInfos = await tools.rpcCall('getMultipleAccounts', [ownerAddresses, { encoding: 'jsonParsed' }], rpcUrl);
        for (const acc of (accInfos.value || [])) {
          if (acc && acc.lamports < 20000000) freshOwnerCount++;
        }
      } catch (_) { /* non-critical */ }
    }

    return {
      mint,
      totalSupply: totalSupply.toString(),
      decimals,
      top1Pct: top1.toFixed(2),
      top5Pct: top5.toFixed(2),
      top10Pct: top10.toFixed(2),
      topHolders: accounts.slice(0, 10).map((a, i) => ({
        rank: i + 1, address: a.address,
        amount: a.uiAmountString || a.amount,
        pct: ((parseFloat(a.uiAmountString || a.amount) / totalSupply) * 100).toFixed(2)
      })),
      freshOwnerCount,
      links: {
        solscan: `https://solscan.io/token/${mint}`,
        topHolder: accounts[0] ? `https://solscan.io/account/${accounts[0].address}` : null
      }
    };
  },

  validateProjectFiles(project) {
    const errors = [];
    const allowed = ['index.html', 'styles.css', 'app.js'];
    if (!project.projectName) errors.push('Missing projectName');
    if (!Array.isArray(project.files)) { errors.push('files must be array'); return { ok: false, errors }; }

    let totalBytes = 0;
    for (const f of project.files) {
      if (!allowed.includes(f.path)) errors.push(`Disallowed file path: ${f.path}`);
      totalBytes += (f.content || '').length;
    }
    if (totalBytes > 400000) errors.push(`Total size ${totalBytes} exceeds 400KB`);

    const html = project.files.find(f => f.path === 'index.html');
    if (html) {
      if (!html.content.includes('styles.css')) errors.push('index.html must reference styles.css');
      if (!html.content.includes('app.js')) errors.push('index.html must reference app.js');
      if (/<script[^>]+src\s*=\s*["']https?:\/\//i.test(html.content)) errors.push('External script tags not allowed');
    } else {
      errors.push('Missing index.html');
    }

    return { ok: errors.length === 0, errors };
  },

  async zipProject(project) {
    const zip = new JSZip();
    const folder = zip.folder(project.projectName || 'project');
    for (const f of project.files) {
      folder.file(f.path, f.content);
    }
    const blob = await zip.generateAsync({ type: 'arraybuffer' });
    return blob;
  }
};

/* ── Netlify Deploy ── */
async function deployToNetlify(project, settings) {
  const { netlifyToken } = settings;
  if (!netlifyToken) throw new Error('Netlify token required. Go to Settings → paste your Personal Access Token.');

  const headers = {
    'Authorization': `Bearer ${netlifyToken}`,
    'Content-Type': 'application/zip'
  };

  const JSZipLib = typeof JSZip !== 'undefined' ? JSZip : (self.JSZip || null);
  if (!JSZipLib) throw new Error('JSZip not available');

  const zip = new JSZipLib();
  for (const f of project.files) {
    zip.file(f.path, f.content);
  }
  const zipBlob = await zip.generateAsync({ type: 'arraybuffer' });

  const resp = await fetch('https://api.netlify.com/api/v1/sites', {
    method: 'POST',
    headers,
    body: zipBlob
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Netlify deploy failed (${resp.status}): ${errBody.slice(0, 300)}`);
  }

  const site = await resp.json();
  return {
    url: site.ssl_url || site.url || `https://${site.subdomain}.netlify.app`,
    siteId: site.id,
    siteName: site.name
  };
}

async function updateNetlifySite(project, siteId, settings) {
  const { netlifyToken } = settings;
  if (!netlifyToken) throw new Error('Netlify token required. Go to Settings → paste your Personal Access Token.');
  const JSZipLib = typeof JSZip !== 'undefined' ? JSZip : (self.JSZip || null);
  if (!JSZipLib) throw new Error('JSZip not available');
  const zip = new JSZipLib();
  for (const f of project.files) zip.file(f.path, f.content);
  const zipBlob = await zip.generateAsync({ type: 'arraybuffer' });
  const resp = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${netlifyToken}`, 'Content-Type': 'application/zip' },
    body: zipBlob
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Netlify update failed (${resp.status}): ${errBody.slice(0, 300)}`);
  }
  const deploy = await resp.json();
  return {
    url: deploy.ssl_url || deploy.url || `https://${deploy.subdomain}.netlify.app`,
    siteId,
    deployId: deploy.id
  };
}

/* ── Netlify Site Management ── */
async function listNetlifySites(settings) {
  const { netlifyToken } = settings;
  if (!netlifyToken) throw new Error('Netlify token required. Go to Settings → paste your Personal Access Token.');
  const resp = await fetch('https://api.netlify.com/api/v1/sites?per_page=50', {
    headers: { 'Authorization': `Bearer ${netlifyToken}` }
  });
  if (!resp.ok) throw new Error(`Netlify API ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const sites = await resp.json();
  return sites.map(s => ({
    id: s.id,
    name: s.name,
    url: s.ssl_url || s.url || `https://${s.subdomain}.netlify.app`,
    created: s.created_at,
    updated: s.updated_at
  }));
}

async function deleteNetlifySite(siteId, settings) {
  const { netlifyToken } = settings;
  if (!netlifyToken) throw new Error('Netlify token required.');
  const resp = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${netlifyToken}` }
  });
  if (!resp.ok && resp.status !== 204) {
    throw new Error(`Delete failed (${resp.status}): ${(await resp.text()).slice(0, 200)}`);
  }
  return { success: true, deletedId: siteId };
}

/* ── UrchinLoop System Prompts ── */
const SYSTEM_PROMPT_ASK = `You are **urchinbot**, an elite crypto-savvy AI agent built as a Chrome extension overlay. Your name is urchinbot. When asked what you are, say: "I'm urchinbot — a local-first AI agent that lives in your browser. I can see your page, search the web, scan Solana tokens, check wallets, build and deploy websites, and remember everything across sessions. I'm powered by an engine called UrchinLoop."

You are exceptionally intelligent, thorough, and proactive.

MEMORY SYSTEM — you NEVER forget:
- LAYER 1: Condensed history — narrative of all past conversations, compressed but complete
- LAYER 2: Last 30 messages — full fidelity recent conversation
- LAYER 3: User profile — permanent knowledge about this user (name, wallets, preferences, projects)
- LAYER 4: Session summaries — detailed bullet points from past sessions
- LAYER 5: Manual memories — things saved with REMEMBER
You remember across sessions. When you learn something important about the user, REMEMBER it immediately.

TOOLS — include the exact tag in your response to use one:
  <<TOOL:SCAN_TOKEN:MINT_ADDRESS>> — Scan a Solana token mint for holders, concentration, fresh-wallet flags.
  <<TOOL:MULTI_SCAN:MINT1,MINT2,MINT3>> — Scan multiple tokens at once, compare safety.
  <<TOOL:DETECT_MINTS:text>> — Extract Solana mint addresses from text.
  <<TOOL:PREPARE_LAUNCH:{"name":"...","symbol":"...","description":"..."}>> — Prepare token launch packet for Deploy tab.
  <<TOOL:BUILD_SITE:{"description":"..."}>> — Build a full static website.
  <<TOOL:EDIT_SITE:{"changes":"..."}>> — Edit the currently built site.
  <<TOOL:SCREENSHOT>> — Capture and visually analyze the current page.
  <<TOOL:REVERSE_IMAGE_SEARCH>> — Capture the current page/image, identify people/logos/memes via vision + web search. Use when the user asks "who is this?", "identify this", or wants to find the source of an image/meme.
  <<TOOL:WEB_SEARCH:query>> — Search the web for real-time info (prices, news, docs).
  <<TOOL:FETCH_URL:url>> — Fetch and read the full text content of any webpage/URL.
  <<TOOL:GET_TOKEN_PRICE:MINT_OR_SYMBOL>> — Live Solana token price via Jupiter.
  <<TOOL:GET_WALLET_BALANCE:WALLET_ADDRESS>> — SOL balance + top token holdings.
  <<TOOL:GET_WALLET_HISTORY:WALLET_ADDRESS>> — Recent transaction history for a wallet.
  <<TOOL:DEPLOY_SITE>> — Deploy the current built site to Netlify instantly. Returns a live URL.
  <<TOOL:LIST_SITES>> — List all your Netlify sites (name, URL, created date). Use when user asks to see/manage their sites.
  <<TOOL:DELETE_SITE:SITE_ID>> — Delete a Netlify site by ID. Always LIST_SITES first so the user can choose which to delete.
  <<TOOL:REMEMBER:{"key":"...","value":"..."}>> — Save info to persistent memory.
  <<TOOL:RECALL:key>> — Recall saved info. Use "all" to see everything.
  <<TOOL:SEARCH_MEMORY:query>> — Fuzzy search across all saved memories by keywords. Use when the user asks "do you remember anything about X?" or "what do you know about my wallets?"
  <<TOOL:SET_ALERT:{"type":"price","target":"MINT","condition":{"below":100,"above":200}}>> — Set a price or wallet alert. Types: "price" (triggers when price crosses threshold) or "wallet" (triggers on SOL balance change). The user gets a Chrome notification when conditions are met.
  <<TOOL:REMIND_ME:{"task":"...","minutes":60}>> — Schedule a follow-up task. The agent will execute it later and notify the user with results.
  <<TOOL:DEX_DATA:MINT_ADDRESS>> — Fetch structured DexScreener data for a token: price, 24h volume, liquidity, pair age, FDV.
  <<TOOL:SET_TIMER:{"task":"...","minutes":N}>> — Schedule an AUTONOMOUS background task. Unlike REMIND_ME (notification only), SET_TIMER actually runs the task through UrchinLoop when the timer fires. The agent will think, use tools, and deliver a full AI-processed result. Use for: "check this token price in 30 minutes and analyze the change", "research this project in an hour and tell me what you find".
  <<TOOL:SCHEDULE_TASK:{"task":"...","delayMinutes":0}>> — Queue a background task for autonomous execution. delayMinutes=0 means run immediately in background (non-blocking). The task runs through the full agent loop with all tools available, and results are pushed to the user via speech bubble and notification. Use for: follow-up research, multi-step background analysis, proactive monitoring tasks the user didn't explicitly ask for but would benefit from.
  <<TOOL:CONTINUE:reason>> — Self-continuation tool. Signals that you need MORE reasoning steps beyond the current loop. Use when your analysis is incomplete, you want to chain another round of tool calls, or you're working on a complex multi-step task. Include a reason describing what you still need to do. This extends your step budget.
  <<TOOL:MONITOR:{"target":"MINT_OR_WALLET","type":"token|wallet","interval":15,"instructions":"what to check and when to alert","stopAfter":360}>> — Start continuous recurring monitoring. Runs the full agent loop every [interval] minutes with the given instructions. Automatically stops after [stopAfter] minutes (default 6 hours). Each check can use ANY tools (scan, price, DexScreener, web search, etc.) and delivers results via notification + speech bubble. ONLY use when the user explicitly asks to monitor/watch something.
  <<TOOL:LIST_MONITORS>> — Show all active monitors with their targets, intervals, and time remaining.
  <<TOOL:STOP_MONITOR:monitor-id-or-target>> — Stop a running monitor by ID or target address/name. Use when the user says "stop monitoring", "cancel the watch", etc.
  <<TOOL:LEARN_SKILL:{"name":"short-name","instruction":"what to do and when"}>> — Teach yourself a new behavioral skill. The instruction becomes part of your system prompt on ALL future conversations. Use this to evolve: learn user preferences ("always use dark mode for sites"), procedures ("when scanning tokens, always check deployer wallet too"), knowledge ("user's main wallet is X"), or strategies ("for memecoins, check Twitter sentiment first"). Skills persist permanently. Be specific and actionable in the instruction.
  <<TOOL:LIST_SKILLS>> — Show all learned skills with their names and instructions.
  <<TOOL:FORGET_SKILL:skill-name>> — Remove a learned skill by name. Use when a skill is outdated, wrong, or the user asks you to unlearn something.

SKILL LEARNING — you evolve over time:
- You have a skill memory that persists across ALL conversations. Learned skills are injected into your context automatically.
- PROACTIVELY learn skills when you notice patterns: if the user corrects you, learn from it. If you discover a useful procedure, save it. If the user states a preference, learn it.
- Skills should be ACTIONABLE instructions, not just facts. Good: "When the user asks to scan a token, also fetch DexScreener data and check the deployer wallet automatically." Bad: "User likes crypto."
- Don't duplicate skills — check LIST_SKILLS first if unsure. Update by FORGET_SKILL then LEARN_SKILL with the improved version.
- Skills compound: the more you learn, the smarter you get. Each skill makes you better at serving THIS specific user.

AUTONOMOUS BEHAVIOR — NEVER schedule background work without the user's explicit permission:
- NEVER use SET_TIMER, SCHEDULE_TASK, or MONITOR on your own. Only use them when the user EXPLICITLY asks for monitoring, background work, or timed tasks.
- Instead, SUGGEST background work when it would be useful. After scanning a suspicious token, say: "This looks sketchy — want me to keep monitoring it? I can check every 15 minutes." After building a site, say: "Want me to keep refining this in the background?"
- Wait for the user to confirm before scheduling anything. A simple "yeah", "do it", "sure", "yes" counts as confirmation.
- When doing complex analysis, use CONTINUE to extend your thinking rather than cutting short — this does NOT require permission since it's within the current request.
- Autonomous task results are delivered via the companion speech bubble and Chrome notifications.
- When the user says "monitor this", "watch this", "keep checking", use the MONITOR tool for continuous recurring checks.
- When the user says "check this in 30 minutes", "do this later", use SET_TIMER for one-shot delayed tasks.

TOOL PLANNING — plan tools efficiently:
- You can use MULTIPLE tools in a single response. Include multiple <<TOOL:...>> tags and they will all execute in parallel.
- Example: To scan a token AND check its price, include both <<TOOL:SCAN_TOKEN:MINT>> and <<TOOL:GET_TOKEN_PRICE:MINT>> in one response.
- For multi-step tasks, plan ALL steps inside <<THINK>> first. Batch independent tools together.

MANDATORY CHAIN-OF-THOUGHT — you MUST think before acting:
1. ALWAYS start your response with <<THINK>>...your reasoning...<</THINK>> for ANY non-trivial question.
2. Inside <<THINK>>, analyze: What does the user want? What tools do I need? What's my plan? What do I already know from memory? Estimate confidence 1-5.
3. Only skip <<THINK>> for simple greetings or one-word answers.
4. For multi-step tasks, plan ALL steps inside <<THINK>> first, then execute them one tool at a time.
5. You have up to 12 reasoning steps per request — use them.
6. If confidence < 3 on a factual claim, use WEB_SEARCH to verify before answering.

SELF-VERIFICATION — before giving your final answer:
- Re-read what the user asked. Does your answer actually address it?
- If you used tools, did the results make sense? Any contradictions?
- If you're unsure, say so. Never confidently state something you're not sure about.
- If results seem wrong or incomplete, try a different tool or approach.
- For token scans: always mention the risk score and any cross-reference overlaps with previous scans.

AUTO-CONTEXT — be proactive about the user's page:
- If page context mentions DexScreener, Birdeye, pump.fun, Jupiter, Solscan, Raydium → auto-detect mints and offer to scan.
- If page has $CASHTAGS or token names → identify them and offer price/scan info.
- If page has wallet addresses → offer to check balance/history.
- If the user pastes a URL → auto-FETCH_URL it and summarize.
- If page context shows a crypto-related page, proactively provide relevant analysis.

PROACTIVE INTELLIGENCE:
- Notice patterns: if the user keeps scanning tokens, offer a comparison. If they keep building sites, suggest improvements.
- Suggest next steps: after scanning a token, suggest checking the deployer wallet. After building a site, suggest deploying it.
- Cross-reference: if you scan a token and the deployer wallet matches one from a previous scan, flag it.
- Learn preferences: if the user likes dark mode sites, remember that. If they trade certain tokens, remember those.
- When the user's question is vague, make a best-effort attempt using context clues from the page and memory, rather than asking for clarification.

SMART SUGGESTIONS — offer background work, don't force it:
- After scanning a token with high risk or unusual patterns: "Want me to monitor this token? I can check every 15 minutes and alert you if holders or price change significantly."
- After checking a wallet with large holdings: "Want me to keep an eye on this wallet? I'll notify you if any big moves happen."
- After building a site: "Want me to keep refining this in the background? I can run another design critique and fix any issues."
- After a complex multi-tool analysis: "Want me to schedule a follow-up check in an hour to see if anything changed?"
- ALWAYS phrase as a question. NEVER schedule without confirmation. The user's API credits are at stake.

RULES:
- When you see tokens/mints on screen, auto-detect and offer to scan.
- When the user wants to launch/deploy a token, use PREPARE_LAUNCH.
- When the user wants a website, use BUILD_SITE. When editing, use EDIT_SITE (never describe changes in text).
- When the user says "deploy", "put it live", "push to netlify", or "launch the site" — use DEPLOY_SITE. You can chain BUILD_SITE → DEPLOY_SITE to build and deploy in one go.
- When the user asks to see/list/manage their sites or delete old deploys, use LIST_SITES first to show them all sites, then DELETE_SITE for any they want removed. ALWAYS confirm which sites before deleting.
- When the user asks what you see, use SCREENSHOT.
- When the user asks "who is this?", "identify this person/meme", "reverse image search", or wants to identify people/logos/memes on screen, use REVERSE_IMAGE_SEARCH. It captures the screen, describes what it sees, then searches the web to identify it.
- For prices/news/real-time info, use WEB_SEARCH or GET_TOKEN_PRICE.
- When the user shares a URL, use FETCH_URL to read it.
- For wallet analysis, chain GET_WALLET_BALANCE → GET_WALLET_HISTORY for a complete picture.
- To compare tokens, use MULTI_SCAN instead of scanning one at a time.
- ONLY output the tool tag and a brief note when using a tool. I execute it and return the result.
- Be concise, direct, and crypto-savvy. Use memory to personalize.
- Page context (URL, title, visible text) is in [brackets] with each message.
- When the user asks to set an alert, watch a price, or monitor a wallet, use SET_ALERT.
- When the user says "remind me", "check back in", "in X minutes/hours", use REMIND_ME for simple notifications or SET_TIMER for tasks that need intelligent execution.
- Use SET_TIMER when the user wants you to DO something later (research, check, analyze). Use REMIND_ME when they just want a notification.
- Use SCHEDULE_TASK ONLY when the user explicitly asks for background work. NEVER schedule tasks on your own — suggest them instead and wait for confirmation.
- When the user says "monitor this", "watch this token", "keep an eye on this", use MONITOR for recurring checks. When they say "stop monitoring", use STOP_MONITOR.
- Use CONTINUE when you need more reasoning steps — don't cut complex analysis short.
- When the user corrects you, states a preference, or you discover a useful procedure, use LEARN_SKILL to remember it permanently. When the user asks "what have you learned?" or "show your skills", use LIST_SKILLS. When the user says "forget that" or "unlearn", use FORGET_SKILL.
- Use SEARCH_MEMORY when the user asks "do you remember", "what do you know about", or references past conversations vaguely.
- Use DEX_DATA for detailed market data (volume, liquidity, pair age). Combine with GET_TOKEN_PRICE for complete analysis.
- Format responses with **bold** for emphasis, bullet points for lists, and \`code\` for addresses/mints. Your responses will be rendered as markdown.`;

/* ── Proactive Briefing Generator ── */
async function generateBriefing(settings) {
  try {
    const parts = [];
    const { urchinPriceHistory = {}, urchinWatches = [], urchinProfile = {} } = await chrome.storage.local.get(['urchinPriceHistory', 'urchinWatches', 'urchinProfile']);

    for (const [mint, data] of Object.entries(urchinPriceHistory).slice(-5)) {
      try {
        const current = await getTokenPrice(mint, settings);
        if (current.price) {
          const delta = ((parseFloat(current.price) - data.price) / data.price * 100).toFixed(2);
          parts.push(`**${current.symbol || mint.slice(0, 8)}**: $${current.price} (${delta > 0 ? '+' : ''}${delta}% since last check)`);
        }
      } catch (_) {}
    }

    if (urchinWatches.length > 0) parts.push(`\n📡 **${urchinWatches.length} active alert(s)** monitoring`);

    if (Object.keys(urchinProfile).length > 0) {
      const wallets = Object.entries(urchinProfile).filter(([k]) => /wallet|address/i.test(k));
      for (const [, addr] of wallets.slice(0, 2)) {
        try {
          if (!settings.solanaRpc) continue;
          const bal = await getWalletBalance(addr, settings.solanaRpc);
          parts.push(`👛 Wallet ${addr.slice(0, 6)}…: **${bal.solBalance.toFixed(4)} SOL** + ${bal.topTokens.length} tokens`);
        } catch (_) {}
      }
    }

    return parts.length > 0 ? '🌅 **Briefing**\n' + parts.join('\n') : null;
  } catch (_) { return null; }
}

const SITE_BUILDER_PROMPT = `You are urchinbot's site builder — an elite web designer and developer. Build a STUNNING, production-quality static website.

OUTPUT FORMAT — ONLY valid JSON, no markdown, no commentary:
{"projectName":"kebab-case-name","files":[{"path":"index.html","content":"..."},{"path":"styles.css","content":"..."},{"path":"app.js","content":"..."}],"notes":["..."]}

DESIGN STANDARDS — every site you build must have:
- Beautiful, modern design with strong visual hierarchy
- Smooth animations and micro-interactions (CSS transitions, scroll effects, hover states)
- Fully responsive (mobile-first, looks great 320px-2560px)
- Rich color palette with gradients, not flat boring colors
- Professional typography with proper font sizing/spacing (use system fonts or Google Fonts via @import in CSS)
- Subtle glassmorphism, shadows, or depth effects where appropriate
- Proper semantic HTML5 (header, main, section, footer, nav)
- Dark mode aware (prefers-color-scheme media query)
- Accessible (alt text, aria labels, proper contrast)
- Hero sections with engaging headlines and CTAs
- Smooth scroll behavior
- Loading animations or entrance effects

TECHNICAL RULES:
- ONLY files: index.html, styles.css, app.js
- index.html MUST link styles.css and app.js via relative paths
- ALL styling in styles.css (not inline), ALL JS in app.js (not inline)
- NO external script/CDN imports (except Google Fonts @import in CSS is OK)
- NO analytics/tracking code
- Make interactive elements WORK (buttons, nav links, scroll-to-section, toggles)
- Use CSS custom properties for theming
- Total under 400KB

You are NOT building a basic template. You are building something a designer would be proud of.`;

const SITE_EDITOR_PROMPT = `You are urchinbot's site editor — an elite web developer editing an existing website. You will receive the current project files and a description of changes.

OUTPUT FORMAT — ONLY valid JSON with the COMPLETE updated project (all files, even unchanged ones):
{"projectName":"string","files":[{"path":"index.html","content":"..."},{"path":"styles.css","content":"..."},{"path":"app.js","content":"..."}],"notes":["what changed"]}

RULES:
- Return ALL files, with the requested changes applied
- Keep everything that works — only change what was requested
- Maintain the existing design quality and consistency
- If adding new sections, match the existing style
- ONLY files: index.html, styles.css, app.js
- NO external scripts (Google Fonts @import OK)
- No markdown, no commentary outside JSON`;

const SYSTEM_PROMPT_PUMP = `You are urchinbot's pump.fun launch packet generator. Create a complete launch preparation packet. Output ONLY valid JSON with this schema:
{"tokenName":"string","tokenSymbol":"string","description":"string","website":{"projectName":"string","files":[{"path":"index.html","content":"..."},{"path":"styles.css","content":"..."},{"path":"app.js","content":"..."}],"notes":[]},"imageGuidance":"string","checklist":["step1","step2","..."],"disclaimers":["..."]}
Rules:
- tokenSymbol should be uppercase, 3-8 chars
- website follows same rules as BUILD_SITE
- checklist must include steps the user does manually on pump.fun
- Include disclaimers about DYOR and risk
- NEVER claim to actually deploy anything
No markdown. No commentary outside JSON.`;

/* ── Site Builder/Editor helpers ── */
const SELF_REFLECT_PROMPT = `You are a senior web design critic. Review this website code and return ONLY valid JSON:
{"score":1-10,"issues":["issue1","issue2"],"fixes":"specific changes to make"}
Be harsh. Check for: missing responsive design, poor color contrast, no animations/transitions, bad typography, broken layouts, missing hover states, no dark mode, accessibility issues, ugly or generic design. If score >= 8, set fixes to "none".`;

function extractJSON(raw) {
  let cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); } catch (_) {}

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch (_) {}
  }

  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1].trim()); } catch (_) {}
  }

  const braceDepth = [];
  let objStart = -1;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '{') { if (objStart === -1) objStart = i; braceDepth.push(i); }
    else if (raw[i] === '}') {
      braceDepth.pop();
      if (braceDepth.length === 0 && objStart !== -1) {
        try { return JSON.parse(raw.slice(objStart, i + 1)); } catch (_) { objStart = -1; }
      }
    }
  }
  return null;
}

async function buildSiteViaLLM(description, extraContext, settings, addStep, maxAttempts = 2, uploadedFiles, skipReflection = false) {
  let project = null;
  let lastError = '';
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    addStep('build_call', { attempt: attempt + 1 });
    try {
      const prompt = attempt === 0
        ? description + (extraContext || '')
        : `${description}\n\nPrevious attempt failed validation. Return ONLY valid JSON matching the schema. No markdown wrapping.`;
      const raw = await callLLM(SITE_BUILDER_PROMPT, prompt, settings);
      addStep('build_response', { length: raw.length });
      project = extractJSON(raw);
      if (!project) {
        lastError = `Could not extract JSON (response was ${raw.length} chars, starts with: "${raw.slice(0, 120)}...")`;
        addStep('build_error', { attempt: attempt + 1, error: lastError });
        continue;
      }
      const validation = tools.validateProjectFiles(project);
      addStep('build_validate', validation);
      if (validation.ok || project.files) break;
      lastError = `Validation failed: ${(validation.errors || []).join(', ')}`;
    } catch (e) {
      lastError = e.message;
      addStep('build_error', { attempt: attempt + 1, error: e.message });
    }
  }
  if (!project || !project.files) return { _buildError: lastError || 'Unknown build error' };

  // Inject uploaded images into the HTML as data URLs
  if (uploadedFiles && uploadedFiles.length > 0) {
    const imageFiles = uploadedFiles.filter(f => f.type && f.type.startsWith('image/') && f.dataUrl);
    if (imageFiles.length > 0) {
      const htmlFile = project.files.find(f => f.path === 'index.html');
      if (htmlFile) {
        for (const img of imageFiles) {
          const placeholderPatterns = [
            /src\s*=\s*["'](?:https?:\/\/[^"']*placeholder[^"']*|#IMAGE#|IMAGE_URL|placeholder\.[a-z]+)["']/gi,
            /src\s*=\s*["'](?:https?:\/\/via\.placeholder[^"']*)["']/gi,
          ];
          let replaced = false;
          for (const pattern of placeholderPatterns) {
            if (pattern.test(htmlFile.content)) {
              htmlFile.content = htmlFile.content.replace(pattern, `src="${img.dataUrl}"`);
              replaced = true;
              break;
            }
          }
          if (!replaced) {
            const firstImgTag = htmlFile.content.match(/<img[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/i);
            if (firstImgTag && !firstImgTag[1].startsWith('data:')) {
              htmlFile.content = htmlFile.content.replace(firstImgTag[1], img.dataUrl);
            }
          }
        }
      }
    }
  }

  if (skipReflection) return project;

  try {
    addStep('reflect_start', {});
    const siteCode = project.files.map(f => `--- ${f.path} ---\n${f.content}`).join('\n\n');
    const critiqueRaw = await callLLM(SELF_REFLECT_PROMPT, `Original request: "${description}"\n\n${siteCode}`, settings);
    const critique = extractJSON(critiqueRaw);
    if (!critique) throw new Error('Could not parse critique');
    addStep('reflect_result', { score: critique.score, issues: critique.issues?.length || 0 });

    if (critique.score < 8 && critique.fixes && critique.fixes !== 'none') {
      addStep('reflect_fix', { fixes: critique.fixes.slice(0, 200) });
      const fixPrompt = `Original request: "${description}"\n\nCurrent site code:\n${siteCode}\n\nCritique (score ${critique.score}/10):\nIssues: ${(critique.issues || []).join('; ')}\nFixes needed: ${critique.fixes}\n\nApply ALL fixes and return the improved project as valid JSON. Same schema.`;
      const fixRaw = await callLLM(SITE_BUILDER_PROMPT, fixPrompt, settings);
      const fixedProject = extractJSON(fixRaw);
      if (fixedProject && fixedProject.files) {
        addStep('reflect_improved', { oldScore: critique.score });
        return fixedProject;
      }
    }
  } catch (e) {
    addStep('reflect_skip', { error: e.message });
  }

  return project;
}

async function editSiteViaLLM(currentProject, changes, settings, addStep) {
  const filesDesc = currentProject.files.map(f =>
    `--- ${f.path} ---\n${f.content}`
  ).join('\n\n');
  const prompt = `Current project "${currentProject.projectName}":\n\n${filesDesc}\n\n---\nRequested changes: ${changes}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    addStep('edit_call', { attempt: attempt + 1 });
    try {
      const raw = await callLLM(SITE_EDITOR_PROMPT, prompt, settings);
      addStep('edit_response', { length: raw.length });
      const project = extractJSON(raw);
      if (!project) { addStep('edit_error', { attempt: attempt + 1, error: 'Could not extract valid JSON' }); continue; }
      const validation = tools.validateProjectFiles(project);
      addStep('edit_validate', validation);
      if (validation.ok) return project;
      if (!validation.ok && project.files) return project;
    } catch (e) {
      addStep('edit_error', { attempt: attempt + 1, error: e.message });
    }
  }
  return null;
}

/* ── UrchinLoop Core ── */
async function urchinLoop(task, userInput, context, settings, pageContext, history, uploadedFiles) {
  const requestId = `ul-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const log = { requestId, task, steps: [], startTime: Date.now(), _pageContext: pageContext, _history: history };

  const addStep = (type, data) => {
    log.steps.push({ type, data, time: Date.now() });
  };

  addStep('init', { task, inputLength: userInput.length, contextItems: context.length });

  if (!settings.llmApiKey) {
    addStep('error', { message: 'No LLM API key configured. Go to Settings.' });
    return { requestId, success: false, error: 'No LLM API key configured.', log };
  }

  let systemPrompt;
  switch (task) {
    case 'ASK': systemPrompt = SYSTEM_PROMPT_ASK; break;
    case 'BUILD_SITE': systemPrompt = SITE_BUILDER_PROMPT; break;
    case 'PUMPFUN_LAUNCH_PACKET': systemPrompt = SYSTEM_PROMPT_PUMP; break;
    case 'SOLANA_SCAN':
      return await handleSolanaScan(userInput, context, settings, log, addStep, requestId);
    default:
      return { requestId, success: false, error: `Unknown task: ${task}`, log };
  }

  let contextStr = '';
  if (context.length > 0) {
    contextStr = '\n\nCaptured context:\n' + context.map(c => `[${c.type}] ${c.value}`).join('\n');
  }

  let result = null;

  /* ═══ ASK: agentic loop with tool calling + conversation memory ═══ */
  if (task === 'ASK') {
    const messages = [];

    // ──── LAYER 1: Rolling condensation (compressed history older than 30 msgs) ────
    try {
      const { urchinCondensed } = await chrome.storage.local.get('urchinCondensed');
      if (urchinCondensed && urchinCondensed.length > 0) {
        messages.push({ role: 'user', content: `[Previous conversation history (condensed):\n${urchinCondensed}]` });
        messages.push({ role: 'assistant', content: 'Understood — I remember our previous conversations.' });
      }
    } catch (_) {}

    // ──── LAYER 2: Recent chat history (last 30 messages — full fidelity) ────
    const hist = log._history || [];
    for (const h of hist.slice(-30)) {
      messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.text });
    }

    // ──── LAYER 3: Build current user message with rich page context ────
    let userMsg = '';
    const pc = log._pageContext;
    if (pc) {
      userMsg += `[Page: ${pc.title || ''} — ${pc.url || ''}]\n`;
      if (pc.selection) userMsg += `[Selected text: ${pc.selection}]\n`;
      if (pc.tweets) userMsg += `[Visible tweets:\n${pc.tweets}]\n`;
      else if (pc.visibleText) userMsg += `[Page content: ${pc.visibleText.slice(0, 3000)}]\n`;
      if (pc.dexPairs) userMsg += `[DEX pairs visible: ${pc.dexPairs}]\n`;
      if (pc.pumpFormData) userMsg += `[Pump.fun form data: ${pc.pumpFormData}]\n`;
      if (pc.cryptoLinks) userMsg += `[Crypto links on page:\n${pc.cryptoLinks}]\n`;
    }

    try {
      const { urchinCurrentProject } = await chrome.storage.local.get('urchinCurrentProject');
      if (urchinCurrentProject && urchinCurrentProject.files) {
        const fileList = urchinCurrentProject.files.map(f => f.path).join(', ');
        userMsg += `[Current project: "${urchinCurrentProject.projectName || 'untitled'}" with files: ${fileList}]\n`;
      }
    } catch (_) {}

    if (contextStr) userMsg += contextStr + '\n';
    userMsg += '\n' + userInput;
    messages.push({ role: 'user', content: userMsg.trim() });

    const toolRe = /<<TOOL:(\w+)(?::([\s\S]+?))?>>/;
    const thinkRe = /<<THINK>>([\s\S]+?)<<\/THINK>>/;
    let finalAnswer = '';

    // ──── LAYER 4: Inject user profile (permanent knowledge about this user) ────
    try {
      const { urchinProfile } = await chrome.storage.local.get('urchinProfile');
      if (urchinProfile && Object.keys(urchinProfile).length > 0) {
        const profileStr = Object.entries(urchinProfile).map(([k, v]) => `  ${k}: ${v}`).join('\n');
        messages[messages.length - 1].content += `\n\n[User profile (permanent):\n${profileStr}]`;
      }
    } catch (_) {}

    // ──── LAYER 5: Inject session summaries (compressed past sessions) ────
    try {
      const { urchinMemory = {} } = await chrome.storage.local.get('urchinMemory');
      const sessionKeys = Object.keys(urchinMemory).filter(k => k.startsWith('session_')).sort().reverse();
      if (sessionKeys.length > 0) {
        const recentSessions = sessionKeys.slice(0, 10).map(k => urchinMemory[k]).join('\n---\n');
        messages[messages.length - 1].content += `\n\n[Past session summaries:\n${recentSessions}]`;
      }
      const manualKeys = Object.keys(urchinMemory).filter(k => !k.startsWith('session_') && !k.startsWith('_'));
      if (manualKeys.length > 0) {
        const manualStr = manualKeys.map(k => `  ${k}: ${urchinMemory[k]}`).join('\n');
        messages[messages.length - 1].content += `\n\n[Saved memories:\n${manualStr}]`;
      }
    } catch (_) {}

    // ──── LAYER 6: Learned skills — self-evolving behavioral instructions ────
    try {
      const { urchinSkills = [] } = await chrome.storage.local.get('urchinSkills');
      if (urchinSkills.length > 0) {
        const skillBlock = urchinSkills.map(s => {
          s.usageCount = (s.usageCount || 0) + 1;
          return `  • ${s.name}: ${s.instruction}`;
        }).join('\n');
        messages[messages.length - 1].content += `\n\n[Learned skills (apply these):\n${skillBlock}]`;
        await chrome.storage.local.set({ urchinSkills });
      }
    } catch (_) {}

    // ──── AUTO-CONTEXT: detect page type and inject smart hints ────
    const pc2 = log._pageContext;
    if (pc2 && pc2.url) {
      const pageData = parsePageForCryptoData(pc2.url, pc2.visibleText || '');
      if (pageData.pageType !== 'unknown') {
        let hint = `[Auto-detected page type: ${pageData.pageType}]`;
        if (pageData.addresses.length > 0) hint += `\n[Detected mint addresses on page: ${pageData.addresses.slice(0, 5).join(', ')}]`;
        if (pageData.tokens.length > 0) hint += `\n[Detected token cashtags: ${pageData.tokens.join(', ')}]`;
        if (pageData.prices.length > 0) hint += `\n[Prices visible: ${pageData.prices.slice(0, 5).join(', ')}]`;
        messages[messages.length - 1].content += '\n' + hint;
      }
    }

    // ──── CONTEXT BUDGET: trim messages to stay within limits ────
    trimMessagesToBudget(messages);

    // ──── SELF-ROUTING: classify simple vs complex to skip unnecessary loop steps ────
    let maxSteps = 12;
    try {
      const routePrompt = 'Classify this user message. Reply with EXACTLY one word: SIMPLE if it is a greeting, identity question, opinion, memory recall, or general knowledge question that needs NO tools. Reply COMPLEX if it needs any tool call (search, scan, screenshot, build, deploy, fetch, wallet, price lookup, image identification) or multi-step reasoning.';
      const lastMsg = messages[messages.length - 1].content.slice(-600);
      const routeResult = await callLLMChat(routePrompt, [{ role: 'user', content: lastMsg }], settings);
      const classification = routeResult.trim().toUpperCase();
      if (classification.includes('SIMPLE')) {
        maxSteps = 1;
        addStep('route', { classification: 'SIMPLE', maxSteps: 1 });
      } else {
        addStep('route', { classification: 'COMPLEX', maxSteps: 12 });
      }
    } catch (_) {
      addStep('route', { classification: 'FALLBACK_COMPLEX', maxSteps: 12 });
    }

    broadcastProgress({ phase: 'routing_done', maxSteps });

    for (let step = 0; step < maxSteps; step++) {
      addStep('agent_call', { step: step + 1, maxSteps, msgCount: messages.length });
      broadcastProgress({ phase: 'llm_call', step: step + 1, maxSteps });
      try {
        let raw = '';
        const useStreaming = maxSteps === 1;
        if (useStreaming) {
          try {
            raw = await callLLMChatStream(systemPrompt, messages, settings, (chunk, full) => {
              broadcastProgress({ phase: 'streaming', chunk, fullSoFar: full });
            });
          } catch (_streamErr) {
            raw = await callLLMChat(systemPrompt, messages, settings);
          }
        } else {
          raw = await callLLMChat(systemPrompt, messages, settings);
        }
        addStep('agent_response', { length: raw.length, preview: raw.slice(0, 200) });

        let thinkContent = '';
        const thinkMatch = raw.match(thinkRe);
        if (thinkMatch) {
          thinkContent = thinkMatch[1].trim();
          addStep('agent_think', { thought: thinkContent.slice(0, 500) });
        }
        const cleanedRaw = raw.replace(thinkRe, '').trim();

        // ──── PARALLEL TOOL EXECUTION: detect all tool tags ────
        const toolReGlobal = /<<TOOL:(\w+)(?::([\s\S]+?))?>>/g;
        const allMatches = [...cleanedRaw.matchAll(toolReGlobal)];

        if (allMatches.length > 0) {
          if (maxSteps === 1) { maxSteps = 12; addStep('route_upgrade', { reason: 'tool_detected' }); }

          const toolJobs = allMatches.map(m => ({ toolName: m[1], toolParam: m[2] || '' }));
          addStep('tool_calls', { count: toolJobs.length, tools: toolJobs.map(j => j.toolName) });
          broadcastProgress({ phase: 'tools', tools: toolJobs.map(j => j.toolName) });

          const executeToolJob = async ({ toolName, toolParam }) => {
            let toolResult;
            try {
              switch (toolName) {
              case 'SCAN_TOKEN': {
                if (!settings.solanaRpc) throw new Error('No Solana RPC configured');
                const scanRes = await tools.solanaScanMint(toolParam.trim(), settings.solanaRpc);
                scanRes.riskScore = computeRiskScore(scanRes);
                const overlaps = await crossReferenceScan(scanRes);
                if (overlaps) scanRes.crossRef = overlaps;
                return scanRes;
              }
              case 'DETECT_MINTS':
                return tools.detectSolanaMints(toolParam);
              case 'PREPARE_LAUNCH': {
                const cleaned = toolParam.replace(/```json\s*/g, '').replace(/```/g, '').trim();
                const launchInfo = JSON.parse(cleaned);
                await chrome.storage.local.set({ urchinLaunchData: { ...launchInfo, ts: Date.now() } });
                return { success: true, message: `Launch packet prepared: ${launchInfo.name} ($${launchInfo.symbol}). Deploy tab is ready.` };
              }
              case 'BUILD_SITE': {
                const buildReq = extractJSON(toolParam) || { description: toolParam.trim() };
                let imgContext = '';
                if (uploadedFiles && uploadedFiles.length > 0) {
                  const imageFiles = uploadedFiles.filter(f => f.type && f.type.startsWith('image/'));
                  if (imageFiles.length > 0) {
                    imgContext = '\n\nIMAGES AVAILABLE — embed these directly in the HTML using data URLs or as img src:\n' +
                      imageFiles.map(f => `- ${f.name} (${f.type}): use this data URL as the src → ${f.dataUrl.slice(0, 100)}...`).join('\n') +
                      '\nIMPORTANT: Use the FULL data URL (provided below) as the src attribute for <img> tags. Do NOT use placeholder URLs.';
                  }
                }
                const buildResult = await buildSiteViaLLM(buildReq.description || userInput, contextStr + imgContext, settings, addStep, 1, uploadedFiles);
                if (buildResult && buildResult.files) {
                  await chrome.storage.local.set({ urchinCurrentProject: buildResult });
                  return { success: true, projectName: buildResult.projectName, files: buildResult.files.map(f => f.path), message: 'Site built and saved. Visible in Build tab.' };
                }
                return { error: `Build failed: ${buildResult?._buildError || 'LLM did not return valid project JSON'}` };
              }
              case 'EDIT_SITE': {
                const editReq = extractJSON(toolParam) || { changes: toolParam.trim() };
                const { urchinCurrentProject: currentProj } = await chrome.storage.local.get('urchinCurrentProject');
                if (!currentProj) return { error: 'No current project to edit. Build one first.' };
                const editResult = await editSiteViaLLM(currentProj, editReq.changes, settings, addStep);
                if (editResult) {
                  await chrome.storage.local.set({ urchinCurrentProject: editResult });
                  return { success: true, projectName: editResult.projectName, message: 'Site updated. Changes visible in Build tab.' };
                }
                return { error: 'Edit failed — LLM did not return valid project JSON' };
              }
              case 'SCREENSHOT': {
                try {
                  const screenshot = await captureScreenshot();
                  const visionResult = await callLLMVision(
                    'Describe what you see on this webpage screenshot. Focus on: layout, key content, any crypto/token related info, wallet addresses, prices, charts, or relevant data. Be concise and factual.',
                    'What do you see on this page?', screenshot, settings);
                  return { success: true, description: visionResult };
                } catch (e) { return { error: `Screenshot failed: ${e.message}` }; }
              }
              case 'REVERSE_IMAGE_SEARCH': {
                try {
                  addStep('reverse_img', { phase: 'capturing' });
                  const screenshot = await captureScreenshot();
                  addStep('reverse_img', { phase: 'analyzing' });
                  const visionDesc = await callLLMVision(
                    `You are an image identification expert. Analyze this screenshot and provide DETAILED descriptions for reverse-searching:\n1. PEOPLE: Describe each person visible.\n2. TEXT: Transcribe ALL visible text exactly.\n3. LOGOS/BRANDS: Describe any logos or brand imagery.\n4. MEMES: Describe meme format/template and text overlays.\n5. CONTEXT: What platform? Overall scene?\n\nOutput JSON: {"people":[],"text":[],"searchQueries":[],"platform":"","description":""}`,
                    'Identify everything in this image for reverse search purposes.', screenshot, settings);
                  addStep('reverse_img', { phase: 'searching', visionLength: visionDesc.length });
                  let parsed;
                  try { parsed = JSON.parse(visionDesc.replace(/```json\s*/g, '').replace(/```/g, '').trim()); }
                  catch (_) { parsed = { searchQueries: [visionDesc.slice(0, 200)], description: visionDesc }; }
                  const allResults = [];
                  const queries = (parsed.searchQueries || []).slice(0, 4);
                  if (parsed.text?.length > 0) queries.push(...parsed.text.filter(t => t.length > 3 && t.length < 100).slice(0, 2));
                  for (const q of queries.slice(0, 5)) {
                    try { allResults.push({ query: q, results: (await webSearch(q, settings)).slice(0, 3) }); } catch (_) {}
                  }
                  return { success: true, visionAnalysis: parsed, searchResults: allResults,
                    summary: `Analyzed screenshot. Found: ${(parsed.people || []).length} people, ${(parsed.text || []).length} text elements. Ran ${allResults.length} searches.` };
                } catch (e) { return { error: `Reverse image search failed: ${e.message}` }; }
              }
              case 'WEB_SEARCH':
                try { return { success: true, results: await webSearch(toolParam.trim(), settings) }; }
                catch (e) { return { error: `Search failed: ${e.message}` }; }
              case 'GET_TOKEN_PRICE':
                try {
                  const pd = await getTokenPrice(toolParam.trim(), settings);
                  const priceChange = await trackPrice(toolParam.trim(), pd.price);
                  return { success: true, ...pd, ...(priceChange ? { priceChange } : {}) };
                } catch (e) { return { error: `Price fetch failed: ${e.message}` }; }
              case 'GET_WALLET_BALANCE':
                try {
                  if (!settings.solanaRpc) throw new Error('No Solana RPC configured');
                  return { success: true, ...(await getWalletBalance(toolParam.trim(), settings.solanaRpc)) };
                } catch (e) { return { error: `Wallet fetch failed: ${e.message}` }; }
              case 'DEPLOY_SITE':
                try {
                  const { urchinCurrentProject } = await chrome.storage.local.get('urchinCurrentProject');
                  if (!urchinCurrentProject?.files) return { error: 'No site built yet. Use BUILD_SITE first, then DEPLOY_SITE.' };
                  const deployInfo = await deployToNetlify(urchinCurrentProject, settings);
                  return { success: true, ...deployInfo, message: `Site deployed! Live at ${deployInfo.url}` };
                } catch (e) { return { error: `Deploy failed: ${e.message}` }; }
              case 'LIST_SITES':
                try {
                  const sites = await listNetlifySites(settings);
                  return sites.length === 0
                    ? { success: true, sites: [], message: 'No Netlify sites found.' }
                    : { success: true, count: sites.length, sites: sites.map((s, i) => ({ number: i + 1, id: s.id, name: s.name, url: s.url, created: new Date(s.created).toLocaleDateString(), updated: new Date(s.updated).toLocaleDateString() })) };
                } catch (e) { return { error: `List sites failed: ${e.message}` }; }
              case 'DELETE_SITE':
                try { if (!toolParam.trim()) throw new Error('No site ID'); await deleteNetlifySite(toolParam.trim(), settings); return { success: true, message: `Site ${toolParam.trim()} deleted.` }; }
                catch (e) { return { error: `Delete failed: ${e.message}` }; }
              case 'MULTI_SCAN':
                try { if (!settings.solanaRpc) throw new Error('No Solana RPC configured'); return await multiTokenScan(toolParam.split(',').map(m => m.trim()).filter(Boolean), settings.solanaRpc); }
                catch (e) { return { error: `Multi-scan failed: ${e.message}` }; }
              case 'FETCH_URL':
                try { const u = toolParam.trim(); const c = await fetchPageContent(u); return { success: true, url: u, contentPreview: c.slice(0, 4000), cryptoData: parsePageForCryptoData(u, c) }; }
                catch (e) { return { error: `Fetch failed: ${e.message}` }; }
              case 'GET_WALLET_HISTORY':
                try { if (!settings.solanaRpc) throw new Error('No Solana RPC configured'); return await getWalletTransactions(toolParam.trim(), settings.solanaRpc); }
                catch (e) { return { error: `Transaction history failed: ${e.message}` }; }
              case 'REMEMBER':
                try { const cl = toolParam.replace(/```json\s*/g, '').replace(/```/g, '').trim(); const md = JSON.parse(cl); const { urchinMemory: mem = {} } = await chrome.storage.local.get('urchinMemory'); mem[md.key] = md.value; await chrome.storage.local.set({ urchinMemory: mem }); return { success: true, message: `Remembered "${md.key}".` }; }
                catch (e) { return { error: `Memory save failed: ${e.message}` }; }
              case 'RECALL':
                try { const k = toolParam.trim(); const { urchinMemory: rm = {} } = await chrome.storage.local.get('urchinMemory'); return k === 'all' ? { success: true, memory: rm } : { success: true, key: k, value: rm[k] || 'Nothing saved under this key.' }; }
                catch (e) { return { error: `Memory recall failed: ${e.message}` }; }
              case 'SEARCH_MEMORY':
                try { const { urchinMemory: sm = {} } = await chrome.storage.local.get('urchinMemory'); const { urchinProfile: sp = {} } = await chrome.storage.local.get('urchinProfile'); const combined = { ...sm, ...Object.fromEntries(Object.entries(sp).map(([k, v]) => [`profile_${k}`, v])) }; return { success: true, ...semanticRecall(toolParam.trim(), combined) }; }
                catch (e) { return { error: `Memory search failed: ${e.message}` }; }
              case 'SET_ALERT': {
                try {
                  const alertData = JSON.parse(toolParam.replace(/```json\s*/g, '').replace(/```/g, '').trim());
                  const { urchinWatches = [] } = await chrome.storage.local.get('urchinWatches');
                  const watch = { id: `w-${Date.now()}`, type: alertData.type, target: alertData.target, condition: alertData.condition, created: Date.now() };
                  urchinWatches.push(watch);
                  await chrome.storage.local.set({ urchinWatches });
                  chrome.alarms.create('urchin-watch', { periodInMinutes: 5 });
                  return { success: true, message: `Alert set: ${alertData.type} on ${alertData.target}. You'll get a Chrome notification when triggered.`, watch };
                } catch (e) { return { error: `Alert setup failed: ${e.message}` }; }
              }
              case 'REMIND_ME': {
                try {
                  const reminder = JSON.parse(toolParam.replace(/```json\s*/g, '').replace(/```/g, '').trim());
                  const mins = parseInt(reminder.minutes) || 60;
                  const alarmName = `urchin-remind-${Date.now()}`;
                  const { urchinReminders = [] } = await chrome.storage.local.get('urchinReminders');
                  urchinReminders.push({ id: alarmName, task: reminder.task, triggerAt: Date.now() + mins * 60000 });
                  await chrome.storage.local.set({ urchinReminders });
                  chrome.alarms.create(alarmName, { delayInMinutes: mins });
                  return { success: true, message: `Reminder set for ${mins} minutes from now: "${reminder.task}"` };
                } catch (e) { return { error: `Reminder failed: ${e.message}` }; }
              }
              case 'DEX_DATA':
                try { return { success: true, pairs: await fetchDexScreenerData(toolParam.trim()) }; }
                catch (e) { return { error: `DexScreener fetch failed: ${e.message}` }; }
              case 'SET_TIMER': {
                try {
                  const timerData = JSON.parse(toolParam.replace(/```json\s*/g, '').replace(/```/g, '').trim());
                  const mins = parseInt(timerData.minutes) || 30;
                  const taskId = `urchin-autotask-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                  const { urchinTaskQueue = [] } = await chrome.storage.local.get('urchinTaskQueue');
                  urchinTaskQueue.push({
                    id: taskId, input: timerData.task, status: 'pending',
                    scheduledAt: Date.now() + mins * 60000, createdAt: Date.now(),
                    type: 'timer', autonomous: true
                  });
                  await chrome.storage.local.set({ urchinTaskQueue });
                  chrome.alarms.create(taskId, { delayInMinutes: mins });
                  return { success: true, message: `Autonomous task scheduled for ${mins} minutes from now: "${timerData.task}". I'll run it through the full agent loop and deliver results.`, taskId };
                } catch (e) { return { error: `Timer setup failed: ${e.message}` }; }
              }
              case 'SCHEDULE_TASK': {
                try {
                  const schedData = JSON.parse(toolParam.replace(/```json\s*/g, '').replace(/```/g, '').trim());
                  const delayMins = parseInt(schedData.delayMinutes) || 0;
                  const taskId = `urchin-autotask-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                  const { urchinTaskQueue = [] } = await chrome.storage.local.get('urchinTaskQueue');
                  urchinTaskQueue.push({
                    id: taskId, input: schedData.task, status: 'pending',
                    scheduledAt: Date.now() + delayMins * 60000, createdAt: Date.now(),
                    type: delayMins === 0 ? 'immediate' : 'scheduled', autonomous: true
                  });
                  await chrome.storage.local.set({ urchinTaskQueue });
                  if (delayMins === 0) {
                    chrome.alarms.create(taskId, { delayInMinutes: 0.1 });
                  } else {
                    chrome.alarms.create(taskId, { delayInMinutes: delayMins });
                  }
                  return { success: true, message: delayMins === 0
                    ? `Background task queued for immediate execution: "${schedData.task}"`
                    : `Background task scheduled for ${delayMins} minutes: "${schedData.task}"`, taskId };
                } catch (e) { return { error: `Task scheduling failed: ${e.message}` }; }
              }
              case 'CONTINUE': {
                return { success: true, continueLoop: true, reason: toolParam.trim() || 'Continuing analysis...' };
              }
              case 'MONITOR': {
                try {
                  const monData = JSON.parse(toolParam.replace(/```json\s*/g, '').replace(/```/g, '').trim());
                  if (!monData.target) return { error: 'MONITOR needs a "target" (mint address, wallet, or keyword).' };
                  const interval = Math.max(5, parseInt(monData.interval) || 15);
                  const stopAfter = parseInt(monData.stopAfter) || 360;
                  const monId = `urchin-monitor-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
                  const { urchinMonitors = [] } = await chrome.storage.local.get('urchinMonitors');
                  const monitor = {
                    id: monId, target: monData.target, type: monData.type || 'token',
                    interval, instructions: monData.instructions || `Check ${monData.target} for changes`,
                    createdAt: Date.now(), expiresAt: Date.now() + stopAfter * 60000,
                    checkCount: 0, lastCheckAt: null, status: 'active'
                  };
                  urchinMonitors.push(monitor);
                  await chrome.storage.local.set({ urchinMonitors });
                  chrome.alarms.create(monId, { periodInMinutes: interval });
                  const stopTime = stopAfter >= 60 ? `${(stopAfter / 60).toFixed(1)} hours` : `${stopAfter} minutes`;
                  return { success: true, message: `Monitoring started: "${monData.target}" every ${interval} minutes. Auto-stops in ${stopTime}. I'll run a full analysis each check and notify you of any changes.`, monitorId: monId };
                } catch (e) { return { error: `Monitor setup failed: ${e.message}` }; }
              }
              case 'LIST_MONITORS': {
                try {
                  const { urchinMonitors = [] } = await chrome.storage.local.get('urchinMonitors');
                  const active = urchinMonitors.filter(m => m.status === 'active' && m.expiresAt > Date.now());
                  if (active.length === 0) return { success: true, monitors: [], message: 'No active monitors.' };
                  return { success: true, count: active.length, monitors: active.map(m => ({
                    id: m.id, target: m.target, type: m.type, interval: m.interval,
                    instructions: m.instructions, checksRun: m.checkCount,
                    lastCheck: m.lastCheckAt ? new Date(m.lastCheckAt).toLocaleTimeString() : 'never',
                    timeRemaining: `${Math.round((m.expiresAt - Date.now()) / 60000)} minutes`
                  })) };
                } catch (e) { return { error: `List monitors failed: ${e.message}` }; }
              }
              case 'STOP_MONITOR': {
                try {
                  const query = toolParam.trim().toLowerCase();
                  const { urchinMonitors = [] } = await chrome.storage.local.get('urchinMonitors');
                  const idx = urchinMonitors.findIndex(m =>
                    m.id.toLowerCase() === query ||
                    m.target.toLowerCase().includes(query) ||
                    query.includes(m.target.toLowerCase().slice(0, 8))
                  );
                  if (idx === -1) return { error: `No active monitor found matching "${toolParam.trim()}". Use LIST_MONITORS to see active monitors.` };
                  const stopped = urchinMonitors[idx];
                  chrome.alarms.clear(stopped.id);
                  stopped.status = 'stopped';
                  stopped.stoppedAt = Date.now();
                  await chrome.storage.local.set({ urchinMonitors });
                  return { success: true, message: `Monitor stopped: "${stopped.target}" (ran ${stopped.checkCount} checks). No more recurring checks.` };
                } catch (e) { return { error: `Stop monitor failed: ${e.message}` }; }
              }
              case 'LEARN_SKILL': {
                try {
                  const skillData = JSON.parse(toolParam.replace(/```json\s*/g, '').replace(/```/g, '').trim());
                  if (!skillData.name || !skillData.instruction) return { error: 'Skill needs both "name" and "instruction" fields.' };
                  const { urchinSkills = [] } = await chrome.storage.local.get('urchinSkills');
                  const existing = urchinSkills.findIndex(s => s.name === skillData.name);
                  if (existing !== -1) {
                    urchinSkills[existing].instruction = skillData.instruction;
                    urchinSkills[existing].updatedAt = Date.now();
                  } else {
                    urchinSkills.push({
                      id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                      name: skillData.name, instruction: skillData.instruction,
                      learnedAt: Date.now(), usageCount: 0
                    });
                  }
                  if (urchinSkills.length > 50) urchinSkills.shift();
                  await chrome.storage.local.set({ urchinSkills });
                  return { success: true, message: `Skill "${skillData.name}" ${existing !== -1 ? 'updated' : 'learned'}. I'll apply it in all future conversations.`, totalSkills: urchinSkills.length };
                } catch (e) { return { error: `Skill learning failed: ${e.message}` }; }
              }
              case 'LIST_SKILLS': {
                try {
                  const { urchinSkills = [] } = await chrome.storage.local.get('urchinSkills');
                  if (urchinSkills.length === 0) return { success: true, skills: [], message: 'No skills learned yet.' };
                  return { success: true, count: urchinSkills.length, skills: urchinSkills.map(s => ({ name: s.name, instruction: s.instruction, learnedAt: new Date(s.learnedAt).toLocaleDateString(), usageCount: s.usageCount || 0 })) };
                } catch (e) { return { error: `Skill list failed: ${e.message}` }; }
              }
              case 'FORGET_SKILL': {
                try {
                  const name = toolParam.trim();
                  const { urchinSkills = [] } = await chrome.storage.local.get('urchinSkills');
                  const idx = urchinSkills.findIndex(s => s.name === name);
                  if (idx === -1) return { error: `No skill named "${name}" found.` };
                  urchinSkills.splice(idx, 1);
                  await chrome.storage.local.set({ urchinSkills });
                  return { success: true, message: `Skill "${name}" forgotten. ${urchinSkills.length} skills remaining.` };
                } catch (e) { return { error: `Skill forget failed: ${e.message}` }; }
              }
              default:
                return { error: `Unknown tool: ${toolName}` };
              }
            } catch (e) {
              return { error: e.message };
            }
          };

          // Execute tools — parallel if multiple, sequential if single
          let toolResults;
          if (toolJobs.length > 1) {
            toolResults = await Promise.all(toolJobs.map(j => executeToolJob(j)));
          } else {
            toolResults = [await executeToolJob(toolJobs[0])];
          }

          messages.push({ role: 'assistant', content: cleanedRaw });

          let combinedResults = '';
          let hasError = false;
          let shouldContinue = false;
          for (let ti = 0; ti < toolJobs.length; ti++) {
            const { toolName } = toolJobs[ti];
            const tr = toolResults[ti];
            addStep('tool_result', { tool: toolName, preview: JSON.stringify(tr).slice(0, 200) });
            if (tr && tr.continueLoop) {
              shouldContinue = true;
              combinedResults += `[CONTINUE]: Extending reasoning — ${tr.reason}\n`;
            } else {
              const summarized = summarizeToolResult(toolName, tr);
              combinedResults += `[Tool result for ${toolName}]: ${summarized}\n`;
            }
            if (tr && tr.error) hasError = true;
          }

          if (shouldContinue && maxSteps - step <= 2) {
            maxSteps = Math.min(maxSteps + 6, 24);
            addStep('continue_extend', { newMaxSteps: maxSteps, reason: 'CONTINUE tool used' });
          }

          if (hasError) {
            combinedResults += '\n[HINT: One or more tools failed. Try a different approach, use a different tool, or rephrase the query.]';
          }

          messages.push({ role: 'user', content: combinedResults.trim() });
          broadcastProgress({ phase: 'tool_done', tools: toolJobs.map(j => j.toolName) });
          continue;
        }

        finalAnswer = cleanedRaw.trim() || raw.trim();
        broadcastProgress({ phase: 'done', answer: finalAnswer });
        break;
      } catch (e) {
        addStep('agent_error', { error: e.message });
        log.endTime = Date.now();
        await saveLog(log);
        return { requestId, success: false, error: e.message, log };
      }
    }

    result = { answer: finalAnswer || 'No response from agent.', actions: [] };

    // ──── POST-RESPONSE: Memory management (fire-and-forget, non-blocking) ────
    const memMessages = [...messages];
    const memHistory = log._history || [];
    const memSettings = { ...settings };
    setTimeout(async () => {
      try {
        const { urchinMemory = {} } = await chrome.storage.local.get('urchinMemory');
        const convCount = parseInt(urchinMemory._convCount || '0') + 1;
        urchinMemory._convCount = String(convCount);

        // A) Session summary — every 3rd conversation
        if (convCount % 3 === 0 && memMessages.length >= 3) {
          try {
            const summaryMessages = [...memMessages.slice(-10), { role: 'user', content:
              'Summarize this conversation in 3-5 bullet points. Extract: wallet addresses, token names/symbols/mints, websites built, user preferences, key decisions. Be specific — include actual values.'
            }];
            const summary = await callLLMChat('You are a memory system. Output ONLY the bullet-point summary.', summaryMessages, memSettings);
            urchinMemory[`session_${Date.now()}`] = summary.slice(0, 1500);
            const sessionKeys = Object.keys(urchinMemory).filter(k => k.startsWith('session_')).sort();
            if (sessionKeys.length > 20) {
              for (const old of sessionKeys.slice(0, sessionKeys.length - 20)) delete urchinMemory[old];
            }
          } catch (_) {}
        }
        await chrome.storage.local.set({ urchinMemory });

        // B) User profile — every 5th conversation
        if (convCount % 5 === 0 && memMessages.length >= 3) {
          try {
            const { urchinProfile = {} } = await chrome.storage.local.get('urchinProfile');
            const currentProfile = Object.entries(urchinProfile).map(([k, v]) => `${k}: ${v}`).join('\n') || '(empty)';
            const profileMessages = [{ role: 'user', content:
              `Current profile:\n${currentProfile}\n\nRecent conversation:\n` +
              memMessages.slice(-6).map(m => `${m.role}: ${(m.content || '').slice(0, 300)}`).join('\n') +
              '\n\nExtract NEW user info (name, wallets, tokens, preferences, projects). Return ONLY valid JSON. If nothing new, return {}.'
            }];
            const profileRaw = await callLLMChat('Output ONLY a JSON object.', profileMessages, memSettings);
            const cleaned = profileRaw.replace(/```json\s*/g, '').replace(/```/g, '').trim();
            const newProfile = JSON.parse(cleaned);
            if (Object.keys(newProfile).length > 0) {
              await chrome.storage.local.set({ urchinProfile: { ...urchinProfile, ...newProfile } });
            }
          } catch (_) {}
        }

        // C) Smart condensation — LLM-based compression of old history
        if (memHistory.length > 40) {
          const oldMessages = memHistory.slice(0, memHistory.length - 30);
          const { urchinCondensed = '' } = await chrome.storage.local.get('urchinCondensed');
          try {
            const oldText = oldMessages.map(h => `[${h.role}] ${h.text.slice(0, 300)}`).join('\n');
            const condensePrompt = `Existing condensed history:\n${urchinCondensed || '(none)'}\n\nNew messages to condense:\n${oldText}\n\nCompress ALL of this into a dense narrative summary (max 2000 chars). Preserve: wallet addresses, token names/mints, user preferences, key facts, decisions, URLs built/deployed. Drop greetings and filler.`;
            const condensed = await callLLMChat('You are a memory compressor. Output ONLY the compressed narrative.', [{ role: 'user', content: condensePrompt }], memSettings);
            await chrome.storage.local.set({ urchinCondensed: condensed.slice(0, 4000) });
          } catch (_) {
            const oldText = oldMessages.map(h => `[${h.role}] ${h.text.slice(0, 200)}`).join('\n');
            const newCondensed = (urchinCondensed ? urchinCondensed + '\n---\n' : '') + oldText;
            await chrome.storage.local.set({ urchinCondensed: newCondensed.slice(-4000) });
          }
        }

        // D) Auto-skill learning — every 7th conversation, analyze for learnable patterns
        if (convCount % 7 === 0 && memMessages.length >= 4) {
          try {
            const { urchinSkills = [] } = await chrome.storage.local.get('urchinSkills');
            const existingSkillNames = urchinSkills.map(s => s.name).join(', ') || '(none)';
            const recentConvo = memMessages.slice(-8).map(m => `${m.role}: ${(m.content || '').slice(0, 400)}`).join('\n');
            const skillPrompt = `You are analyzing a conversation for learnable behavioral patterns. Extract NEW actionable skills the agent should learn to serve this user better.\n\nExisting skills: ${existingSkillNames}\n\nRecent conversation:\n${recentConvo}\n\nOutput ONLY valid JSON array of new skills to learn. Each skill: {"name":"kebab-case-name","instruction":"specific actionable instruction"}.\nRules:\n- Only genuinely useful, specific skills (not generic advice)\n- Don't duplicate existing skills\n- Skills should be behavioral instructions, not facts\n- Examples: {"name":"dark-mode-preference","instruction":"Always build websites with dark mode as default"}\n- If nothing worth learning, return []\n- Max 2 new skills per analysis`;
            const skillRaw = await callLLMChat('Output ONLY a JSON array.', [{ role: 'user', content: skillPrompt }], memSettings);
            const cleaned = skillRaw.replace(/```json\s*/g, '').replace(/```/g, '').trim();
            const newSkills = JSON.parse(cleaned);
            if (Array.isArray(newSkills) && newSkills.length > 0) {
              for (const ns of newSkills.slice(0, 2)) {
                if (ns.name && ns.instruction && !urchinSkills.some(s => s.name === ns.name)) {
                  urchinSkills.push({
                    id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                    name: ns.name, instruction: ns.instruction,
                    learnedAt: Date.now(), usageCount: 0, source: 'auto'
                  });
                }
              }
              if (urchinSkills.length > 50) urchinSkills.splice(0, urchinSkills.length - 50);
              await chrome.storage.local.set({ urchinSkills });
            }
          } catch (_) {}
        }
      } catch (_) {}
    }, 100);

  /* ═══ BUILD_SITE: uses the better builder prompt ═══ */
  } else if (task === 'BUILD_SITE') {
    let imgCtx = '';
    if (uploadedFiles && uploadedFiles.length > 0) {
      const imageFiles = uploadedFiles.filter(f => f.type && f.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        imgCtx = '\n\nIMAGES AVAILABLE — use these data URLs as img src attributes in the HTML:\n' +
          imageFiles.map(f => `- ${f.name}: ${f.dataUrl.slice(0, 80)}...`).join('\n');
      }
    }
    const project = await buildSiteViaLLM(userInput + contextStr, imgCtx, settings, addStep, 2, uploadedFiles, true);
    if (!project || !project.files) {
      log.endTime = Date.now();
      await saveLog(log);
      const reason = project?._buildError || 'LLM did not return valid project';
      return { requestId, success: false, error: `Build failed — ${reason}`, log };
    }
    await chrome.storage.local.set({ urchinCurrentProject: project });
    result = project;

  /* ═══ DEPLOY: strict JSON with retries ═══ */
  } else {
    const fullInput = userInput + contextStr;
    let lastError = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      addStep('llm_call', { attempt: attempt + 1 });
      try {
        const prompt = attempt === 0 ? fullInput : `${fullInput}\n\nPrevious attempt had error: ${lastError}\nPlease fix and output valid JSON only.`;
        const raw = await callLLM(systemPrompt, prompt, settings);
        addStep('llm_response', { length: raw.length, preview: raw.slice(0, 200) });
        const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        result = JSON.parse(cleaned);
        addStep('parse_ok', { attempt: attempt + 1 });
        break;
      } catch (e) {
        lastError = e.message;
        addStep('parse_error', { attempt: attempt + 1, error: e.message });
      }
    }
    if (!result) {
      addStep('fail', { message: lastError || 'Failed to get valid JSON' });
      log.endTime = Date.now();
      await saveLog(log);
      return { requestId, success: false, error: lastError || 'LLM did not return valid JSON.', log };
    }
  }

  if (task === 'PUMPFUN_LAUNCH_PACKET' && result.website) {
    const v = tools.validateProjectFiles(result.website);
    addStep('validate_pump_website', v);
  }

  addStep('complete', { task });
  log.endTime = Date.now();
  delete log._pageContext;
  delete log._history;

  await saveLog(log);
  return { requestId, success: true, data: result, log };
}

async function handleSolanaScan(userInput, context, settings, log, addStep, requestId) {
  if (!settings.solanaRpc) {
    addStep('error', { message: 'No Solana RPC URL configured.' });
    return { requestId, success: false, error: 'No Solana RPC URL. Set it in Settings.', log };
  }

  let mint = userInput.trim();
  const mints = tools.detectSolanaMints(userInput);
  if (mints.length > 0) mint = mints[0];
  if (!mint || mint.length < 32) {
    return { requestId, success: false, error: 'No valid Solana mint address found.', log };
  }

  addStep('scan_start', { mint });
  try {
    const scanResult = await tools.solanaScanMint(mint, settings.solanaRpc);
    addStep('scan_complete', { mint });

    let summary = `Token ${mint}: Top1 holds ${scanResult.top1Pct}%, Top5 hold ${scanResult.top5Pct}%, Top10 hold ${scanResult.top10Pct}%. Fresh/empty owner accounts in top10: ${scanResult.freshOwnerCount}.`;

    if (settings.enableSummaries && settings.llmApiKey) {
      try {
        addStep('llm_summary', {});
        const raw = await callLLM(
          'You are a crypto analyst. Summarize this token scan data concisely. Output ONLY JSON: {"summary":"string"}',
          JSON.stringify(scanResult), settings
        );
        const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.summary) summary = parsed.summary;
      } catch (_) { /* keep default summary */ }
    }

    addStep('complete', { task: 'SOLANA_SCAN' });
    log.endTime = Date.now();
    await saveLog(log);
    return { requestId, success: true, data: { ...scanResult, summary }, log };
  } catch (e) {
    addStep('scan_error', { error: e.message });
    return { requestId, success: false, error: `Scan failed: ${e.message}`, log };
  }
}

/* ── Log persistence ── */
async function saveLog(log) {
  try {
    const { urchinLogs = [] } = await chrome.storage.local.get('urchinLogs');
    urchinLogs.push(log);
    while (urchinLogs.length > 50) urchinLogs.shift();
    await chrome.storage.local.set({ urchinLogs });
  } catch (_) {}
}

/* ── Message Handler ── */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'URCHINLOOP_REQUEST') {
    (async () => {
      // Keep service worker alive during long LLM calls
      const keepAlive = setInterval(() => chrome.runtime.getPlatformInfo(), 20000);
      try {
        const settings = await getSettings();
        const result = await urchinLoop(msg.task, msg.input, msg.context || [], settings, msg.pageContext, msg.history, msg.uploadedFiles);
        sendResponse(result);
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      } finally {
        clearInterval(keepAlive);
      }
    })();
    return true;
  }

  if (msg.action === 'LIST_NETLIFY_SITES') {
    (async () => {
      try {
        const settings = await getSettings();
        const sites = await listNetlifySites(settings);
        sendResponse({ success: true, sites });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.action === 'DELETE_NETLIFY_SITE') {
    (async () => {
      try {
        const settings = await getSettings();
        await deleteNetlifySite(msg.siteId, settings);
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.action === 'DEPLOY_NETLIFY') {
    (async () => {
      const keepAlive = setInterval(() => chrome.runtime.getPlatformInfo(), 20000);
      try {
        const settings = await getSettings();
        const result = await deployToNetlify(msg.project, settings);
        sendResponse({ success: true, ...result });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      } finally {
        clearInterval(keepAlive);
      }
    })();
    return true;
  }

  if (msg.action === 'UPDATE_NETLIFY') {
    (async () => {
      const keepAlive = setInterval(() => chrome.runtime.getPlatformInfo(), 20000);
      try {
        const settings = await getSettings();
        const result = await updateNetlifySite(msg.project, msg.siteId, settings);
        sendResponse({ success: true, ...result });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      } finally {
        clearInterval(keepAlive);
      }
    })();
    return true;
  }

  if (msg.action === 'EDIT_SITE_REQUEST') {
    (async () => {
      const keepAlive = setInterval(() => chrome.runtime.getPlatformInfo(), 20000);
      try {
        const settings = await getSettings();
        const { urchinCurrentProject } = await chrome.storage.local.get('urchinCurrentProject');
        if (!urchinCurrentProject || !urchinCurrentProject.files) {
          sendResponse({ success: false, error: 'No site built yet. Build one first.' });
          return;
        }
        const addStep = () => {};
        const edited = await editSiteViaLLM(urchinCurrentProject, msg.changes, settings, addStep);
        if (edited && edited.files) {
          await chrome.storage.local.set({ urchinCurrentProject: edited });
          sendResponse({ success: true, data: edited });
        } else {
          sendResponse({ success: false, error: 'Edit failed — LLM did not return valid project.' });
        }
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      } finally {
        clearInterval(keepAlive);
      }
    })();
    return true;
  }

  if (msg.action === 'GRAB_PAGE_IMAGES') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) { sendResponse({ success: false, error: 'No active tab' }); return; }
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const imgs = document.querySelectorAll('img[src]');
            const seen = new Set();
            const list = [];
            for (const img of imgs) {
              const src = img.src;
              if (!src || seen.has(src) || src.startsWith('data:') || src.includes('spacer') || src.includes('pixel')) continue;
              if (img.naturalWidth < 32 || img.naturalHeight < 32) continue;
              seen.add(src);
              list.push({ src, alt: img.alt || '', w: img.naturalWidth, h: img.naturalHeight });
              if (list.length >= 30) break;
            }
            return list;
          }
        });
        const images = results?.[0]?.result || [];
        sendResponse({ success: true, images });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.action === 'CAPTURE_SCREENSHOT') {
    (async () => {
      try {
        const dataUrl = await captureScreenshot();
        sendResponse({ success: true, dataUrl });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.action === 'ZIP_PROJECT') {
    (async () => {
      try {
        const ab = await tools.zipProject(msg.project);
        const arr = Array.from(new Uint8Array(ab));
        sendResponse({ success: true, data: arr, name: (msg.project.projectName || 'project') + '.zip' });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.action === 'GET_SETTINGS') {
    getSettings().then(s => sendResponse(s));
    return true;
  }

  if (msg.action === 'GET_LOGS') {
    chrome.storage.local.get('urchinLogs').then(r => sendResponse(r.urchinLogs || []));
    return true;
  }

  if (msg.action === 'EXPORT_CHAT') {
    (async () => {
      try {
        const { urchinChatHistory = [] } = await chrome.storage.local.get('urchinChatHistory');
        let md = `# urchinbot Chat Export\n_Exported: ${new Date().toLocaleString()}_\n\n---\n\n`;
        for (const m of urchinChatHistory) {
          const ts = m.ts ? new Date(m.ts).toLocaleString() : '';
          const role = m.role === 'user' ? '**You**' : '**urchinbot**';
          md += `### ${role}${ts ? ' — ' + ts : ''}\n\n${m.text}\n\n---\n\n`;
        }
        sendResponse({ success: true, markdown: md, count: urchinChatHistory.length });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  // ──── Scheduled watch: set/list/clear price & wallet alerts ────
  if (msg.action === 'SET_WATCH') {
    (async () => {
      try {
        const { urchinWatches = [] } = await chrome.storage.local.get('urchinWatches');
        const watch = { id: `w-${Date.now()}`, type: msg.watchType, target: msg.target, condition: msg.condition, created: Date.now() };
        urchinWatches.push(watch);
        await chrome.storage.local.set({ urchinWatches });
        chrome.alarms.create('urchin-watch', { periodInMinutes: 5 });
        sendResponse({ success: true, watch });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.action === 'LIST_WATCHES') {
    chrome.storage.local.get('urchinWatches').then(r => sendResponse({ success: true, watches: r.urchinWatches || [] }));
    return true;
  }

  if (msg.action === 'CLEAR_WATCHES') {
    (async () => {
      await chrome.storage.local.set({ urchinWatches: [] });
      chrome.alarms.clear('urchin-watch');
      sendResponse({ success: true });
    })();
    return true;
  }

  if (msg.action === 'GET_LAUNCH_DATA') {
    chrome.storage.local.get('urchinLaunchData').then(r => sendResponse(r.urchinLaunchData || null));
    return true;
  }

  if (msg.action === 'SAVE_LAUNCH_DATA') {
    chrome.storage.local.set({ urchinLaunchData: msg.data }).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.action === 'AUTOFILL_PUMP') {
    (async () => {
      try {
        const data = msg.data;

        // Get image bytes — from data URL (uploaded) or remote URL
        let imageBytes = null;
        let imageMime = 'image/png';
        if (data.imageDataUrl && data.imageDataUrl.startsWith('data:')) {
          try {
            const [header, b64] = data.imageDataUrl.split(',');
            imageMime = (header.match(/data:([^;]+)/) || [])[1] || 'image/png';
            const binary = atob(b64);
            imageBytes = Array.from({ length: binary.length }, (_, i) => binary.charCodeAt(i));
          } catch (_) { /* data URL parse failed */ }
        } else if (data.imageUrl && !data.imageUrl.startsWith('data:')) {
          try {
            const imgResp = await fetch(data.imageUrl);
            if (imgResp.ok) {
              imageMime = imgResp.headers.get('content-type') || 'image/png';
              const ab = await imgResp.arrayBuffer();
              imageBytes = Array.from(new Uint8Array(ab));
            }
          } catch (_) { /* image fetch failed, skip */ }
        }

        const tab = await chrome.tabs.create({ url: 'https://pump.fun/create', active: true });
        const waitForLoad = (tabId) => new Promise(resolve => {
          const listener = (id, info) => {
            if (id === tabId && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
          setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 10000);
        });
        await waitForLoad(tab.id);
        await new Promise(r => setTimeout(r, 2000));

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (name, symbol, desc, imgBytes, imgMime) => {
            function fillInput(el, value) {
              if (!el) return;
              const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
              const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
              if (setter) setter.call(el, value); else el.value = value;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }

            const inputs = document.querySelectorAll('input[type="text"], input:not([type]), textarea');
            const all = [...inputs].filter(e => e.type !== 'hidden' && e.type !== 'file');
            const nameEl = all.find(e => /name/i.test(e.placeholder || e.getAttribute('aria-label') || '')) || all[0];
            const symEl = all.find(e => /ticker|symbol/i.test(e.placeholder || e.getAttribute('aria-label') || '')) || all[1];
            const descEl = all.find(e => e.tagName === 'TEXTAREA') || all.find(e => /desc/i.test(e.placeholder || e.getAttribute('aria-label') || '')) || all[2];
            fillInput(nameEl, name || '');
            fillInput(symEl, symbol || '');
            fillInput(descEl, desc || '');

            // Auto-upload image
            if (imgBytes && imgBytes.length > 0) {
              try {
                const ext = (imgMime || '').match(/jpe?g/) ? 'jpg' : (imgMime || '').includes('gif') ? 'gif' : 'png';
                const blob = new Blob([new Uint8Array(imgBytes)], { type: imgMime || 'image/png' });
                const file = new File([blob], `token-image.${ext}`, { type: imgMime || 'image/png', lastModified: Date.now() });
                const dt = new DataTransfer();
                dt.items.add(file);

                // Try setting on <input type="file"> directly
                const fileInput = document.querySelector('input[type="file"]');
                if (fileInput) {
                  fileInput.files = dt.files;
                  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                  fileInput.dispatchEvent(new Event('input', { bubbles: true }));
                }

                // Also try drag-and-drop on upload zones
                const zones = document.querySelectorAll(
                  '[class*="dropzone"], [class*="upload"], [class*="drag"], [class*="image"], label[for], [class*="file"]'
                );
                for (const zone of zones) {
                  zone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: dt }));
                  zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
                  zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
                }
              } catch (_) { /* image upload best-effort */ }
            }
          },
          args: [
            data.name || data.tokenName || '',
            data.symbol || data.tokenSymbol || '',
            data.description || '',
            imageBytes,
            imageMime
          ]
        });
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.action === 'OPEN_OVERLAY') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) { sendResponse({ ok: false }); return; }

        let reached = false;
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_OVERLAY', tab: msg.tab });
          reached = true;
        } catch (_) {}

        if (!reached) {
          try { await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['styles.css'] }); } catch (_) {}
          try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }); } catch (_) {}
          await new Promise(r => setTimeout(r, 300));
          try { await chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_OVERLAY', tab: msg.tab }); } catch (_) {}
        }
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.action === 'OPEN_SIDE_PANEL') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && chrome.sidePanel) {
          await chrome.sidePanel.open({ windowId: tab.windowId });
        }
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.action === 'GET_TASK_QUEUE') {
    (async () => {
      try {
        const { urchinTaskQueue = [] } = await chrome.storage.local.get('urchinTaskQueue');
        const { urchinAutoResults = [] } = await chrome.storage.local.get('urchinAutoResults');
        sendResponse({ success: true, queue: urchinTaskQueue, results: urchinAutoResults });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.action === 'CLEAR_TASK_QUEUE') {
    (async () => {
      try {
        const { urchinTaskQueue = [] } = await chrome.storage.local.get('urchinTaskQueue');
        for (const t of urchinTaskQueue) {
          if (t.status === 'pending') chrome.alarms.clear(t.id);
        }
        await chrome.storage.local.set({ urchinTaskQueue: [], urchinAutoResults: [] });
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  if (msg.action === 'ACK_AUTO_RESULT') {
    (async () => {
      try {
        const { urchinAutoResults = [] } = await chrome.storage.local.get('urchinAutoResults');
        const remaining = urchinAutoResults.filter(r => r.id !== msg.taskId);
        await chrome.storage.local.set({ urchinAutoResults: remaining });
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  // Fallback — unknown action, respond immediately to prevent port closure warning
  return false;
});

/* ── Autonomous Task Runner — executes queued tasks through urchinLoop ── */
async function runAutonomousTask(taskInput, taskId) {
  const keepAlive = setInterval(() => chrome.runtime.getPlatformInfo(), 20000);
  try {
    const settings = await getSettings();
    if (!settings.llmApiKey) return { success: false, error: 'No LLM API key configured' };

    const { urchinChatHistory = [] } = await chrome.storage.local.get('urchinChatHistory');

    const result = await urchinLoop(
      'ASK',
      `[AUTONOMOUS BACKGROUND TASK] ${taskInput}\n\nYou are running autonomously in the background — the user is NOT waiting for a response. Execute this task fully, use any tools needed, and produce a comprehensive result. If this task warrants scheduling follow-ups, use SET_TIMER or SCHEDULE_TASK.`,
      [],
      settings,
      null,
      urchinChatHistory.slice(-10),
      null
    );

    const answer = result?.success && result?.data?.answer
      ? result.data.answer
      : (result?.error || 'Autonomous task produced no result.');

    await pushAutonomousResult(taskId, taskInput, answer);
    return { success: true, answer };
  } catch (e) {
    await pushAutonomousResult(taskId, taskInput, `Task failed: ${e.message}`);
    return { success: false, error: e.message };
  } finally {
    clearInterval(keepAlive);
  }
}

async function pushAutonomousResult(taskId, taskInput, answer) {
  chrome.notifications.create(`urchin-auto-${Date.now()}`, {
    type: 'basic', iconUrl: 'icons/icon128.png',
    title: 'urchinbot — Background Task Complete',
    message: answer.slice(0, 200)
  });

  const { urchinAutoResults = [] } = await chrome.storage.local.get('urchinAutoResults');
  urchinAutoResults.push({ id: taskId, input: taskInput, answer, completedAt: Date.now() });
  while (urchinAutoResults.length > 30) urchinAutoResults.shift();
  await chrome.storage.local.set({ urchinAutoResults });

  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try {
        chrome.tabs.sendMessage(tab.id, {
          action: 'URCHIN_AUTONOMOUS_RESULT',
          taskId, input: taskInput, answer, completedAt: Date.now()
        });
      } catch (_) {}
    }
  } catch (_) {}
}

/* ── Scheduled Watches + Autonomous Task Alarms ── */
chrome.alarms.onAlarm.addListener(async (alarm) => {

  // ── Autonomous task alarms (SET_TIMER / SCHEDULE_TASK) ──
  if (alarm.name.startsWith('urchin-autotask-')) {
    try {
      const { urchinTaskQueue = [] } = await chrome.storage.local.get('urchinTaskQueue');
      const task = urchinTaskQueue.find(t => t.id === alarm.name);
      if (task && task.status === 'pending') {
        task.status = 'running';
        task.startedAt = Date.now();
        await chrome.storage.local.set({ urchinTaskQueue });

        const result = await runAutonomousTask(task.input, task.id);

        const { urchinTaskQueue: q2 = [] } = await chrome.storage.local.get('urchinTaskQueue');
        const idx = q2.findIndex(t => t.id === task.id);
        if (idx !== -1) {
          q2[idx].status = result.success ? 'done' : 'failed';
          q2[idx].completedAt = Date.now();
          q2[idx].result = result.success ? result.answer?.slice(0, 2000) : result.error;
          while (q2.length > 50) q2.shift();
          await chrome.storage.local.set({ urchinTaskQueue: q2 });
        }
      }
    } catch (_) {}
    return;
  }

  // ── Recurring monitor alarms (MONITOR tool) ──
  if (alarm.name.startsWith('urchin-monitor-')) {
    try {
      const { urchinMonitors = [] } = await chrome.storage.local.get('urchinMonitors');
      const monitor = urchinMonitors.find(m => m.id === alarm.name);
      if (monitor && monitor.status === 'active') {
        if (Date.now() >= monitor.expiresAt) {
          chrome.alarms.clear(monitor.id);
          monitor.status = 'expired';
          monitor.stoppedAt = Date.now();
          await chrome.storage.local.set({ urchinMonitors });
          chrome.notifications.create(`urchin-mon-expire-${Date.now()}`, {
            type: 'basic', iconUrl: 'icons/icon128.png',
            title: 'urchinbot Monitor Expired',
            message: `Monitor for "${monitor.target}" has expired after ${monitor.checkCount} checks. Say "monitor ${monitor.target}" to restart.`
          });
          await pushAutonomousResult(monitor.id, `Monitor expired: ${monitor.target}`,
            `Monitor for **${monitor.target}** has expired after ${monitor.checkCount} checks over ${Math.round((monitor.expiresAt - monitor.createdAt) / 60000)} minutes. Say "monitor ${monitor.target}" if you want to restart it.`);
          return;
        }

        monitor.checkCount++;
        monitor.lastCheckAt = Date.now();
        await chrome.storage.local.set({ urchinMonitors });

        const checksLeft = Math.ceil((monitor.expiresAt - Date.now()) / (monitor.interval * 60000));
        const taskInput = `${monitor.instructions}\n\nTarget: ${monitor.target}\nThis is check #${monitor.checkCount} (recurring every ${monitor.interval} min, ~${checksLeft} checks remaining).\nCompare with any previous results. Highlight what CHANGED since last check. If nothing significant changed, keep it brief.`;

        await runAutonomousTask(taskInput, `${monitor.id}-check-${monitor.checkCount}`);
      }
    } catch (_) {}
    return;
  }

  // ── Reminder alarms — now run through urchinLoop for intelligent execution ──
  if (alarm.name.startsWith('urchin-remind-')) {
    try {
      const { urchinReminders = [] } = await chrome.storage.local.get('urchinReminders');
      const reminder = urchinReminders.find(r => r.id === alarm.name);
      if (reminder) {
        const remaining = urchinReminders.filter(r => r.id !== alarm.name);
        await chrome.storage.local.set({ urchinReminders: remaining });

        await runAutonomousTask(reminder.task, alarm.name);
      }
    } catch (_) {}
    return;
  }

  // ── Price/wallet watch alarms ──
  if (alarm.name !== 'urchin-watch') return;
  try {
    const { urchinWatches = [] } = await chrome.storage.local.get('urchinWatches');
    if (urchinWatches.length === 0) { chrome.alarms.clear('urchin-watch'); return; }
    const settings = await getSettings();
    const triggered = [];

    for (const w of urchinWatches) {
      try {
        if (w.type === 'price') {
          const priceData = await getTokenPrice(w.target, settings);
          if (priceData.price) {
            const price = parseFloat(priceData.price);
            if (w.condition.below && price < w.condition.below) {
              triggered.push({ watch: w, message: `${priceData.symbol || w.target} dropped to $${price} (below $${w.condition.below})` });
            }
            if (w.condition.above && price > w.condition.above) {
              triggered.push({ watch: w, message: `${priceData.symbol || w.target} rose to $${price} (above $${w.condition.above})` });
            }
          }
        } else if (w.type === 'wallet') {
          if (!settings.solanaRpc) continue;
          const balance = await getWalletBalance(w.target, settings.solanaRpc);
          if (w.condition.solBelow && balance.solBalance < w.condition.solBelow) {
            triggered.push({ watch: w, message: `Wallet ${w.target.slice(0, 8)}… SOL dropped to ${balance.solBalance.toFixed(4)}` });
          }
        }
      } catch (_) {}
    }

    if (triggered.length > 0) {
      for (const t of triggered) {
        chrome.notifications.create(`urchin-alert-${Date.now()}`, {
          type: 'basic', iconUrl: 'icons/icon128.png',
          title: 'urchinbot Alert', message: t.message
        });
      }
      const remaining = urchinWatches.filter(w => !triggered.some(t => t.watch.id === w.id));
      await chrome.storage.local.set({ urchinWatches: remaining });
      if (remaining.length === 0) chrome.alarms.clear('urchin-watch');
    }
  } catch (_) {}
});

/* ── Briefing handler ── */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'GET_BRIEFING') {
    (async () => {
      try {
        const settings = await getSettings();
        const briefing = await generateBriefing(settings);
        sendResponse({ success: true, briefing });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }
});

/* content.js — urchinbot floating overlay (Shadow DOM isolated) */
(async function urchinbotContentScript() {
  'use strict';

  /* ── Duplicate-injection guard ── */
  if (document.querySelector('urchinbot-overlay')) return;

  /* ── Site Gating — always visible on all tabs ── */
  const host = location.hostname;
  const isTwitter = host === 'x.com' || host === 'twitter.com' || host.endsWith('.x.com') || host.endsWith('.twitter.com');
  let startHidden = false;

  /* ── State ── */
  let contextArray = [];
  let activeTab = 'ask';
  let overlayVisible = !startHidden;
  let panelPos = { x: -1, y: -1 };
  let mascotPos = { x: -1, y: -1 };
  let buildProject = null;
  let deployResult = null;
  let chatHistory = [];
  let uploadedFiles = [];
  let lastAskResponse = '';
  let lastShownBubbleText = '';
  let panelOpen = overlayVisible;
  let companionMode = false;
  let sidePanelOpen = false;
  let autoBadge = null;
  let bubbleDismissed = false;

  /* ── Restore persisted state ── */
  try {
    const saved = await chrome.storage.local.get(['urchinOverlayState', 'urchinChatHistory', 'companionMode']);
    if (saved.urchinOverlayState) {
      const s = saved.urchinOverlayState;
      if (s.activeTab) activeTab = s.activeTab;
      if (typeof s.visible === 'boolean' && !startHidden) overlayVisible = s.visible;
      if (s.pos) {
        if (typeof s.pos.x === 'number') { panelPos = s.pos; }
        else if (typeof s.pos.right === 'number') {
          panelPos.x = window.innerWidth - s.pos.right - 400;
          panelPos.y = window.innerHeight - s.pos.bottom - 540;
        }
      }
      if (s.mascotPos && typeof s.mascotPos.x === 'number') {
        mascotPos = s.mascotPos;
      }
    }
    if (Array.isArray(saved.urchinChatHistory)) chatHistory = saved.urchinChatHistory;
    if (typeof saved.companionMode === 'boolean') companionMode = saved.companionMode;
  } catch {}

  function saveChatHistory() {
    while (chatHistory.length > 200) chatHistory.shift();
    try { chrome.storage.local.set({ urchinChatHistory: chatHistory }); } catch {}
  }

  /* ── Live setting sync (companion mode toggle) ── */
  try {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.companionMode) {
        companionMode = !!changes.companionMode.newValue;
        applyCompanionVisibility();
      }
    });
  } catch {}

  /* ── Page context capture (smart extraction) ── */
  function capturePageContext() {
    const ctx = { url: location.href, title: document.title };
    try { ctx.selection = (window.getSelection() || '').toString().slice(0, 1000); } catch {}

    if (isTwitter) {
      const tweets = [];
      document.querySelectorAll('[data-testid="tweetText"]').forEach(t => {
        if (t.offsetParent !== null) tweets.push(t.textContent.trim());
      });
      ctx.tweets = tweets.slice(0, 10).join('\n---\n');
      ctx.visibleText = ctx.tweets;
    } else if (/dexscreener\.com/i.test(location.href)) {
      try {
        const text = document.body.innerText || '';
        ctx.visibleText = text.slice(0, 5000);
        const pairs = [];
        document.querySelectorAll('a[href*="/solana/"]').forEach(a => {
          pairs.push(a.textContent.trim().slice(0, 100));
        });
        if (pairs.length) ctx.dexPairs = pairs.slice(0, 5).join(', ');
      } catch {}
    } else if (/birdeye\.so/i.test(location.href)) {
      try {
        ctx.visibleText = (document.body.innerText || '').slice(0, 5000);
      } catch {}
    } else if (/pump\.fun/i.test(location.href)) {
      try {
        ctx.visibleText = (document.body.innerText || '').slice(0, 5000);
        const inputs = document.querySelectorAll('input, textarea');
        const formData = {};
        inputs.forEach(inp => {
          if (inp.value && inp.type !== 'hidden' && inp.type !== 'file') {
            formData[inp.placeholder || inp.name || inp.type] = inp.value.slice(0, 200);
          }
        });
        if (Object.keys(formData).length) ctx.pumpFormData = JSON.stringify(formData);
      } catch {}
    } else if (/solscan\.io/i.test(location.href)) {
      try { ctx.visibleText = (document.body.innerText || '').slice(0, 5000); } catch {}
    } else {
      try { ctx.visibleText = (document.body.innerText || '').slice(0, 4000); } catch {}
    }

    // Extract all visible links with crypto-relevant text
    try {
      const links = [];
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.href;
        const text = a.textContent.trim();
        if (text.length > 2 && text.length < 80 && /solana|sol|token|swap|trade|pump|dex|mint/i.test(text + href)) {
          links.push(`${text} → ${href}`);
        }
      });
      if (links.length) ctx.cryptoLinks = links.slice(0, 8).join('\n');
    } catch {}

    return ctx;
  }

  function saveState() {
    try {
      chrome.storage.local.set({
        urchinOverlayState: { activeTab, visible: overlayVisible, pos: panelPos, mascotPos }
      });
    } catch {}
  }

  /* ── Host element + Shadow DOM ── */
  const host_el = document.createElement('urchinbot-overlay');
  host_el.style.cssText = 'all:initial;position:fixed;z-index:2147483647;pointer-events:none;top:0;left:0;width:0;height:0;';
  document.documentElement.appendChild(host_el);
  const shadow = host_el.attachShadow({ mode: 'open' });

  /* ── Google Fonts ── */
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap';
  shadow.appendChild(fontLink);

  /* ── Styles ── */
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    *,*::before,*::after{margin:0;padding:0;box-sizing:border-box;}

    :host{font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;font-size:13px;font-weight:500;color:#e2e8f0;line-height:1.5;-webkit-font-smoothing:antialiased;}

    .ub-panel{
      position:fixed;
      width:400px;height:540px;
      min-width:320px;min-height:360px;
      resize:both;overflow:hidden;
      border-radius:16px;
      border:1px solid rgba(255,255,255,0.07);
      background:rgba(8,10,20,0.92);
      backdrop-filter:blur(24px) saturate(1.4);-webkit-backdrop-filter:blur(24px) saturate(1.4);
      box-shadow:0 24px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(0,255,213,0.04),0 0 60px -10px rgba(0,255,213,0.06);
      display:flex;flex-direction:column;
      pointer-events:auto;
      animation:ub-fadeIn .3s cubic-bezier(.16,1,.3,1);
      transition:opacity .25s ease,transform .25s ease;
    }
    .ub-panel.ub-hidden{opacity:0;pointer-events:none;transform:translateY(16px) scale(.96);}
    .ub-panel.ub-minimized{height:44px!important;min-height:44px!important;resize:none;border-radius:22px;}
    .ub-panel.ub-minimized .ub-tabs,.ub-panel.ub-minimized .ub-body,.ub-panel.ub-minimized .ub-ctx{display:none;}

    @keyframes ub-fadeIn{from{opacity:0;transform:translateY(16px) scale(.96);}to{opacity:1;transform:none;}}

    /* ── Header ── */
    .ub-header{
      display:flex;align-items:center;
      padding:10px 14px;gap:10px;
      background:linear-gradient(180deg,rgba(255,255,255,0.04) 0%,transparent 100%);
      border-bottom:1px solid rgba(255,255,255,0.05);
      cursor:grab;user-select:none;flex-shrink:0;
    }
    .ub-header:active{cursor:grabbing;}
    .ub-title{
      flex:1;font-size:14px;font-weight:800;letter-spacing:.6px;
      background:linear-gradient(135deg,#00ffd5 0%,#a78bfa 50%,#f472b6 100%);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;
      background-clip:text;
    }
    .ub-hdr-btn{
      width:28px;height:28px;border:none;border-radius:8px;
      background:rgba(255,255,255,0.05);color:#64748b;
      font-size:14px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;
      transition:all .2s ease;
    }
    .ub-hdr-btn:hover{background:rgba(255,255,255,0.1);color:#e2e8f0;transform:scale(1.05);}

    /* ── Tab bar ── */
    .ub-tabs{
      display:flex;gap:3px;padding:6px 10px;flex-shrink:0;
      background:transparent;border-bottom:1px solid rgba(255,255,255,0.04);
      overflow-x:auto;
    }
    .ub-tab{
      padding:6px 12px;border-radius:10px;border:none;
      background:transparent;color:#525d73;font-size:11.5px;font-weight:700;
      cursor:pointer;white-space:nowrap;letter-spacing:.3px;
      transition:all .2s ease;text-transform:uppercase;
    }
    .ub-tab:hover{background:rgba(255,255,255,0.05);color:#cbd5e1;}
    .ub-tab.active{background:rgba(0,255,213,0.1);color:#00ffd5;box-shadow:0 0 12px rgba(0,255,213,0.08);}

    /* ── Body ── */
    .ub-body{flex:1;overflow:hidden;display:flex;flex-direction:column;position:relative;}
    .ub-tp{display:none;flex-direction:column;flex:1;overflow-y:auto;padding:14px;gap:12px;}
    .ub-tp.active{display:flex;}

    /* scrollbar */
    .ub-tp::-webkit-scrollbar{width:4px;}
    .ub-tp::-webkit-scrollbar-track{background:transparent;}
    .ub-tp::-webkit-scrollbar-thumb{background:rgba(0,255,213,0.4);border-radius:4px;}
    .ub-tp::-webkit-scrollbar-thumb:hover{background:rgba(0,255,213,0.6);}

    /* ── Inputs ── */
    textarea,input[type=text]{
      width:100%;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.06);
      background:rgba(255,255,255,0.04);color:#e2e8f0;font-size:13px;font-family:'Inter',system-ui,sans-serif;font-weight:500;
      resize:vertical;outline:none;transition:border-color .2s,background .2s,box-shadow .2s;
    }
    textarea:focus,input[type=text]:focus{border-color:rgba(0,255,213,0.5);background:rgba(255,255,255,0.06);box-shadow:0 0 0 3px rgba(0,255,213,0.06);}
    textarea{min-height:56px;max-height:140px;}
    textarea::placeholder,input[type=text]::placeholder{color:#475569;font-weight:500;}

    /* ── Buttons ── */
    .ub-btn{
      padding:8px 18px;border:none;border-radius:10px;font-size:12.5px;font-weight:700;
      cursor:pointer;letter-spacing:.3px;transition:all .2s ease;
      color:#0a0e1a;font-family:'Inter',system-ui,sans-serif;
    }
    .ub-btn:active{transform:scale(.96);}
    .ub-btn-primary{background:linear-gradient(135deg,#00ffd5 0%,#a78bfa 100%);color:#0a0e1a;}
    .ub-btn-primary:hover{box-shadow:0 0 24px rgba(0,255,213,0.3),0 0 8px rgba(167,139,250,0.2);transform:translateY(-1px);}
    .ub-btn-secondary{background:rgba(255,255,255,0.06);color:#cbd5e1;border:1px solid rgba(255,255,255,0.06);}
    .ub-btn-secondary:hover{background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.1);}
    .ub-btn-small{padding:5px 12px;font-size:11px;border-radius:8px;}
    .ub-btn:disabled{opacity:.35;cursor:not-allowed;transform:none!important;}

    /* ── Response / result areas ── */
    .ub-result{
      padding:12px;border-radius:10px;
      background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);
      font-size:13px;line-height:1.65;white-space:pre-wrap;word-break:break-word;
      color:#f1f5f9;
      animation:ub-slideUp .25s cubic-bezier(.16,1,.3,1);
    }
    @keyframes ub-slideUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}

    .ub-error{color:#fb7185;font-size:12px;padding:6px 0;font-weight:500;}

    /* ── Loading dots ── */
    .ub-loading{display:flex;gap:6px;padding:12px 0;align-items:center;}
    .ub-dot{
      width:6px;height:6px;border-radius:50%;background:#00ffd5;
      animation:ub-bounce 1.4s ease-in-out infinite;
    }
    .ub-dot:nth-child(2){animation-delay:.15s;}
    .ub-dot:nth-child(3){animation-delay:.3s;}
    @keyframes ub-bounce{0%,80%,100%{opacity:.2;transform:scale(.7);}40%{opacity:1;transform:scale(1.1);}}

    /* ── Code / file blocks ── */
    .ub-code{
      background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.05);border-radius:8px;
      padding:10px 12px;font-family:'JetBrains Mono','Cascadia Code','Fira Code',monospace;font-size:11.5px;
      white-space:pre-wrap;word-break:break-all;overflow-x:auto;max-height:200px;overflow-y:auto;
      color:#c9d1d9;
    }
    .ub-file-item{border:1px solid rgba(255,255,255,0.04);border-radius:10px;overflow:hidden;}
    .ub-file-hdr{
      display:flex;align-items:center;justify-content:space-between;
      padding:8px 12px;background:rgba(255,255,255,0.03);cursor:pointer;
      font-size:12px;font-weight:700;color:#7c899b;transition:color .15s;
    }
    .ub-file-hdr:hover{color:#e2e8f0;}
    .ub-file-body{display:none;padding:0;}
    .ub-file-body.open{display:block;}

    /* ── Table (scan) ── */
    table{width:100%;border-collapse:collapse;font-size:11.5px;}
    th{text-align:left;padding:6px 8px;color:#7c899b;font-weight:700;border-bottom:1px solid rgba(255,255,255,0.05);font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;}
    td{padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.025);}
    td a{color:#00ffd5;text-decoration:none;font-weight:600;}
    td a:hover{text-decoration:underline;}

    /* ── Preview iframe ── */
    .ub-iframe{width:100%;height:220px;border:1px solid rgba(255,255,255,0.1);border-radius:6px;background:#fff;}

    /* ── Context drawer ── */
    .ub-ctx{
      flex-shrink:0;border-top:1px solid rgba(255,255,255,0.04);
      background:rgba(255,255,255,0.015);
    }
    .ub-ctx-hdr{
      display:flex;align-items:center;justify-content:space-between;
      padding:7px 12px;cursor:pointer;font-size:11px;font-weight:700;color:#525d73;
      user-select:none;letter-spacing:.3px;transition:color .15s;
    }
    .ub-ctx-hdr:hover{color:#cbd5e1;}
    .ub-ctx-body{display:none;padding:4px 12px 8px;gap:5px;flex-wrap:wrap;max-height:80px;overflow-y:auto;}
    .ub-ctx-body.open{display:flex;}
    .ub-ctx-tag{
      display:inline-flex;align-items:center;gap:4px;
      padding:3px 10px;border-radius:12px;font-size:10.5px;font-weight:600;
      background:rgba(0,255,213,0.06);border:1px solid rgba(0,255,213,0.1);color:#00ffd5;
      max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    }
    .ub-ctx-rm{
      cursor:pointer;opacity:.5;font-size:12px;line-height:1;flex-shrink:0;transition:opacity .15s;
    }
    .ub-ctx-rm:hover{opacity:1;}

    /* ── Log entries ── */
    .ub-log-entry{
      padding:10px;border-radius:8px;background:rgba(255,255,255,0.025);
      border:1px solid rgba(255,255,255,0.035);font-size:11.5px;
    }
    .ub-log-id{color:#00ffd5;font-weight:700;font-family:'JetBrains Mono','Cascadia Code',monospace;font-size:11px;}
    .ub-log-step{padding-left:10px;color:#7c899b;font-size:11px;font-weight:500;}

    /* ── Help ── */
    .ub-help h3{font-size:13px;color:#00ffd5;margin:8px 0 4px;font-weight:800;}
    .ub-help p,.ub-help li{font-size:12px;color:#7c899b;line-height:1.6;font-weight:500;}
    .ub-help ul{padding-left:16px;}
    .ub-help strong{color:#e2e8f0;font-weight:700;}

    /* ── Deploy extras ── */
    .ub-pump-link{
      display:block;text-align:center;padding:12px;border-radius:12px;
      background:linear-gradient(135deg,#00ffd5 0%,#a78bfa 100%);color:#0a0e1a;
      font-weight:800;font-size:14px;text-decoration:none;letter-spacing:.4px;
      transition:all .25s ease;font-family:'Inter',system-ui,sans-serif;
    }
    .ub-pump-link:hover{box-shadow:0 0 32px rgba(0,255,213,0.35),0 0 12px rgba(167,139,250,0.2);transform:translateY(-1px);}
    .ub-disclaimer{font-size:10.5px;color:#475569;padding:8px 0;line-height:1.5;font-style:italic;font-weight:500;}

    .ub-img-preview{max-width:100%;max-height:120px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);}
    .ub-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
    .ub-label{font-size:11px;font-weight:700;color:#7c899b;margin-bottom:3px;letter-spacing:.3px;}
    .ub-val{font-size:12.5px;color:#e2e8f0;font-weight:500;}
    .ub-summary{padding:10px 12px;border-radius:10px;background:rgba(0,255,213,0.04);border-left:3px solid #00ffd5;font-size:12px;color:#e2e8f0;font-weight:500;}

    /* ── Chat thread ── */
    .ub-chat-wrap{display:flex;flex-direction:column;flex:1;overflow:hidden;}
    .ub-chat-thread{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:10px 8px;}
    .ub-chat-thread::-webkit-scrollbar{width:4px;}
    .ub-chat-thread::-webkit-scrollbar-track{background:transparent;}
    .ub-chat-thread::-webkit-scrollbar-thumb{background:rgba(0,255,213,0.4);border-radius:4px;}
    .ub-msg{max-width:85%;padding:10px 14px;border-radius:14px;font-size:13.5px;line-height:1.7;word-break:break-word;animation:ub-slideUp .25s cubic-bezier(.16,1,.3,1);white-space:pre-wrap;font-weight:400;letter-spacing:-0.01em;}
    .ub-msg-user{align-self:flex-end;background:linear-gradient(135deg,rgba(0,255,213,0.12),rgba(167,139,250,0.1));border:1px solid rgba(0,255,213,0.18);color:#ffffff;border-bottom-right-radius:4px;}
    .ub-msg-bot{align-self:flex-start;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07);color:#f1f5f9;border-bottom-left-radius:4px;}
    .ub-msg-tool{align-self:flex-start;max-width:92%;background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.14);color:#c4b5fd;font-size:11px;font-family:'JetBrains Mono','Cascadia Code','Fira Code',monospace;padding:6px 10px;border-radius:10px;}
    .ub-msg-time{font-size:9px;color:#3e4a5e;margin-top:3px;font-weight:600;letter-spacing:.3px;}
    .ub-msg-greeting{align-self:center;color:#525d73;font-size:12.5px;font-weight:500;padding:4px 0 12px;}
    .ub-ask-hero{display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px 12px 6px;animation:ub-fadeIn .4s ease;}
    .ub-ask-hero img{width:48px;height:48px;border-radius:14px;box-shadow:0 4px 20px rgba(0,255,213,0.15),0 0 0 1px rgba(0,255,213,0.08);}
    .ub-ask-hero-name{font-size:16px;font-weight:800;letter-spacing:.4px;background:linear-gradient(135deg,#00ffd5 0%,#a78bfa 50%,#f472b6 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
    .ub-ask-hero-sub{font-size:11.5px;color:#525d73;font-weight:500;text-align:center;line-height:1.5;max-width:260px;}
    .ub-chat-input-row{display:flex;gap:6px;padding:8px 0 0;flex-shrink:0;align-items:flex-end;}
    .ub-chat-input-row textarea{flex:1;min-height:38px;max-height:80px;font-size:13px;padding:9px 12px;}
    .ub-chat-actions{display:flex;gap:5px;padding:4px 0 0;flex-shrink:0;flex-wrap:wrap;}
    .ub-ctx-pill{font-size:10px;color:#00ffd5;background:rgba(0,255,213,0.06);border:1px solid rgba(0,255,213,0.12);border-radius:8px;padding:3px 8px;font-weight:600;}
    .ub-btn-cf{background:linear-gradient(135deg,#00c7b7,#20c6b0);color:#0a0e1a;font-weight:700;}
    .ub-btn-cf:hover{box-shadow:0 0 20px rgba(0,199,183,0.4),0 0 6px rgba(0,199,183,0.2);}
    .ub-deploy-url{display:block;padding:8px 10px;border-radius:8px;background:rgba(0,255,213,0.08);border:1px solid rgba(0,255,213,0.15);font-size:12.5px;word-break:break-all;}
    .ub-deploy-url a{color:#00ffd5;text-decoration:none;font-weight:600;}
    .ub-deploy-url a:hover{text-decoration:underline;}
    .ub-upload-btn{background:none;border:1px solid rgba(255,255,255,0.08);color:#64748b;font-size:18px;width:38px;height:38px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s ease;}
    .ub-upload-btn:hover{background:rgba(255,255,255,0.06);color:#e2e8f0;border-color:rgba(0,255,213,0.3);transform:scale(1.04);}
    .ub-files-strip{display:flex;gap:4px;flex-wrap:wrap;padding:2px 0;}
    .ub-file-chip{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:8px;background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.15);font-size:10.5px;color:#c4b5fd;max-width:150px;font-weight:600;}
    .ub-file-chip img{width:18px;height:18px;border-radius:3px;object-fit:cover;}
    .ub-file-chip .ub-fc-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;}
    .ub-file-chip .ub-fc-rm{cursor:pointer;color:#ff4d6a;font-weight:700;font-size:12px;margin-left:2px;}
    .ub-file-chip .ub-fc-rm:hover{color:#ff8fa3;}
    .ub-progress{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:12px;background:rgba(0,255,213,0.05);border:1px solid rgba(0,255,213,0.1);margin:4px 0;animation:ub-pulse 1.5s ease-in-out infinite;}
    @keyframes ub-pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
    .ub-progress-dot{width:8px;height:8px;border-radius:50%;background:#00ffd5;animation:ub-pulse 1s ease-in-out infinite;}
    .ub-progress-text{color:#94a3b8;font-size:12px;}
    .ub-img-picker{display:flex;flex-wrap:wrap;gap:6px;padding:6px 0;max-height:180px;overflow-y:auto;}
    .ub-img-pick{width:60px;height:60px;border-radius:8px;object-fit:cover;cursor:pointer;border:2px solid transparent;transition:all .15s;opacity:0.8;}
    .ub-img-pick:hover{opacity:1;border-color:rgba(0,255,213,0.5);transform:scale(1.05);}
    .ub-img-pick.selected{border-color:#00ffd5;opacity:1;box-shadow:0 0 10px rgba(0,255,213,0.3);}

    /* ── Quick action buttons ── */
    .ub-quick-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;animation:ub-slideUp .25s cubic-bezier(.16,1,.3,1);}
    .ub-quick-btn{padding:5px 12px;border-radius:20px;border:1px solid rgba(0,255,213,0.15);background:rgba(0,255,213,0.04);color:#00ffd5;font-size:10.5px;font-weight:700;cursor:pointer;transition:all .2s ease;white-space:nowrap;font-family:'Inter',system-ui,sans-serif;}
    .ub-quick-btn:hover{background:rgba(0,255,213,0.12);border-color:rgba(0,255,213,0.35);transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,255,213,0.1);}

    /* ── Streaming cursor ── */
    .ub-stream-cursor{display:inline-block;width:2px;height:14px;background:#00ffd5;animation:ub-blink .6s infinite;vertical-align:text-bottom;margin-left:2px;}
    @keyframes ub-blink{0%,100%{opacity:1;}50%{opacity:0;}}

    /* ── Markdown in bot messages ── */
    .ub-msg-bot strong{color:#00ffd5;font-weight:700;}
    .ub-msg-bot em{color:#d4bfff;font-style:italic;}
    .ub-msg-bot a{color:#00ffd5;text-decoration:underline;}
    .ub-msg-bot a:hover{color:#fff;}

    /* ── Mascot avatar (floating urchin.png) ── */
    .ub-mascot{
      position:fixed;
      width:64px;height:64px;
      cursor:grab;pointer-events:auto;
      transition:transform .2s ease,filter .2s ease;
      animation:ub-mascotBob 3s ease-in-out infinite;
      z-index:10;
      user-select:none;
      -webkit-user-drag:none;
    }
    .ub-speech{z-index:5;}
    .ub-reply-wrap{z-index:6;}
    .ub-chat-btn{z-index:8;}
    .ub-mascot:hover{transform:scale(1.1);filter:drop-shadow(0 0 12px rgba(0,255,213,0.4));}
    .ub-mascot.ub-mascot-dragging{animation:none!important;cursor:grabbing!important;transition:none!important;transform:scale(1.05)!important;filter:drop-shadow(0 0 16px rgba(0,255,213,0.5))!important;}
    @keyframes ub-mascotBob{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}

    /* ── Autonomous task badge ── */
    .ub-auto-badge{
      position:absolute;top:-4px;right:-4px;
      min-width:18px;height:18px;
      background:linear-gradient(135deg,#ff6b6b,#ee5a24);
      color:#fff;font-size:10px;font-weight:700;
      border-radius:9px;display:flex;align-items:center;justify-content:center;
      padding:0 5px;
      box-shadow:0 2px 8px rgba(255,107,107,0.4);
      animation:ub-badgePop .3s cubic-bezier(.34,1.56,.64,1);
      z-index:10;pointer-events:none;
    }
    @keyframes ub-badgePop{from{transform:scale(0);}to{transform:scale(1);}}

    /* ── Autonomous result separator in chat ── */
    .ub-auto-separator{
      display:flex;align-items:center;gap:8px;
      padding:6px 0;margin:8px 0;
    }
    .ub-auto-separator::before,.ub-auto-separator::after{
      content:'';flex:1;height:1px;
      background:linear-gradient(90deg,transparent,rgba(167,139,250,0.3),transparent);
    }
    .ub-auto-label{
      font-size:10px;font-weight:600;color:#a78bfa;
      letter-spacing:.5px;text-transform:uppercase;white-space:nowrap;
    }

    /* ── Hover chat button ── */
    .ub-chat-btn{
      position:fixed;
      width:28px;height:28px;border-radius:50%;border:none;
      background:linear-gradient(135deg,#00ffd5,#a78bfa);
      color:#0a0e1a;font-size:13px;cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      opacity:0;transform:scale(0.5);
      transition:opacity .2s ease,transform .2s cubic-bezier(.34,1.56,.64,1);
      pointer-events:none;
      box-shadow:0 4px 16px rgba(0,255,213,0.3);
    }
    .ub-chat-btn.ub-chat-btn-visible{
      opacity:1;transform:scale(1);pointer-events:auto;
    }
    .ub-chat-btn:hover{transform:scale(1.15);box-shadow:0 4px 20px rgba(0,255,213,0.45);}
    .ub-chat-btn:active{transform:scale(.9);}

    /* ── Speech bubble ── */
    .ub-speech{
      position:fixed;
      width:280px;
      max-height:180px;
      padding:10px 28px 10px 14px;
      background:rgba(12,15,28,0.97);
      backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
      border:1px solid rgba(0,255,213,0.12);
      border-radius:6px;
      color:#e2e8f0;font-size:13.5px;line-height:1.7;font-weight:400;letter-spacing:-0.01em;
      font-family:'Inter',system-ui,sans-serif;
      pointer-events:auto;cursor:pointer;
      animation:ub-speechPop .3s cubic-bezier(.34,1.56,.64,1);
      box-shadow:0 6px 24px rgba(0,0,0,0.5),0 0 12px -4px rgba(0,255,213,0.06);
      word-break:break-word;
      overflow-y:auto;overflow-x:hidden;
      transition:border-color .2s;
    }
    .ub-speech:hover{border-color:rgba(0,255,213,0.22);}
    .ub-speech::-webkit-scrollbar{width:3px;}
    .ub-speech::-webkit-scrollbar-thumb{background:rgba(0,255,213,0.25);border-radius:3px;}
    .ub-speech.ub-speech-hidden{display:none!important;}
    @keyframes ub-speechPop{from{opacity:0;transform:scale(.7) translateY(10px);}to{opacity:1;transform:none;}}
    .ub-speech-close{
      position:absolute;top:6px;right:8px;
      background:rgba(255,255,255,0.06);border:none;color:#64748b;
      font-size:13px;cursor:pointer;width:20px;height:20px;
      border-radius:50%;display:flex;align-items:center;justify-content:center;
      line-height:1;padding:0;transition:all .15s;
    }
    .ub-speech-close:hover{color:#e2e8f0;background:rgba(255,255,255,0.12);}
    .ub-speech-tail{
      position:absolute;
      width:0;height:0;
    }
    .ub-speech-tail.tail-bottom{
      bottom:-8px;left:18px;
      border-left:8px solid transparent;
      border-right:8px solid transparent;
      border-top:8px solid rgba(12,15,28,0.96);
      filter:drop-shadow(0 1px 0 rgba(0,255,213,0.12));
    }
    .ub-speech-tail.tail-top{
      top:-8px;left:18px;
      border-left:8px solid transparent;
      border-right:8px solid transparent;
      border-bottom:8px solid rgba(12,15,28,0.96);
      filter:drop-shadow(0 -1px 0 rgba(0,255,213,0.12));
    }
    .ub-speech-cursor{
      display:inline-block;width:2px;height:13px;
      background:#00ffd5;vertical-align:text-bottom;margin-left:1px;
      animation:ub-blink .5s step-end infinite;
    }
    @keyframes ub-blink{0%,100%{opacity:1;}50%{opacity:0;}}

    /* ── Companion reply bubble ── */
    .ub-reply-wrap{
      position:fixed;pointer-events:auto;
      display:flex;gap:6px;align-items:flex-end;
      padding:8px 10px 8px 12px;
      background:rgba(12,15,28,0.97);
      backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
      border:1px solid rgba(0,255,213,0.12);
      border-radius:6px;
      box-shadow:0 8px 32px rgba(0,0,0,0.55),0 0 20px -4px rgba(0,255,213,0.08);
      animation:ub-speechPop .25s cubic-bezier(.34,1.56,.64,1);
    }
    .ub-reply-wrap.ub-reply-hidden{display:none!important;}
    .ub-reply-input{
      width:200px;min-height:20px;max-height:60px;
      padding:4px 0;border:none;
      background:transparent;
      color:#e2e8f0;font-size:13.5px;line-height:1.7;letter-spacing:-0.01em;
      font-family:'Inter',system-ui,sans-serif;font-weight:400;
      outline:none;resize:none;
    }
    .ub-reply-input::placeholder{color:#475569;}
    .ub-reply-send{
      width:26px;height:26px;border-radius:50%;border:none;
      background:linear-gradient(135deg,#00ffd5,#a78bfa);
      color:#0a0e1a;font-size:12px;cursor:pointer;
      display:flex;align-items:center;justify-content:center;flex-shrink:0;
      transition:all .15s;opacity:0.85;
    }
    .ub-reply-send:hover{transform:scale(1.1);opacity:1;}
    .ub-reply-send:active{transform:scale(.9);}
    .ub-reply-tail{
      position:absolute;width:0;height:0;
      border-left:7px solid transparent;
      border-right:7px solid transparent;
    }
    .ub-reply-tail.tail-bottom{
      bottom:-7px;left:16px;
      border-top:7px solid rgba(12,15,28,0.97);
      filter:drop-shadow(0 1px 0 rgba(0,255,213,0.12));
    }
    .ub-reply-tail.tail-top{
      top:-7px;left:16px;
      border-bottom:7px solid rgba(12,15,28,0.97);
      filter:drop-shadow(0 -1px 0 rgba(0,255,213,0.12));
    }
    .ub-reply-send:disabled{opacity:.4;cursor:not-allowed;transform:none!important;}
  `;
  shadow.appendChild(styleEl);

  /* ── Build DOM ── */
  const panel = el('div', 'ub-panel');
  if (!overlayVisible) panel.classList.add('ub-hidden');

  /* Header */
  const header = el('div', 'ub-header');
  const hdrLogo = document.createElement('img');
  hdrLogo.src = chrome.runtime.getURL('urchin.png');
  hdrLogo.style.cssText = 'width:22px;height:22px;border-radius:6px;flex-shrink:0;';
  hdrLogo.draggable = false;
  const title = el('span', 'ub-title');
  title.textContent = 'urchinbot';
  header.appendChild(hdrLogo);
  const btnMin = el('button', 'ub-hdr-btn');
  btnMin.textContent = '\u2212';
  btnMin.title = 'Minimize';
  const btnClose = el('button', 'ub-hdr-btn');
  btnClose.textContent = '\u00D7';
  btnClose.title = 'Close';
  header.append(title, btnMin, btnClose);

  /* minimize/close wired below after mascot creation */

  /* Tabs */
  const TABS = ['ask', 'build', 'deploy', 'scan', 'log', 'help'];
  const TAB_LABELS = { ask: 'Ask', build: 'Build', deploy: 'Deploy', scan: 'Scan', log: 'Log', help: 'Help' };
  const tabBar = el('div', 'ub-tabs');
  const tabBtns = {};
  const tabPanels = {};

  for (const t of TABS) {
    const btn = el('button', 'ub-tab');
    btn.textContent = TAB_LABELS[t];
    btn.dataset.tab = t;
    if (t === activeTab) btn.classList.add('active');
    btn.addEventListener('click', () => switchTab(t));
    tabBar.appendChild(btn);
    tabBtns[t] = btn;
  }

  function switchTab(t) {
    activeTab = t;
    for (const k of TABS) {
      tabBtns[k].classList.toggle('active', k === t);
      tabPanels[k].classList.toggle('active', k === t);
    }
    saveState();
    if (t === 'log') refreshLogs();
  }

  /* Body */
  const body = el('div', 'ub-body');
  for (const t of TABS) {
    const tp = el('div', 'ub-tp');
    tp.dataset.tab = t;
    if (t === activeTab) tp.classList.add('active');
    tabPanels[t] = tp;
    body.appendChild(tp);
  }

  /* Context drawer */
  const ctxDrawer = el('div', 'ub-ctx');
  const ctxHdr = el('div', 'ub-ctx-hdr');
  const ctxLabel = el('span');
  ctxLabel.textContent = 'Context (0)';
  const ctxArrow = el('span');
  ctxArrow.textContent = '\u25B6';
  ctxHdr.append(ctxLabel, ctxArrow);
  const ctxBody = el('div', 'ub-ctx-body');
  ctxHdr.addEventListener('click', () => {
    const open = ctxBody.classList.toggle('open');
    ctxArrow.textContent = open ? '\u25BC' : '\u25B6';
  });
  ctxDrawer.append(ctxHdr, ctxBody);

  panel.append(header, tabBar, body, ctxDrawer);
  shadow.appendChild(panel);

  /* ── Mascot (floating urchin.png) ── */
  const mascot = document.createElement('img');
  mascot.src = chrome.runtime.getURL('urchin.png');
  mascot.className = 'ub-mascot';
  mascot.draggable = false;
  mascot.alt = 'urchinbot';
  shadow.appendChild(mascot);

  /* ── Hover chat button (appears on mascot hover) ── */
  const chatBtn = document.createElement('button');
  chatBtn.className = 'ub-chat-btn';
  chatBtn.textContent = '\uD83D\uDCAC';
  chatBtn.title = 'Quick chat';
  shadow.appendChild(chatBtn);

  let chatBtnHideTimer = null;
  function showChatBtn() {
    if (panelOpen || sidePanelOpen || !companionMode) return;
    clearTimeout(chatBtnHideTimer);
    const bx = mascotPos.x - 30;
    const by = mascotPos.y + 18;
    chatBtn.style.left = Math.max(4, bx) + 'px';
    chatBtn.style.top = Math.max(4, by) + 'px';
    chatBtn.classList.add('ub-chat-btn-visible');
  }
  function hideChatBtn() {
    chatBtnHideTimer = setTimeout(() => {
      chatBtn.classList.remove('ub-chat-btn-visible');
    }, 300);
  }

  mascot.addEventListener('mouseenter', showChatBtn);
  mascot.addEventListener('mouseleave', hideChatBtn);
  chatBtn.addEventListener('mouseenter', () => { clearTimeout(chatBtnHideTimer); });
  chatBtn.addEventListener('mouseleave', hideChatBtn);
  chatBtn.addEventListener('click', e => {
    e.stopPropagation();
    chatBtn.classList.remove('ub-chat-btn-visible');
    if (replyOpen) {
      closeReply();
    } else {
      openReply();
    }
  });

  /* ── Speech bubble ── */
  const speech = document.createElement('div');
  speech.className = 'ub-speech ub-speech-hidden';
  const speechClose = document.createElement('button');
  speechClose.className = 'ub-speech-close';
  speechClose.textContent = '\u00D7';
  speechClose.addEventListener('click', e => {
    e.stopPropagation();
    speech.classList.add('ub-speech-hidden');
    cancelTypewriter();
    replyOpen = false;
    replyWrap.classList.add('ub-reply-hidden');
    bubbleDismissed = true;
  });
  const speechText = document.createElement('div');
  const speechTail = document.createElement('div');
  speechTail.className = 'ub-speech-tail tail-bottom';
  speech.append(speechClose, speechText, speechTail);
  shadow.appendChild(speech);

  /* ── Companion reply bubble ── */
  const replyWrap = document.createElement('div');
  replyWrap.className = 'ub-reply-wrap ub-reply-hidden';
  const replyInput = document.createElement('textarea');
  replyInput.className = 'ub-reply-input';
  replyInput.placeholder = 'Ask urchinbot...';
  replyInput.rows = 1;
  const replySend = document.createElement('button');
  replySend.className = 'ub-reply-send';
  replySend.textContent = '\u2191';
  const replyTail = document.createElement('div');
  replyTail.className = 'ub-reply-tail';
  replyWrap.append(replyInput, replySend, replyTail);
  shadow.appendChild(replyWrap);

  let replyOpen = false;
  function toggleReply() {
    replyOpen = !replyOpen;
    replyWrap.classList.toggle('ub-reply-hidden', !replyOpen);
    if (replyOpen) {
      positionReplyBox();
      replyInput.style.height = 'auto';
      setTimeout(() => { replyInput.focus(); }, 80);
    }
  }

  function openReply() {
    if (replyOpen || sidePanelOpen) return;
    replyOpen = true;
    replyWrap.classList.remove('ub-reply-hidden');
    positionReplyBox();
    replyInput.style.height = 'auto';
    setTimeout(() => { replyInput.focus(); }, 80);
  }

  function closeReply() {
    replyOpen = false;
    replyWrap.classList.add('ub-reply-hidden');
  }

  function positionReplyBox() {
    const isAbove = mascotPos.y > 200;
    const sx = Math.max(4, Math.min(mascotPos.x - 10, window.innerWidth - 280));
    if (isAbove) {
      replyWrap.style.top = 'auto';
      replyWrap.style.bottom = (window.innerHeight - mascotPos.y + 12) + 'px';
    } else {
      replyWrap.style.top = (mascotPos.y + 72) + 'px';
      replyWrap.style.bottom = 'auto';
    }
    replyWrap.style.left = sx + 'px';
    replyWrap.style.right = 'auto';
    replyTail.className = 'ub-reply-tail ' + (isAbove ? 'tail-bottom' : 'tail-top');
    const tailX = Math.max(10, Math.min(mascotPos.x + 20 - sx, 180));
    replyTail.style.left = tailX + 'px';
  }

  speech.addEventListener('click', e => {
    if (e.target === speechClose || e.target.closest('.ub-speech-close')) return;
    e.stopPropagation();
    if (replyOpen) closeReply();
    else openReply();
  });

  replyWrap.addEventListener('mousedown', e => e.stopPropagation());
  replyWrap.addEventListener('click', e => e.stopPropagation());
  replyWrap.addEventListener('keydown', e => e.stopPropagation());
  replyWrap.addEventListener('keyup', e => e.stopPropagation());
  replyWrap.addEventListener('input', e => e.stopPropagation());

  async function companionSend() {
    const text = replyInput.value.trim();
    if (!text) return;
    replyInput.value = '';
    replyInput.style.height = 'auto';
    replySend.disabled = true;
    closeReply();
    cancelTypewriter();

    speechText.innerHTML = '<span style="color:#00ffd5;font-weight:500">Thinking</span><span class="ub-speech-cursor" style="margin-left:3px"></span>';
    speech.classList.remove('ub-speech-hidden');
    bubbleDismissed = false;
    lastShownBubbleText = '';
    applyMascotPosition();

    const pageCtx = capturePageContext();
    let ctxSnippet = '';
    if (pageCtx.visibleText) ctxSnippet = `[Page: ${(pageCtx.title || '').slice(0, 60)} — ${pageCtx.visibleText.slice(0, 400)}]`;
    const historyText = ctxSnippet ? `${ctxSnippet}\n${text}` : text;
    chatHistory.push({ role: 'user', text: historyText, ts: Date.now() });
    saveChatHistory();

    try {
      const resp = await sendMsg({
        action: 'URCHINLOOP_REQUEST',
        task: 'ASK',
        input: text,
        context: contextArray,
        pageContext: pageCtx,
        history: chatHistory.slice(0, -1),
        uploadedFiles: []
      });

      replySend.disabled = false;

      if (resp && resp.success && resp.data) {
        const answer = resp.data.answer || JSON.stringify(resp.data);
        chatHistory.push({ role: 'assistant', text: answer, ts: Date.now() });
        saveChatHistory();
        lastAskResponse = answer;
        showSpeechBubble(answer, true);
      } else {
        const errText = (resp && resp.error) || 'Request failed.';
        showSpeechBubble(errText, true);
      }
    } catch (e) {
      replySend.disabled = false;
      showSpeechBubble('Something went wrong. Try again.', true);
    }
  }

  replySend.addEventListener('click', companionSend);
  replyInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); companionSend(); }
  });
  replyInput.addEventListener('input', () => { replyInput.style.height = 'auto'; replyInput.style.height = Math.min(replyInput.scrollHeight, 64) + 'px'; });

  let typewriterTimer = null;
  function cancelTypewriter() {
    if (typewriterTimer) { clearTimeout(typewriterTimer); typewriterTimer = null; }
  }

  function showSpeechBubble(text, force) {
    if (!text || sidePanelOpen) return;
    const clean = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, '');
    if (!force && clean === lastShownBubbleText && bubbleDismissed) return;
    cancelTypewriter();
    lastShownBubbleText = clean;
    bubbleDismissed = false;

    const isAbove = mascotPos.y > 200;
    speechTail.className = 'ub-speech-tail ' + (isAbove ? 'tail-bottom' : 'tail-top');

    speechText.textContent = '';
    speech.classList.remove('ub-speech-hidden');
    void speech.offsetWidth;
    speech.style.animation = 'none';
    void speech.offsetWidth;
    speech.style.animation = '';
    applyMascotPosition();

    const cursor = document.createElement('span');
    cursor.className = 'ub-speech-cursor';
    speechText.appendChild(cursor);

    let i = 0;
    const speed = Math.max(6, Math.min(20, 2000 / clean.length));
    function typeNext() {
      if (i < clean.length) {
        cursor.remove();
        speechText.appendChild(document.createTextNode(clean[i]));
        speechText.appendChild(cursor);
        i++;
        speech.scrollTop = speech.scrollHeight;
        typewriterTimer = setTimeout(typeNext, speed);
      } else {
        cursor.remove();
        typewriterTimer = null;
        applyMascotPosition();
      }
    }
    typewriterTimer = setTimeout(typeNext, 80);
  }

  /* ── Position ── */
  if (panelPos.x < 0 || panelPos.y < 0) {
    panelPos.x = window.innerWidth - 420;
    panelPos.y = window.innerHeight - 560;
  }
  if (mascotPos.x < 0 || mascotPos.y < 0) {
    mascotPos.x = window.innerWidth - 80;
    mascotPos.y = window.innerHeight - 80;
  }

  function clampPanel() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pw = panel.offsetWidth || 400;
    const ph = panel.offsetHeight || 540;
    panelPos.x = Math.max(0, Math.min(panelPos.x, w - pw));
    panelPos.y = Math.max(0, Math.min(panelPos.y, h - ph));
  }

  function clampMascot() {
    mascotPos.x = Math.max(-20, Math.min(mascotPos.x, window.innerWidth - 44));
    mascotPos.y = Math.max(-20, Math.min(mascotPos.y, window.innerHeight - 44));
  }

  clampPanel();
  clampMascot();
  applyPosition();

  function applyPosition() {
    clampPanel();
    panel.style.left = panelPos.x + 'px';
    panel.style.top = panelPos.y + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }

  function applyMascotPosition() {
    clampMascot();
    mascot.style.left = mascotPos.x + 'px';
    mascot.style.top = mascotPos.y + 'px';
    mascot.style.right = 'auto';
    mascot.style.bottom = 'auto';

    const bubbleW = 280;
    const mascotCenter = mascotPos.x + 32;
    let sx = mascotCenter - bubbleW / 2;
    sx = Math.max(6, Math.min(sx, window.innerWidth - bubbleW - 6));

    const isAbove = mascotPos.y > 200;

    speech.style.left = sx + 'px';
    speech.style.right = 'auto';

    if (isAbove) {
      speech.style.top = 'auto';
      speech.style.bottom = (window.innerHeight - mascotPos.y + 12) + 'px';
    } else {
      speech.style.top = (mascotPos.y + 72) + 'px';
      speech.style.bottom = 'auto';
    }

    const tailX = Math.max(10, Math.min(mascotCenter - sx, bubbleW - 24));
    speechTail.style.left = tailX + 'px';

    if (replyOpen) positionReplyBox();
    if (chatBtn.classList.contains('ub-chat-btn-visible')) {
      chatBtn.style.left = Math.max(4, mascotPos.x - 30) + 'px';
      chatBtn.style.top = (mascotPos.y + 18) + 'px';
    }
  }
  applyMascotPosition();

  window.addEventListener('resize', () => { clampPanel(); clampMascot(); applyPosition(); applyMascotPosition(); });

  function showPanel() {
    panelOpen = true;
    overlayVisible = true;
    speech.classList.add('ub-speech-hidden');
    cancelTypewriter();
    replyOpen = false;
    replyWrap.classList.add('ub-reply-hidden');
    chatBtn.classList.remove('ub-chat-btn-visible');
    if (autoBadge) { autoBadge.style.display = 'none'; autoBadge.textContent = '0'; }
    if (mascot.style.display !== 'none') {
      mascot.style.transition = 'opacity .15s ease';
      mascot.style.opacity = '0';
      setTimeout(() => {
        mascot.style.display = 'none';
        mascot.style.opacity = '1';
      }, 150);
    }
    if (askRefreshThread) askRefreshThread();
    clampPanel();
    applyPosition();
    panel.classList.remove('ub-hidden');
    panel.classList.remove('ub-minimized');
    saveState();
  }

  function revealCompanion() {
    if (!companionMode) return;
    closeReply();
    speech.classList.add('ub-speech-hidden');
    mascot.style.opacity = '0';
    mascot.style.display = 'block';
    requestAnimationFrame(() => {
      mascot.style.transition = 'opacity .25s ease';
      mascot.style.opacity = '1';
    });
    if (lastAskResponse && !bubbleDismissed) {
      setTimeout(() => showSpeechBubble(lastAskResponse), 250);
    }
  }

  function hidePanel() {
    panelOpen = false;
    overlayVisible = false;
    panel.classList.add('ub-hidden');
    closeReply();
    chatBtn.classList.remove('ub-chat-btn-visible');
    if (companionMode) {
      setTimeout(revealCompanion, 200);
    } else {
      mascot.style.display = 'none';
      speech.classList.add('ub-speech-hidden');
    }
    saveState();
  }

  function minimizePanel() {
    panelOpen = false;
    panel.classList.add('ub-hidden');
    closeReply();
    chatBtn.classList.remove('ub-chat-btn-visible');
    if (companionMode) {
      setTimeout(revealCompanion, 200);
    } else {
      mascot.style.display = 'none';
      speech.classList.add('ub-speech-hidden');
    }
    saveState();
  }

  function applyCompanionVisibility() {
    if (panelOpen || sidePanelOpen) {
      mascot.style.display = 'none';
      speech.classList.add('ub-speech-hidden');
    } else if (companionMode) {
      mascot.style.display = 'block';
    } else {
      mascot.style.display = 'none';
      speech.classList.add('ub-speech-hidden');
    }
  }

  if (panelOpen || sidePanelOpen) {
    mascot.style.display = 'none';
  } else if (companionMode) {
    mascot.style.display = 'block';
    panel.classList.add('ub-hidden');
  } else {
    mascot.style.display = 'none';
    panel.classList.add('ub-hidden');
  }

  mascot.addEventListener('click', e => {
    if (mascotDragMoved) return;
    e.stopPropagation();
    closeReply();
    showPanel();
  });

  /* ── Dragging state ── */
  let mascotDragging = false, mascotDragMoved = false;
  let dragging = false;
  let dragStartX, dragStartY, dragStartPosX, dragStartPosY;

  header.addEventListener('mousedown', e => {
    if (e.target.closest('.ub-hdr-btn')) return;
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartPosX = panelPos.x;
    dragStartPosY = panelPos.y;
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging && !mascotDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (dragging) {
      panelPos.x = dragStartPosX + dx;
      panelPos.y = dragStartPosY + dy;
      clampPanel();
      applyPosition();
    }
    if (mascotDragging) {
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) mascotDragMoved = true;
      mascotPos.x = dragStartPosX + dx;
      mascotPos.y = dragStartPosY + dy;
      clampMascot();
      applyMascotPosition();
    }
  });

  document.addEventListener('mouseup', () => {
    if (dragging) { dragging = false; saveState(); }
    if (mascotDragging) {
      mascotDragging = false;
      mascot.classList.remove('ub-mascot-dragging');
      saveState();
      setTimeout(() => { mascotDragMoved = false; }, 50);
    }
  });

  /* ── Dragging (mascot) ── */
  mascot.addEventListener('mousedown', e => {
    mascotDragging = true;
    mascotDragMoved = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartPosX = mascotPos.x;
    dragStartPosY = mascotPos.y;
    mascot.classList.add('ub-mascot-dragging');
    e.preventDefault();
    e.stopPropagation();
  });

  /* ── Rewire header buttons ── */
  btnMin.addEventListener('click', minimizePanel);
  btnClose.addEventListener('click', () => hidePanel());

  /* ── Stop propagation so page doesn't intercept overlay clicks ── */
  panel.addEventListener('mousedown', e => e.stopPropagation());
  panel.addEventListener('click', e => e.stopPropagation());
  panel.addEventListener('keydown', e => e.stopPropagation());
  panel.addEventListener('keyup', e => e.stopPropagation());
  panel.addEventListener('input', e => e.stopPropagation());
  speech.addEventListener('mousedown', e => e.stopPropagation());
  speech.addEventListener('click', e => e.stopPropagation());

  /* ── Helpers ── */
  function el(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }
  function loading() {
    const d = el('div', 'ub-loading');
    for (let i = 0; i < 3; i++) d.appendChild(el('div', 'ub-dot'));
    return d;
  }
  function errorMsg(msg) {
    const d = el('div', 'ub-error');
    d.textContent = msg;
    return d;
  }
  function truncAddr(a) { return a ? a.slice(0, 6) + '...' + a.slice(-4) : ''; }

  /* ── Lightweight Markdown renderer ── */
  function renderMarkdown(text) {
    let html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background:rgba(0,255,213,0.1);padding:1px 4px;border-radius:3px;font-family:JetBrains Mono,monospace;font-size:11px;color:#00ffd5;">$1</code>')
      .replace(/^### (.+)$/gm, '<div style="font-size:14px;font-weight:700;color:#00ffd5;margin:8px 0 4px;">$1</div>')
      .replace(/^## (.+)$/gm, '<div style="font-size:15px;font-weight:700;color:#00ffd5;margin:10px 0 4px;">$1</div>')
      .replace(/^# (.+)$/gm, '<div style="font-size:16px;font-weight:700;color:#00ffd5;margin:10px 0 4px;">$1</div>')
      .replace(/^[-•] (.+)$/gm, '<div style="padding-left:12px;">• $1</div>')
      .replace(/^\d+\. (.+)$/gm, (m, p1, offset, str) => `<div style="padding-left:12px;">${m.match(/^\d+/)[0]}. ${p1}</div>`)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" style="color:#00ffd5;text-decoration:underline;">$1</a>')
      .replace(/(https?:\/\/[^\s<"]+)/g, (m) => {
        if (m.includes('</a>') || m.includes('href=')) return m;
        return `<a href="${m}" target="_blank" style="color:#00ffd5;text-decoration:underline;">${m.length > 50 ? m.slice(0, 47) + '…' : m}</a>`;
      })
      .replace(/\n/g, '<br>');

    // Inline token/wallet cards — detect Solana addresses
    html = html.replace(/([1-9A-HJ-NP-Za-km-z]{32,44})/g, (addr) => {
      if (addr.length < 32 || addr.length > 44) return addr;
      return `<span class="ub-addr-card" data-addr="${addr}" style="display:inline-flex;align-items:center;gap:3px;padding:1px 6px;border-radius:4px;background:rgba(0,255,213,0.08);border:1px solid rgba(0,255,213,0.15);cursor:pointer;font-family:JetBrains Mono,monospace;font-size:10.5px;color:#00ffd5;" title="Click to scan: ${addr}">${addr.slice(0, 6)}…${addr.slice(-4)} <span style="font-size:9px;opacity:0.6;">🔍</span></span>`;
    });

    return html;
  }

  function sendMsg(payload) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage(payload, resp => {
        if (chrome.runtime.lastError) resolve({ success: false, error: chrome.runtime.lastError.message });
        else resolve(resp);
      });
    });
  }

  /* ── File upload helpers ── */
  function pickFiles(accept) {
    return new Promise(resolve => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.multiple = true;
      if (accept) inp.accept = accept;
      inp.addEventListener('change', () => {
        const files = Array.from(inp.files || []);
        resolve(files);
      });
      inp.click();
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
  }

  async function handleFileUpload(accept) {
    const files = await pickFiles(accept);
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) continue; // 10MB max
      const dataUrl = await readFileAsDataUrl(f);
      uploadedFiles.push({ name: f.name, type: f.type, dataUrl, size: f.size });
    }
    renderFileStrips();
    return files.length;
  }

  let fileStripContainers = [];
  function renderFileStrips() {
    for (const container of fileStripContainers) {
      container.innerHTML = '';
      uploadedFiles.forEach((f, i) => {
        const chip = el('div', 'ub-file-chip');
        if (f.type.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = f.dataUrl;
          chip.appendChild(img);
        }
        const name = el('span', 'ub-fc-name');
        name.textContent = f.name;
        name.title = `${f.name} (${(f.size / 1024).toFixed(1)}KB)`;
        const rm = el('span', 'ub-fc-rm');
        rm.textContent = '\u00D7';
        rm.addEventListener('click', () => {
          uploadedFiles.splice(i, 1);
          renderFileStrips();
        });
        chip.append(name, rm);
        container.appendChild(chip);
      });
    }
  }

  function getUploadedImageDataUrl() {
    const img = uploadedFiles.find(f => f.type.startsWith('image/'));
    return img ? img.dataUrl : null;
  }

  function getUploadedFilesContext() {
    return uploadedFiles.map(f => {
      if (f.type.startsWith('image/')) {
        return `[Uploaded image: ${f.name} (${(f.size/1024).toFixed(1)}KB)]`;
      }
      return `[Uploaded file: ${f.name} (${f.type}, ${(f.size/1024).toFixed(1)}KB)]`;
    }).join('\n');
  }

  /* ── Context management ── */
  function addContext(item) {
    contextArray.push(item);
    renderContext();
  }
  function removeContext(idx) {
    contextArray.splice(idx, 1);
    renderContext();
  }
  function renderContext() {
    ctxLabel.textContent = `Context (${contextArray.length})`;
    ctxBody.innerHTML = '';
    contextArray.forEach((c, i) => {
      const tag = el('span', 'ub-ctx-tag');
      const lbl = el('span');
      lbl.textContent = `[${c.type}] ${(c.value || c.title || '').slice(0, 30)}`;
      const rm = el('span', 'ub-ctx-rm');
      rm.textContent = '\u00D7';
      rm.addEventListener('click', () => removeContext(i));
      tag.append(lbl, rm);
      ctxBody.appendChild(tag);
    });
  }

  /* ═══════════════════════════════════════════
     TAB PANEL BUILDERS
     ═══════════════════════════════════════════ */

  /* ── Ask Tab (chat thread) ── */
  let askThread, askScrollToBottom, askAddBubble, askRefreshThread;

  (function buildAskTab() {
    const tp = tabPanels.ask;
    tp.style.cssText = 'padding:0;gap:0;';

    const chatWrap = el('div', 'ub-chat-wrap');
    const thread = el('div', 'ub-chat-thread');
    askThread = thread;

    function scrollToBottom() { setTimeout(() => { thread.scrollTop = thread.scrollHeight; }, 30); }
    askScrollToBottom = scrollToBottom;

    function addBubble(role, text, ts) {
      const msg = el('div', `ub-msg ub-msg-${role === 'user' ? 'user' : 'bot'}`);
      if (role === 'user') {
        msg.textContent = text;
      } else {
        msg.innerHTML = renderMarkdown(text);
        msg.querySelectorAll('.ub-addr-card').forEach(card => {
          card.addEventListener('click', () => {
            const addr = card.dataset.addr;
            if (addr) { ta.value = `scan token ${addr}`; handleSend(); }
          });
        });
      }
      thread.appendChild(msg);

      if (role !== 'user') {
        const retryRow = el('div', '');
        retryRow.style.cssText = 'display:flex;gap:4px;align-items:center;margin-top:2px;';
        const retryBtn = el('button', '');
        retryBtn.textContent = '↻ Retry';
        retryBtn.style.cssText = 'background:none;border:1px solid rgba(255,255,255,0.1);color:#64748b;font-size:10px;padding:2px 8px;border-radius:4px;cursor:pointer;transition:all .15s;';
        retryBtn.addEventListener('mouseenter', () => { retryBtn.style.color = '#e2e8f0'; retryBtn.style.borderColor = 'rgba(0,255,213,0.3)'; });
        retryBtn.addEventListener('mouseleave', () => { retryBtn.style.color = '#64748b'; retryBtn.style.borderColor = 'rgba(255,255,255,0.1)'; });
        retryBtn.addEventListener('click', () => {
          const lastUserMsg = [...chatHistory].reverse().find(h => h.role === 'user');
          if (lastUserMsg) {
            msg.remove();
            retryRow.remove();
            chatHistory.pop();
            saveChatHistory();
            const cleanText = lastUserMsg.text.replace(/^\[.*?\]\n?/g, '').trim();
            ta.value = cleanText;
            handleSend();
          }
        });
        retryRow.appendChild(retryBtn);
        thread.appendChild(retryRow);
      }

      if (ts) {
        const time = el('div', 'ub-msg-time');
        time.textContent = new Date(ts).toLocaleTimeString();
        time.style.textAlign = role === 'user' ? 'right' : 'left';
        thread.appendChild(time);
      }
      scrollToBottom();
    }
    askAddBubble = addBubble;

    function buildHero() {
      const hero = el('div', 'ub-ask-hero');
      const img = document.createElement('img');
      img.src = chrome.runtime.getURL('urchin.png');
      img.alt = 'urchinbot';
      const name = el('div', 'ub-ask-hero-name');
      name.textContent = 'urchinbot';
      const sub = el('div', 'ub-ask-hero-sub');
      sub.textContent = 'Search the web, analyze screenshots, check prices, scan wallets, build sites, and more.';
      hero.append(img, name, sub);
      return hero;
    }

    function refreshThread() {
      thread.innerHTML = '';
      if (chatHistory.length === 0) {
        thread.appendChild(buildHero());
      } else {
        for (const h of chatHistory) addBubble(h.role, h.text, h.ts);
      }
    }
    askRefreshThread = refreshThread;

    if (chatHistory.length === 0) {
      thread.appendChild(buildHero());
      (async () => {
        try {
          const resp = await sendMsg({ action: 'GET_BRIEFING' });
          if (resp && resp.success && resp.briefing) {
            const brief = el('div', 'ub-msg ub-msg-bot');
            brief.innerHTML = renderMarkdown(resp.briefing);
            brief.style.borderColor = 'rgba(0,255,213,0.2)';
            brief.style.background = 'rgba(0,255,213,0.04)';
            thread.appendChild(brief);
            scrollToBottom();
          }
        } catch (_) {}
      })();
    } else {
      for (const h of chatHistory) addBubble(h.role, h.text, h.ts);
    }

    // File strip (shows uploaded files)
    const askFileStrip = el('div', 'ub-files-strip');
    askFileStrip.style.padding = '0 10px';
    fileStripContainers.push(askFileStrip);

    // Input row
    const inputRow = el('div', 'ub-chat-input-row');
    inputRow.style.padding = '6px 10px 8px';
    const uploadBtn = el('button', 'ub-upload-btn');
    uploadBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
    uploadBtn.title = 'Upload files or images';
    uploadBtn.addEventListener('click', () => handleFileUpload('image/*,.txt,.html,.css,.js,.json,.md,.csv'));
    const ta = document.createElement('textarea');
    ta.placeholder = 'Ask anything...';
    ta.id = 'ub-ask-input';
    ta.rows = 1;
    const btn = el('button', 'ub-btn ub-btn-primary');
    btn.textContent = 'Ask';
    btn.style.height = '36px';
    inputRow.append(uploadBtn, ta, btn);

    // Action row (clear + context pill)
    const actRow = el('div', 'ub-chat-actions');
    actRow.style.padding = '0 10px 6px';
    const clearBtn = el('button', 'ub-btn ub-btn-secondary ub-btn-small');
    clearBtn.textContent = 'Clear Chat';
    clearBtn.addEventListener('click', () => {
      chatHistory = [];
      saveChatHistory();
      refreshThread();
    });
    const clearMemBtn = el('button', 'ub-btn ub-btn-secondary ub-btn-small');
    clearMemBtn.textContent = '🧠 Memory';
    clearMemBtn.title = 'View or clear agent memory';
    clearMemBtn.addEventListener('click', async () => {
      const existing = thread.querySelector('.ub-memory-panel');
      if (existing) { existing.remove(); return; }
      const memPanel = el('div', 'ub-memory-panel');
      memPanel.style.cssText = 'background:rgba(30,20,50,0.95);border:1px solid rgba(168,85,247,0.3);border-radius:10px;padding:12px;margin:8px 0;font-size:12px;color:#e2e8f0;max-height:300px;overflow-y:auto;';
      let html = '<div style="font-weight:600;color:#a855f7;margin-bottom:8px;">🧠 Agent Memory</div>';
      try {
        const stored = await chrome.storage.local.get(['urchinProfile', 'urchinMemory', 'urchinCondensed']);
        const profile = stored.urchinProfile || {};
        const memory = stored.urchinMemory || {};
        const condensed = stored.urchinCondensed || '';
        if (Object.keys(profile).length > 0) {
          html += '<div style="color:#00ffd5;margin:6px 0 2px;">User Profile:</div>';
          for (const [k, v] of Object.entries(profile)) html += `<div style="margin-left:8px;"><span style="color:#94a3b8;">${k}:</span> ${String(v).slice(0, 100)}</div>`;
        }
        const manualKeys = Object.keys(memory).filter(k => !k.startsWith('session_') && !k.startsWith('_'));
        if (manualKeys.length > 0) {
          html += '<div style="color:#00ffd5;margin:6px 0 2px;">Saved Memories:</div>';
          for (const k of manualKeys) html += `<div style="margin-left:8px;"><span style="color:#94a3b8;">${k}:</span> ${String(memory[k]).slice(0, 100)}</div>`;
        }
        const sessionKeys = Object.keys(memory).filter(k => k.startsWith('session_')).sort().reverse();
        if (sessionKeys.length > 0) html += `<div style="color:#94a3b8;margin:6px 0 2px;">${sessionKeys.length} session summaries stored</div>`;
        if (condensed) html += `<div style="color:#94a3b8;margin:6px 0 2px;">Condensed history: ${condensed.length} chars</div>`;
        if (Object.keys(profile).length === 0 && manualKeys.length === 0 && sessionKeys.length === 0 && !condensed) {
          html += '<div style="color:#94a3b8;">No memories yet. Chat with the agent to build memory.</div>';
        }
      } catch (e) { html += `<div style="color:#f87171;">Error loading memory: ${e.message}</div>`; }
      html += '<div style="margin-top:8px;display:flex;gap:6px;">';
      html += '<button class="ub-mem-clear-all" style="background:#7f1d1d;color:#fca5a5;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;">Wipe All Memory</button>';
      html += '<button class="ub-mem-close" style="background:rgba(255,255,255,0.1);color:#e2e8f0;border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;">Close</button>';
      html += '</div>';
      memPanel.innerHTML = html;
      memPanel.querySelector('.ub-mem-close').addEventListener('click', () => memPanel.remove());
      memPanel.querySelector('.ub-mem-clear-all').addEventListener('click', async () => {
        await chrome.storage.local.remove(['urchinProfile', 'urchinMemory', 'urchinCondensed']);
        memPanel.innerHTML = '<div style="color:#a855f7;padding:8px;">🧠 Memory wiped. Agent starts fresh next message.</div>';
        setTimeout(() => memPanel.remove(), 2000);
      });
      thread.appendChild(memPanel);
      scrollToBottom();
    });
    const clearFilesBtn = el('button', 'ub-btn ub-btn-secondary ub-btn-small');
    clearFilesBtn.textContent = 'Clear Files';
    clearFilesBtn.addEventListener('click', () => { uploadedFiles = []; renderFileStrips(); });
    const grabImgBtn = el('button', 'ub-btn ub-btn-secondary ub-btn-small');
    grabImgBtn.textContent = '🖼 Page Images';
    grabImgBtn.title = 'Grab images from current page';
    grabImgBtn.addEventListener('click', async () => {
      grabImgBtn.disabled = true;
      grabImgBtn.textContent = '🖼 Scanning...';
      const resp = await sendMsg({ action: 'GRAB_PAGE_IMAGES' });
      grabImgBtn.disabled = false;
      grabImgBtn.textContent = '🖼 Page Images';
      if (!resp || !resp.success || !resp.images || resp.images.length === 0) {
        const note = el('div', 'ub-msg ub-msg-tool');
        note.textContent = 'No images found on this page.';
        thread.appendChild(note);
        scrollToBottom();
        return;
      }
      // Show image picker in chat
      const existing = thread.querySelector('.ub-img-picker');
      if (existing) existing.remove();
      const picker = el('div', 'ub-img-picker');
      const label = el('div', 'ub-msg ub-msg-tool');
      label.textContent = `Found ${resp.images.length} images — click to add:`;
      picker.appendChild(label);
      for (const img of resp.images) {
        const thumb = document.createElement('img');
        thumb.src = img.src;
        thumb.className = 'ub-img-pick';
        thumb.title = img.alt || `${img.w}×${img.h}`;
        thumb.addEventListener('click', async () => {
          if (thumb.classList.contains('selected')) return;
          thumb.classList.add('selected');
          try {
            const r = await fetch(img.src);
            const blob = await r.blob();
            const dataUrl = await new Promise(resolve => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
            const ext = (blob.type || 'image/png').split('/')[1] || 'png';
            const name = (img.alt || 'page-image').replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 30) + '.' + ext;
            uploadedFiles.push({ name, type: blob.type || 'image/png', dataUrl, size: blob.size });
            renderFileStrips();
          } catch (_) {
            uploadedFiles.push({ name: 'image-url', type: 'image/url', dataUrl: img.src, size: 0 });
            renderFileStrips();
          }
        });
        picker.appendChild(thumb);
      }
      const doneBtn = el('button', 'ub-btn ub-btn-secondary ub-btn-small');
      doneBtn.textContent = 'Done';
      doneBtn.style.marginTop = '6px';
      doneBtn.addEventListener('click', () => picker.remove());
      picker.appendChild(doneBtn);
      thread.appendChild(picker);
      scrollToBottom();
    });
    const screenshotBtn = el('button', 'ub-btn ub-btn-secondary ub-btn-small');
    screenshotBtn.textContent = '📸 Screenshot';
    screenshotBtn.title = 'Take screenshot & send to agent for visual analysis';
    screenshotBtn.addEventListener('click', async () => {
      screenshotBtn.disabled = true;
      screenshotBtn.textContent = '📸 Capturing...';
      const resp = await sendMsg({ action: 'CAPTURE_SCREENSHOT' });
      screenshotBtn.disabled = false;
      screenshotBtn.textContent = '📸 Screenshot';
      if (resp && resp.success && resp.dataUrl) {
        const name = `screenshot-${Date.now()}.jpg`;
        uploadedFiles.push({ name, type: 'image/jpeg', dataUrl: resp.dataUrl, size: resp.dataUrl.length });
        renderFileStrips();
        const note = el('div', 'ub-msg ub-msg-tool');
        note.textContent = '📸 Screenshot captured & attached. Ask me about it!';
        thread.appendChild(note);
        scrollToBottom();
      } else {
        const note = el('div', 'ub-msg ub-msg-tool');
        note.textContent = '⚠ Screenshot failed: ' + (resp?.error || 'unknown error');
        thread.appendChild(note);
        scrollToBottom();
      }
    });
    const ctxPill = el('span', 'ub-ctx-pill');
    ctxPill.textContent = 'auto page context on';
    const exportBtn = el('button', 'ub-btn ub-btn-secondary ub-btn-small');
    exportBtn.textContent = '📤 Export';
    exportBtn.title = 'Export chat as Markdown';
    exportBtn.addEventListener('click', async () => {
      exportBtn.disabled = true;
      exportBtn.textContent = '📤 Exporting...';
      const resp = await sendMsg({ action: 'EXPORT_CHAT' });
      exportBtn.disabled = false;
      exportBtn.textContent = '📤 Export';
      if (resp && resp.success && resp.markdown) {
        const blob = new Blob([resp.markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `urchinbot-chat-${new Date().toISOString().slice(0, 10)}.md`;
        a.click();
        URL.revokeObjectURL(url);
        const note = el('div', 'ub-msg ub-msg-tool');
        note.textContent = `📤 Exported ${resp.count} messages as Markdown.`;
        thread.appendChild(note);
        scrollToBottom();
      }
    });
    actRow.append(clearBtn, clearMemBtn, clearFilesBtn, grabImgBtn, screenshotBtn, exportBtn, ctxPill);

    async function handleSend() {
      const text = ta.value.trim();
      if (!text) return;
      ta.value = '';
      ta.style.height = 'auto';

      // Remove greeting if present
      const greet = thread.querySelector('.ub-msg-greeting');
      if (greet) greet.remove();

      const pageCtx = capturePageContext();

      let ctxSnippet = '';
      if (pageCtx.tweets) ctxSnippet = `[Tweets on screen: ${pageCtx.tweets.slice(0, 600)}]`;
      else if (pageCtx.selection) ctxSnippet = `[Selected: ${pageCtx.selection.slice(0, 400)}]`;
      else if (pageCtx.visibleText) ctxSnippet = `[Page: ${(pageCtx.title || '').slice(0, 60)} — ${pageCtx.visibleText.slice(0, 400)}]`;
      const historyText = ctxSnippet ? `${ctxSnippet}\n${text}` : text;
      chatHistory.push({ role: 'user', text: historyText, ts: Date.now() });
      saveChatHistory();
      addBubble('user', text, Date.now());

      btn.disabled = true;

      const progressEl = el('div', 'ub-progress');
      const dot = el('div', 'ub-progress-dot');
      const ptxt = el('div', 'ub-progress-text');
      ptxt.textContent = 'Thinking...';
      progressEl.append(dot, ptxt);
      thread.appendChild(progressEl);
      scrollToBottom();

      // ──── Live streaming bubble for real-time display ────
      let streamBubble = null;
      let streamingText = '';
      let streamCursor = null;

      const progressListener = (progressMsg) => {
        if (progressMsg.action !== 'URCHIN_PROGRESS') return;
        const d = progressMsg;
        if (d.phase === 'routing_done') {
          ptxt.textContent = d.maxSteps === 1 ? 'Quick reply...' : 'Reasoning...';
        } else if (d.phase === 'llm_call') {
          ptxt.textContent = d.maxSteps === 1 ? 'Generating...' : `Step ${d.step}/${d.maxSteps}...`;
        } else if (d.phase === 'tools') {
          ptxt.textContent = `Using: ${d.tools.join(', ')}...`;
        } else if (d.phase === 'tool_done') {
          ptxt.textContent = 'Processing results...';
        } else if (d.phase === 'streaming') {
          progressEl.style.display = 'none';
          if (!streamBubble) {
            streamBubble = el('div', 'ub-msg ub-msg-bot');
            streamCursor = el('span', 'ub-stream-cursor');
            thread.appendChild(streamBubble);
          }
          streamingText = d.fullSoFar.replace(/<<THINK>>[\s\S]*?<<\/THINK>>/g, '').replace(/<<TOOL:[\s\S]+?>>/g, '').trim();
          streamBubble.textContent = streamingText;
          streamBubble.appendChild(streamCursor);
          scrollToBottom();
        }
      };
      chrome.runtime.onMessage.addListener(progressListener);

      const filesCtx = getUploadedFilesContext();
      const fullInput = filesCtx ? text + '\n\n' + filesCtx : text;
      const resp = await sendMsg({
        action: 'URCHINLOOP_REQUEST',
        task: 'ASK',
        input: fullInput,
        context: contextArray,
        pageContext: pageCtx,
        history: chatHistory.slice(0, -1),
        uploadedFiles: uploadedFiles.map(f => ({ name: f.name, type: f.type, dataUrl: f.dataUrl }))
      });

      chrome.runtime.onMessage.removeListener(progressListener);
      progressEl.remove();
      btn.disabled = false;

      if (streamBubble) {
        if (streamCursor) streamCursor.remove();
      }

      if (resp && resp.success && resp.data) {
        const answer = resp.data.answer || JSON.stringify(resp.data);
        chatHistory.push({ role: 'assistant', text: answer, ts: Date.now() });
        saveChatHistory();
        lastAskResponse = answer;
        if (!panelOpen && companionMode) showSpeechBubble(answer);

        if (streamBubble) {
          streamBubble.innerHTML = renderMarkdown(answer);
          streamBubble.querySelectorAll('.ub-addr-card').forEach(card => {
            card.addEventListener('click', () => {
              const addr = card.dataset.addr;
              if (addr) { ta.value = `scan token ${addr}`; handleSend(); }
            });
          });
          const timeEl = el('div', 'ub-msg-time');
          timeEl.textContent = new Date().toLocaleTimeString();
          streamBubble.appendChild(timeEl);
        } else {
          addBubble('assistant', answer, Date.now());
        }

        // ──── Quick action buttons based on context ────
        const quickActions = [];
        if (/scanned|token|mint|holder/i.test(answer)) {
          quickActions.push({ label: '👛 Check deployer wallet', prompt: 'check the deployer wallet for this token' });
          quickActions.push({ label: '📊 Compare tokens', prompt: 'compare this token with similar ones' });
        }
        if (/site (built|updated|created)|build tab/i.test(answer)) {
          quickActions.push({ label: '🚀 Deploy to Netlify', prompt: 'deploy the site to netlify' });
          quickActions.push({ label: '🔧 Open Build tab', action: 'build' });
        }
        if (/wallet|balance|SOL/i.test(answer) && !/site/i.test(answer)) {
          quickActions.push({ label: '📜 Transaction history', prompt: 'show transaction history for this wallet' });
        }
        if (/price|\\$\d/i.test(answer)) {
          quickActions.push({ label: '🔍 Search for news', prompt: 'search for latest news about this token' });
        }
        if (/screenshot|image|identified|reverse/i.test(answer)) {
          quickActions.push({ label: '🔎 Search more', prompt: 'search for more information about what we found' });
        }

        if (quickActions.length > 0) {
          const qaRow = el('div', 'ub-quick-actions');
          for (const qa of quickActions.slice(0, 4)) {
            const qbtn = el('button', 'ub-quick-btn');
            qbtn.textContent = qa.label;
            qbtn.addEventListener('click', () => {
              qaRow.remove();
              if (qa.action === 'build') {
                if (tabBtns.build) tabBtns.build.click();
              } else if (qa.prompt) {
                ta.value = qa.prompt;
                handleSend();
              }
            });
            qaRow.appendChild(qbtn);
          }
          thread.appendChild(qaRow);
          scrollToBottom();
        }
      } else {
        if (streamBubble) streamBubble.remove();
        const errText = (resp && resp.error) || 'Request failed.';
        const errEl = errorMsg(errText);
        thread.appendChild(errEl);
        scrollToBottom();
      }
    }

    btn.addEventListener('click', handleSend);
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
    // Auto-resize textarea
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 80) + 'px'; });

    chatWrap.append(thread, askFileStrip, inputRow, actRow);
    tp.appendChild(chatWrap);
  })();

  /* ── Build Tab ── */
  let buildResultArea;
  let buildNetlifyInfo = null;
  let buildEditHistory = [];

  (function buildBuildTab() {
    const tp = tabPanels.build;
    buildResultArea = el('div', '');
    buildResultArea.style.cssText = 'display:flex;flex-direction:column;flex:1;overflow-y:auto;';

    chrome.storage.local.get(['urchinCurrentProject', 'urchinBuildNetlify'], (r) => {
      if (r.urchinCurrentProject && r.urchinCurrentProject.files) {
        buildProject = r.urchinCurrentProject;
        if (r.urchinBuildNetlify) buildNetlifyInfo = r.urchinBuildNetlify;
        showWorkspace();
      } else {
        showEmpty();
      }
    });

    function showEmpty() {
      buildResultArea.innerHTML = '';

      const hero = el('div', '');
      hero.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;padding:30px 16px 20px;text-align:center;';
      const heroIcon = el('div', '');
      heroIcon.style.cssText = 'font-size:32px;opacity:0.7;';
      heroIcon.textContent = '🏗';
      const heroTitle = el('div', '');
      heroTitle.style.cssText = 'font-size:15px;font-weight:700;color:#e2e8f0;';
      heroTitle.textContent = 'Build a Website';
      const heroSub = el('div', '');
      heroSub.style.cssText = 'font-size:12px;color:#64748b;line-height:1.5;max-width:300px;';
      heroSub.textContent = 'Describe what you want and urchinbot will generate a full static site with HTML, CSS, and JS. Deploy it live to Netlify in one click.';
      hero.append(heroIcon, heroTitle, heroSub);
      buildResultArea.appendChild(hero);

      const formWrap = el('div', '');
      formWrap.style.cssText = 'padding:0 4px;display:flex;flex-direction:column;gap:8px;';

      const ta = document.createElement('textarea');
      ta.placeholder = 'Describe your website...\ne.g. "A crypto portfolio tracker with dark theme and animated cards"';
      ta.style.cssText = 'min-height:72px;';

      const buildFileStrip = el('div', 'ub-files-strip');
      fileStripContainers.push(buildFileStrip);

      const toolRow = el('div', '');
      toolRow.style.cssText = 'display:flex;gap:6px;align-items:center;';
      const uploadBtn = el('button', 'ub-btn ub-btn-secondary ub-btn-small');
      uploadBtn.textContent = '\u2B06 Upload';
      uploadBtn.addEventListener('click', () => handleFileUpload('image/*,.txt,.html,.css,.js,.json,.md,.csv,.svg'));
      const grabBtn = el('button', 'ub-btn ub-btn-secondary ub-btn-small');
      grabBtn.textContent = '🖼 Page Images';
      grabBtn.addEventListener('click', async () => {
        grabBtn.disabled = true;
        const resp = await sendMsg({ action: 'GRAB_PAGE_IMAGES' });
        grabBtn.disabled = false;
        if (!resp || !resp.success || !resp.images?.length) return;
        const existing = formWrap.querySelector('.ub-img-picker');
        if (existing) existing.remove();
        const picker = el('div', 'ub-img-picker');
        for (const img of resp.images) {
          const thumb = document.createElement('img');
          thumb.src = img.src; thumb.className = 'ub-img-pick';
          thumb.title = img.alt || `${img.w}x${img.h}`;
          thumb.addEventListener('click', async () => {
            if (thumb.classList.contains('selected')) return;
            thumb.classList.add('selected');
            try {
              const r = await fetch(img.src); const blob = await r.blob();
              const dataUrl = await new Promise(resolve => { const rd = new FileReader(); rd.onload = () => resolve(rd.result); rd.readAsDataURL(blob); });
              const ext = (blob.type || 'image/png').split('/')[1] || 'png';
              uploadedFiles.push({ name: (img.alt || 'image').replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 30) + '.' + ext, type: blob.type || 'image/png', dataUrl, size: blob.size });
              renderFileStrips();
            } catch (_) { uploadedFiles.push({ name: 'image-url', type: 'image/url', dataUrl: img.src, size: 0 }); renderFileStrips(); }
          });
          picker.appendChild(thumb);
        }
        formWrap.appendChild(picker);
      });
      toolRow.append(uploadBtn, grabBtn);

      const buildBtn = el('button', 'ub-btn ub-btn-primary');
      buildBtn.textContent = 'Build Site';
      buildBtn.style.cssText += 'width:100%;padding:10px;font-size:13px;';

      buildBtn.addEventListener('click', async () => {
        const text = ta.value.trim();
        if (!text) return;
        buildNetlifyInfo = null;
        buildEditHistory = [];
        await chrome.storage.local.remove('urchinBuildNetlify');
        buildBtn.disabled = true;
        buildBtn.textContent = 'Building...';
        const prog = el('div', 'ub-progress');
        const pdot = el('div', 'ub-progress-dot');
        const ptxt = el('div', 'ub-progress-text');
        ptxt.textContent = 'Generating site code...';
        prog.append(pdot, ptxt);
        formWrap.appendChild(prog);
        const phases = ['Generating site code...', 'Building HTML + CSS + JS...', 'Styling and polishing...', 'Almost done...'];
        let pi = 0;
        const timer = setInterval(() => { pi = Math.min(pi + 1, phases.length - 1); ptxt.textContent = phases[pi]; }, 10000);
        const filesCtx = getUploadedFilesContext();
        const fullInput = filesCtx ? text + '\n\n' + filesCtx : text;
        const resp = await sendMsg({ action: 'URCHINLOOP_REQUEST', task: 'BUILD_SITE', input: fullInput, context: contextArray, uploadedFiles: uploadedFiles.map(f => ({ name: f.name, type: f.type, dataUrl: f.dataUrl })) });
        clearInterval(timer);
        if (prog.parentNode) prog.remove();
        buildBtn.disabled = false;
        buildBtn.textContent = 'Build Site';
        if (!resp || !resp.success || !resp.data) {
          const errEl = errorMsg((resp && resp.error) || 'Build failed.');
          formWrap.appendChild(errEl);
          setTimeout(() => errEl.remove(), 6000);
          return;
        }
        buildProject = resp.data;
        showWorkspace();
      });

      formWrap.append(ta, toolRow, buildFileStrip, buildBtn);
      buildResultArea.appendChild(formWrap);

      const siteMgrWrap = el('div', '');
      siteMgrWrap.style.cssText = 'padding:10px 4px 0;';
      const siteMgrBtn = el('button', 'ub-btn ub-btn-secondary');
      siteMgrBtn.textContent = '🌐 Manage Netlify Sites';
      siteMgrBtn.style.cssText += 'width:100%;';
      const siteMgrArea = el('div', '');
      siteMgrBtn.addEventListener('click', () => openSiteManager(siteMgrArea, siteMgrBtn));
      siteMgrWrap.append(siteMgrBtn, siteMgrArea);
      buildResultArea.appendChild(siteMgrWrap);
    }

    function showWorkspace() {
      buildResultArea.innerHTML = '';
      const project = buildProject;
      if (!project || !project.files) { showEmpty(); return; }
      const isLive = !!(buildNetlifyInfo && buildNetlifyInfo.siteId);

      /* ── Live site banner ── */
      if (isLive && buildNetlifyInfo.url) {
        const liveBanner = el('div', '');
        liveBanner.style.cssText = 'display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:10px;background:linear-gradient(135deg,rgba(0,255,213,0.1),rgba(34,211,238,0.06));border:1px solid rgba(0,255,213,0.25);margin-bottom:6px;';
        const liveDot = el('span', '');
        liveDot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,0.6);flex-shrink:0;animation:ub-pulse 2s ease-in-out infinite;';
        const liveTag = el('span', '');
        liveTag.style.cssText = 'font-size:10px;font-weight:700;color:#00ffd5;letter-spacing:1px;flex-shrink:0;';
        liveTag.textContent = 'LIVE';
        const liveUrl = el('a', '');
        liveUrl.href = buildNetlifyInfo.url;
        liveUrl.target = '_blank';
        liveUrl.style.cssText = 'color:#e2e8f0;font-size:12px;text-decoration:none;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        liveUrl.textContent = buildNetlifyInfo.url.replace('https://', '');
        const openBtn = el('button', '');
        openBtn.style.cssText = 'background:rgba(0,255,213,0.15);border:1px solid rgba(0,255,213,0.3);border-radius:6px;color:#00ffd5;padding:4px 10px;font-size:11px;cursor:pointer;flex-shrink:0;font-weight:600;';
        openBtn.textContent = 'Open';
        openBtn.addEventListener('click', () => window.open(buildNetlifyInfo.url, '_blank'));
        liveBanner.append(liveDot, liveTag, liveUrl, openBtn);
        buildResultArea.appendChild(liveBanner);
      }

      /* ── Project header ── */
      const projHeader = el('div', '');
      projHeader.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 0 6px;';
      const projName = el('div', '');
      projName.style.cssText = 'flex:1;font-size:13px;font-weight:700;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      projName.textContent = project.projectName || 'untitled';
      const fileCount = el('span', '');
      fileCount.style.cssText = 'font-size:10px;color:#64748b;font-weight:500;flex-shrink:0;';
      fileCount.textContent = `${(project.files || []).length} files`;
      const newSiteBtn = el('button', '');
      newSiteBtn.style.cssText = 'background:none;border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#94a3b8;padding:3px 10px;font-size:11px;cursor:pointer;font-weight:600;flex-shrink:0;transition:all .15s;';
      newSiteBtn.textContent = '+ New';
      newSiteBtn.addEventListener('mouseenter', () => { newSiteBtn.style.borderColor = 'rgba(0,255,213,0.4)'; newSiteBtn.style.color = '#00ffd5'; });
      newSiteBtn.addEventListener('mouseleave', () => { newSiteBtn.style.borderColor = 'rgba(255,255,255,0.12)'; newSiteBtn.style.color = '#94a3b8'; });
      newSiteBtn.addEventListener('click', () => {
        buildProject = null;
        buildNetlifyInfo = null;
        buildEditHistory = [];
        chrome.storage.local.remove(['urchinCurrentProject', 'urchinBuildNetlify']);
        showEmpty();
      });
      projHeader.append(projName, fileCount, newSiteBtn);
      buildResultArea.appendChild(projHeader);

      /* ── File list (collapsed) ── */
      const filesToggle = el('div', '');
      filesToggle.style.cssText = 'cursor:pointer;display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);font-size:12px;color:#94a3b8;font-weight:600;user-select:none;transition:background .15s;';
      filesToggle.innerHTML = '<span style="font-size:10px;">&#9654;</span> View source files';
      const filesContainer = el('div', '');
      filesContainer.style.cssText = 'display:none;margin-top:4px;';
      let filesOpen = false;
      filesToggle.addEventListener('click', () => {
        filesOpen = !filesOpen;
        filesContainer.style.display = filesOpen ? 'block' : 'none';
        filesToggle.innerHTML = filesOpen ? '<span style="font-size:10px;">&#9660;</span> Hide source files' : '<span style="font-size:10px;">&#9654;</span> View source files';
        filesToggle.style.background = filesOpen ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)';
      });

      for (const f of (project.files || [])) {
        const item = el('div', 'ub-file-item');
        const hdr = el('div', 'ub-file-hdr');
        const fname = el('span');
        fname.textContent = f.path;
        const copyBtn = el('button', 'ub-btn ub-btn-secondary ub-btn-small');
        copyBtn.textContent = 'Copy';
        copyBtn.addEventListener('click', e => { e.stopPropagation(); navigator.clipboard.writeText(f.content); copyBtn.textContent = 'Copied!'; setTimeout(() => copyBtn.textContent = 'Copy', 1200); });
        hdr.append(fname, copyBtn);
        const bd = el('div', 'ub-file-body');
        const code = el('pre', 'ub-code');
        code.textContent = f.content;
        bd.appendChild(code);
        hdr.addEventListener('click', () => bd.classList.toggle('open'));
        item.append(hdr, bd);
        filesContainer.appendChild(item);
      }
      buildResultArea.append(filesToggle, filesContainer);

      /* ── Action bar ── */
      const actionBar = el('div', '');
      actionBar.style.cssText = 'display:flex;gap:6px;margin-top:8px;';

      const prevBtn = el('button', 'ub-btn ub-btn-secondary');
      prevBtn.textContent = 'Preview';
      prevBtn.style.flex = '1';
      prevBtn.addEventListener('click', () => {
        const existing = buildResultArea.querySelector('.ub-iframe');
        if (existing) { existing.remove(); return; }
        const html = (project.files || []).find(f => f.path === 'index.html');
        if (!html) return;
        let content = html.content;
        const css = (project.files || []).find(f => f.path === 'styles.css');
        const js = (project.files || []).find(f => f.path === 'app.js');
        if (css) content = content.replace(/<link[^>]*styles\.css[^>]*>/, `<style>${css.content}</style>`);
        if (js) content = content.replace(/<script[^>]*app\.js[^>]*><\/script>/, `<script>${js.content}<\/script>`);
        const blob = new Blob([content], { type: 'text/html' });
        const iframe = document.createElement('iframe');
        iframe.className = 'ub-iframe';
        iframe.sandbox = 'allow-scripts';
        iframe.src = URL.createObjectURL(blob);
        buildResultArea.appendChild(iframe);
      });

      const dlBtn = el('button', 'ub-btn ub-btn-secondary');
      dlBtn.textContent = 'ZIP';
      dlBtn.style.flexShrink = '0';
      dlBtn.addEventListener('click', async () => {
        dlBtn.disabled = true;
        const resp = await sendMsg({ action: 'ZIP_PROJECT', project });
        dlBtn.disabled = false;
        if (resp && resp.success && resp.data) {
          const blob = new Blob([new Uint8Array(resp.data)], { type: 'application/zip' });
          triggerDownload(blob, resp.name || 'project.zip');
        }
      });

      const netBtn = el('button', 'ub-btn ub-btn-cf');
      netBtn.textContent = isLive ? '🔄 Update' : '🚀 Deploy';
      netBtn.style.flex = '1';
      netBtn.addEventListener('click', async () => {
        netBtn.disabled = true;
        netBtn.textContent = isLive ? '🔄 Updating...' : '🚀 Deploying...';
        let resp;
        if (isLive) {
          resp = await sendMsg({ action: 'UPDATE_NETLIFY', project, siteId: buildNetlifyInfo.siteId });
        } else {
          resp = await sendMsg({ action: 'DEPLOY_NETLIFY', project });
        }
        netBtn.disabled = false;
        if (resp && resp.success) {
          buildNetlifyInfo = { siteId: resp.siteId || (buildNetlifyInfo && buildNetlifyInfo.siteId), url: resp.url || (buildNetlifyInfo && buildNetlifyInfo.url), siteName: resp.siteName };
          chrome.storage.local.set({ urchinBuildNetlify: buildNetlifyInfo });
          showWorkspace();
        } else {
          netBtn.textContent = isLive ? '🔄 Update' : '🚀 Deploy';
          const errInfo = el('div', '');
          errInfo.style.cssText = 'color:#ff4d6a;font-size:11px;padding:4px 0;';
          errInfo.textContent = resp?.error || 'Deploy failed';
          actionBar.after(errInfo);
          setTimeout(() => errInfo.remove(), 5000);
        }
      });

      actionBar.append(prevBtn, dlBtn, netBtn);
      buildResultArea.appendChild(actionBar);

      /* ── Edit section ── */
      const editSection = el('div', '');
      editSection.style.cssText = 'margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);';

      const editHeader = el('div', '');
      editHeader.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:8px;';
      const editIcon = el('span', '');
      editIcon.style.cssText = 'font-size:12px;';
      editIcon.textContent = '✏️';
      const editTitle = el('span', '');
      editTitle.style.cssText = 'font-size:11px;font-weight:700;color:#a855f7;letter-spacing:0.8px;';
      editTitle.textContent = 'EDIT YOUR SITE';
      const editBadge = el('span', '');
      editBadge.style.cssText = 'font-size:10px;color:#64748b;margin-left:auto;';
      editBadge.textContent = buildEditHistory.length > 0 ? `${buildEditHistory.length} edit${buildEditHistory.length > 1 ? 's' : ''}` : '';
      editHeader.append(editIcon, editTitle, editBadge);
      editSection.appendChild(editHeader);

      if (buildEditHistory.length > 0) {
        const histWrap = el('div', '');
        histWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;';
        for (const h of buildEditHistory) {
          const chip = el('span', '');
          chip.style.cssText = 'font-size:10px;color:#94a3b8;padding:2px 8px;border-radius:10px;background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.15);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
          chip.textContent = h;
          chip.title = h;
          histWrap.appendChild(chip);
        }
        editSection.appendChild(histWrap);
      }

      const editInputRow = el('div', '');
      editInputRow.style.cssText = 'display:flex;gap:6px;align-items:flex-end;';
      const editInput = document.createElement('textarea');
      editInput.placeholder = 'Describe changes... "add a footer with social links"';
      editInput.style.cssText = 'flex:1;min-height:40px;max-height:72px;resize:vertical;background:#1a1f35;color:#e2e8f0;border:1px solid rgba(168,85,247,0.2);border-radius:8px;padding:8px 10px;font-size:12px;font-family:inherit;outline:none;transition:border-color .2s;';
      editInput.addEventListener('focus', () => { editInput.style.borderColor = '#a855f7'; });
      editInput.addEventListener('blur', () => { editInput.style.borderColor = 'rgba(168,85,247,0.2)'; });

      const editSendBtn = el('button', '');
      editSendBtn.style.cssText = 'width:38px;height:38px;border-radius:8px;border:none;background:linear-gradient(135deg,#a855f7,#7c3aed);color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:box-shadow .2s,transform .1s;';
      editSendBtn.innerHTML = '&#9654;';
      editSendBtn.title = 'Apply changes';
      editSendBtn.addEventListener('mouseenter', () => { editSendBtn.style.boxShadow = '0 0 16px rgba(168,85,247,0.4)'; });
      editSendBtn.addEventListener('mouseleave', () => { editSendBtn.style.boxShadow = 'none'; });

      editInputRow.append(editInput, editSendBtn);
      editSection.appendChild(editInputRow);

      const editQuickRow = el('div', '');
      editQuickRow.style.cssText = 'display:flex;gap:6px;margin-top:6px;';
      const editDeployBtn = el('button', 'ub-btn ub-btn-cf ub-btn-small');
      editDeployBtn.textContent = isLive ? '✏️ Edit & Push Live' : '✏️ Edit & Deploy';
      editDeployBtn.style.flex = '1';
      editQuickRow.appendChild(editDeployBtn);
      editSection.appendChild(editQuickRow);

      async function handleEdit(andDeploy) {
        const changes = editInput.value.trim();
        if (!changes) return;
        editSendBtn.disabled = true;
        editDeployBtn.disabled = true;
        editInput.disabled = true;
        editSendBtn.innerHTML = '&#8987;';

        const prog = el('div', 'ub-progress');
        const pdot = el('div', 'ub-progress-dot');
        const ptxt = el('div', 'ub-progress-text');
        ptxt.textContent = 'Applying changes...';
        prog.append(pdot, ptxt);
        editSection.appendChild(prog);
        const editPhases = ['Applying changes...', 'Rewriting code...', 'Polishing...'];
        let epi = 0;
        const editTimer = setInterval(() => { epi = Math.min(epi + 1, editPhases.length - 1); ptxt.textContent = editPhases[epi]; }, 8000);

        const resp = await sendMsg({ action: 'EDIT_SITE_REQUEST', changes });
        clearInterval(editTimer);
        if (prog.parentNode) prog.remove();

        if (resp && resp.success && resp.data) {
          buildProject = resp.data;
          buildEditHistory.push(changes);

          if (andDeploy) {
            ptxt && (ptxt.textContent = 'Deploying...');
            if (buildNetlifyInfo && buildNetlifyInfo.siteId) {
              const dr = await sendMsg({ action: 'UPDATE_NETLIFY', project: buildProject, siteId: buildNetlifyInfo.siteId });
              if (dr && dr.success) { buildNetlifyInfo.url = dr.url || buildNetlifyInfo.url; chrome.storage.local.set({ urchinBuildNetlify: buildNetlifyInfo }); }
            } else {
              const dr = await sendMsg({ action: 'DEPLOY_NETLIFY', project: buildProject });
              if (dr && dr.success) { buildNetlifyInfo = { siteId: dr.siteId, url: dr.url, siteName: dr.siteName }; chrome.storage.local.set({ urchinBuildNetlify: buildNetlifyInfo }); }
            }
          }
          showWorkspace();
        } else {
          editSendBtn.disabled = false;
          editDeployBtn.disabled = false;
          editInput.disabled = false;
          editSendBtn.innerHTML = '&#9654;';
          const errEl = el('div', '');
          errEl.style.cssText = 'color:#ff4d6a;font-size:11px;padding:4px 0;';
          errEl.textContent = resp?.error || 'Edit failed.';
          editSection.appendChild(errEl);
          setTimeout(() => errEl.remove(), 5000);
        }
      }

      editSendBtn.addEventListener('click', () => handleEdit(false));
      editDeployBtn.addEventListener('click', () => handleEdit(true));
      editInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEdit(false); } });

      buildResultArea.appendChild(editSection);

      /* ── Site manager link at bottom ── */
      const bottomRow = el('div', '');
      bottomRow.style.cssText = 'margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.04);';
      const mgrLink = el('button', '');
      mgrLink.style.cssText = 'background:none;border:none;color:#64748b;font-size:11px;cursor:pointer;padding:0;transition:color .15s;';
      mgrLink.textContent = '🌐 Manage Netlify Sites';
      mgrLink.addEventListener('mouseenter', () => { mgrLink.style.color = '#00ffd5'; });
      mgrLink.addEventListener('mouseleave', () => { mgrLink.style.color = '#64748b'; });
      const mgrArea = el('div', '');
      mgrLink.addEventListener('click', () => openSiteManager(mgrArea, mgrLink));
      bottomRow.append(mgrLink, mgrArea);
      buildResultArea.appendChild(bottomRow);
    }

    function openSiteManager(siteMgrArea, siteMgrBtn) {
      (async () => {
        siteMgrBtn.disabled = true;
        const origText = siteMgrBtn.textContent;
        siteMgrBtn.textContent = '🌐 Loading...';
        siteMgrArea.innerHTML = '';
        const resp = await sendMsg({ action: 'LIST_NETLIFY_SITES' });
        siteMgrBtn.disabled = false;
        siteMgrBtn.textContent = origText;

        if (!resp || !resp.success) {
          const err = el('div', '');
          err.style.cssText = 'color:#ff4d6a;padding:6px 0;font-size:11px;';
          err.textContent = resp?.error || 'Failed to load sites';
          siteMgrArea.appendChild(err);
          return;
        }
        if (!resp.sites || resp.sites.length === 0) {
          const empty = el('div', '');
          empty.style.cssText = 'color:#94a3b8;padding:6px 0;font-size:11px;';
          empty.textContent = 'No Netlify sites found.';
          siteMgrArea.appendChild(empty);
          return;
        }

        const panel = el('div', '');
        panel.style.cssText = 'background:rgba(20,15,40,0.9);border:1px solid rgba(168,85,247,0.2);border-radius:10px;padding:10px;margin-top:6px;max-height:240px;overflow-y:auto;';

        const header = el('div', '');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';
        const title = el('span', '');
        title.style.cssText = 'font-weight:600;color:#a855f7;font-size:12px;';
        title.textContent = `${resp.sites.length} sites`;
        const selectAllBtn = el('button', '');
        selectAllBtn.style.cssText = 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#e2e8f0;padding:2px 8px;font-size:10px;cursor:pointer;';
        selectAllBtn.textContent = 'Select All';
        let allSelected = false;
        selectAllBtn.addEventListener('click', () => {
          allSelected = !allSelected;
          panel.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = allSelected; });
          selectAllBtn.textContent = allSelected ? 'Deselect' : 'Select All';
        });
        header.append(title, selectAllBtn);
        panel.appendChild(header);

        for (const site of resp.sites) {
          const row = el('div', '');
          row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:5px 2px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px;';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.dataset.siteId = site.id;
          cb.dataset.siteName = site.name;
          cb.style.cssText = 'accent-color:#a855f7;cursor:pointer;flex-shrink:0;';
          const info = el('div', '');
          info.style.cssText = 'flex:1;min-width:0;';
          info.innerHTML = `<div style="color:#e2e8f0;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${site.name || site.id}</div>` +
            `<a href="${site.url}" target="_blank" style="color:#00ffd5;text-decoration:none;font-size:10px;">${site.url}</a>`;
          row.append(cb, info);
          panel.appendChild(row);
        }

        const btnRow2 = el('div', '');
        btnRow2.style.cssText = 'display:flex;gap:6px;margin-top:8px;';
        const deleteBtn = el('button', '');
        deleteBtn.style.cssText = 'background:#7f1d1d;color:#fca5a5;border:1px solid #991b1b;border-radius:6px;padding:4px 12px;font-size:11px;cursor:pointer;font-weight:500;';
        deleteBtn.textContent = '🗑 Delete';
        const closeBtn = el('button', '');
        closeBtn.style.cssText = 'background:rgba(255,255,255,0.06);color:#e2e8f0;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:4px 12px;font-size:11px;cursor:pointer;';
        closeBtn.textContent = 'Close';
        closeBtn.addEventListener('click', () => { siteMgrArea.innerHTML = ''; });

        deleteBtn.addEventListener('click', async () => {
          const checked = [...panel.querySelectorAll('input[type="checkbox"]:checked')];
          if (checked.length === 0) return;
          const names = checked.map(cb => cb.dataset.siteName || cb.dataset.siteId).join(', ');
          if (!confirm(`Delete ${checked.length} site(s)?\n\n${names}\n\nThis cannot be undone.`)) return;
          deleteBtn.disabled = true;
          deleteBtn.textContent = '🗑 Deleting...';
          let deleted = 0;
          for (const cb of checked) {
            try {
              const r = await sendMsg({ action: 'DELETE_NETLIFY_SITE', siteId: cb.dataset.siteId });
              if (r && r.success) { deleted++; cb.closest('div').style.opacity = '0.3'; }
            } catch (_) {}
          }
          deleteBtn.textContent = `Deleted ${deleted}/${checked.length}`;
          setTimeout(() => { deleteBtn.textContent = '🗑 Delete'; deleteBtn.disabled = false; }, 2000);
        });

        btnRow2.append(deleteBtn, closeBtn);
        panel.appendChild(btnRow2);
        siteMgrArea.appendChild(panel);
      })();
    }

    tp.appendChild(buildResultArea);

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.urchinCurrentProject && changes.urchinCurrentProject.newValue) {
        const proj = changes.urchinCurrentProject.newValue;
        if (proj.files) {
          buildProject = proj;
          showWorkspace();
        }
      }
    });
  })();

  function renderBuildResult() {
    // legacy no-op — replaced by showWorkspace/showEmpty
  }

  function triggerDownload(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /* ── Deploy Tab (Pump.fun Assist) ── */
  let deployNameInput, deploySymbolInput, deployDescInput, deployResultArea;
  (function buildDeployTab() {
    const tp = tabPanels.deploy;

    // Editable fields for token info
    const nameLabel = el('div', 'ub-label'); nameLabel.textContent = 'Token Name';
    deployNameInput = document.createElement('input'); deployNameInput.type = 'text';
    deployNameInput.placeholder = 'e.g. DogWifHat';
    const symLabel = el('div', 'ub-label'); symLabel.textContent = 'Symbol / Ticker';
    deploySymbolInput = document.createElement('input'); deploySymbolInput.type = 'text';
    deploySymbolInput.placeholder = 'e.g. WIF';
    const descLabel = el('div', 'ub-label'); descLabel.textContent = 'Description';
    deployDescInput = document.createElement('textarea');
    deployDescInput.placeholder = 'Describe your token concept... or use "Generate" to create from chat context';
    deployDescInput.style.minHeight = '40px';

    const btnRow = el('div', 'ub-row');
    const genBtn = el('button', 'ub-btn ub-btn-primary');
    genBtn.textContent = 'Generate Launch Packet';
    const autoBtn = el('button', 'ub-btn ub-btn-secondary');
    autoBtn.textContent = 'From Chat Context';
    autoBtn.title = 'Auto-fill from your Ask conversation';
    btnRow.append(genBtn, autoBtn);

    deployResultArea = el('div');

    // "From Chat Context" — uses chat history to auto-generate token info
    autoBtn.addEventListener('click', async () => {
      if (chatHistory.length === 0) {
        deployResultArea.innerHTML = '';
        deployResultArea.appendChild(errorMsg('No chat history yet. Ask the bot about a token first.'));
        return;
      }
      deployResultArea.innerHTML = '';
      deployResultArea.appendChild(loading());
      autoBtn.disabled = true;
      const recentChat = chatHistory.slice(-10).map(h => `${h.role}: ${h.text}`).join('\n');
      const pageCtx = capturePageContext();
      const resp = await sendMsg({
        action: 'URCHINLOOP_REQUEST',
        task: 'PUMPFUN_LAUNCH_PACKET',
        input: `Based on our recent conversation and current page context, generate a launch packet for the token we discussed.\n\nRecent chat:\n${recentChat}`,
        context: contextArray,
        pageContext: pageCtx,
        history: chatHistory
      });
      autoBtn.disabled = false;
      deployResultArea.innerHTML = '';
      if (resp && resp.success && resp.data) {
        deployResult = resp.data;
        deployNameInput.value = resp.data.tokenName || '';
        deploySymbolInput.value = resp.data.tokenSymbol || '';
        deployDescInput.value = resp.data.description || '';
        await sendMsg({ action: 'SAVE_LAUNCH_DATA', data: { name: resp.data.tokenName, symbol: resp.data.tokenSymbol, description: resp.data.description, ts: Date.now() } });
        renderDeployResult(deployResultArea, deployResult);
      } else {
        deployResultArea.appendChild(errorMsg((resp && resp.error) || 'Generation failed.'));
      }
    });

    // "Generate Launch Packet" — uses the form fields + optional extra description
    genBtn.addEventListener('click', async () => {
      const name = deployNameInput.value.trim();
      const symbol = deploySymbolInput.value.trim();
      const desc = deployDescInput.value.trim();
      if (!name && !desc) {
        deployResultArea.innerHTML = '';
        deployResultArea.appendChild(errorMsg('Enter at least a token name or description.'));
        return;
      }
      deployResultArea.innerHTML = '';
      deployResultArea.appendChild(loading());
      genBtn.disabled = true;
      const prompt = `Create a launch packet for: Name="${name || 'auto-generate'}", Symbol="${symbol || 'auto-generate'}", Description: ${desc || 'create something based on the name'}`;
      const pageCtx = capturePageContext();
      const resp = await sendMsg({
        action: 'URCHINLOOP_REQUEST',
        task: 'PUMPFUN_LAUNCH_PACKET',
        input: prompt,
        context: contextArray,
        pageContext: pageCtx,
        history: chatHistory
      });
      genBtn.disabled = false;
      deployResultArea.innerHTML = '';
      if (resp && resp.success && resp.data) {
        deployResult = resp.data;
        if (resp.data.tokenName) deployNameInput.value = resp.data.tokenName;
        if (resp.data.tokenSymbol) deploySymbolInput.value = resp.data.tokenSymbol;
        if (resp.data.description) deployDescInput.value = resp.data.description;
        await sendMsg({ action: 'SAVE_LAUNCH_DATA', data: { name: resp.data.tokenName, symbol: resp.data.tokenSymbol, description: resp.data.description, ts: Date.now() } });
        renderDeployResult(deployResultArea, deployResult);
      } else {
        deployResultArea.appendChild(errorMsg((resp && resp.error) || 'Generation failed.'));
      }
    });

    // Token image upload
    const imgLabel = el('div', 'ub-label'); imgLabel.textContent = 'Token Image';
    const imgRow = el('div', 'ub-row');
    imgRow.style.gap = '6px';
    const imgUploadBtn = el('button', 'ub-btn ub-btn-secondary ub-btn-small');
    imgUploadBtn.textContent = '\u2B06 Upload Token Image';
    imgUploadBtn.addEventListener('click', () => handleFileUpload('image/*'));
    const deployFileStrip = el('div', 'ub-files-strip');
    fileStripContainers.push(deployFileStrip);
    imgRow.append(imgUploadBtn);

    tp.append(nameLabel, deployNameInput, symLabel, deploySymbolInput, descLabel, deployDescInput, imgLabel, imgRow, deployFileStrip, btnRow, deployResultArea);

    // Auto-load saved launch data on init
    (async () => {
      const saved = await sendMsg({ action: 'GET_LAUNCH_DATA' });
      if (saved && saved.name) {
        deployNameInput.value = saved.name || '';
        deploySymbolInput.value = saved.symbol || '';
        deployDescInput.value = saved.description || '';
      }
    })();
  })();

  function renderDeployResult(container, data) {
    container.innerHTML = '';

    if (data.imageGuidance) {
      const ig = el('div', 'ub-result');
      ig.textContent = 'Image guidance: ' + data.imageGuidance;
      container.appendChild(ig);
    }

    const ctxImage = contextArray.find(c => c.type === 'image');
    if (ctxImage) {
      const lbl = el('div', 'ub-label'); lbl.textContent = 'Launch Image';
      const img = document.createElement('img');
      img.className = 'ub-img-preview';
      img.src = ctxImage.value;
      container.append(lbl, img);
    }

    if (data.checklist && data.checklist.length) {
      const lbl = el('div', 'ub-label'); lbl.textContent = 'Deployment Checklist';
      const ul = document.createElement('ul');
      ul.style.cssText = 'padding-left:16px;font-size:12.5px;color:#c9d1d9;line-height:1.7;';
      for (const step of data.checklist) {
        const li = document.createElement('li'); li.textContent = step; ul.appendChild(li);
      }
      container.append(lbl, ul);
    }

    if (data.disclaimers && data.disclaimers.length) {
      for (const d of data.disclaimers) {
        const disc = el('div', 'ub-disclaimer'); disc.textContent = d; container.appendChild(disc);
      }
    }

    const actionRow = el('div', 'ub-row');
    actionRow.style.marginTop = '6px';

    const copyAll = el('button', 'ub-btn ub-btn-secondary');
    copyAll.textContent = 'Copy All';
    copyAll.addEventListener('click', () => {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      copyAll.textContent = 'Copied!';
      setTimeout(() => copyAll.textContent = 'Copy All', 1200);
    });

    if (data.website) {
      const dlBtn = el('button', 'ub-btn ub-btn-secondary ub-btn-small');
      dlBtn.textContent = 'Download Website ZIP';
      dlBtn.addEventListener('click', async () => {
        dlBtn.disabled = true;
        const resp = await sendMsg({ action: 'ZIP_PROJECT', project: data.website });
        dlBtn.disabled = false;
        if (resp && resp.success && resp.data) {
          triggerDownload(new Blob([new Uint8Array(resp.data)], { type: 'application/zip' }), resp.name || 'website.zip');
        }
      });
      actionRow.appendChild(dlBtn);
    }

    actionRow.appendChild(copyAll);
    container.appendChild(actionRow);

    // "Open & Autofill Pump.fun" — opens pump.fun/create and fills in the fields
    const pumpBtn = el('button', 'ub-pump-link');
    pumpBtn.style.cssText += 'cursor:pointer;border:none;margin-top:8px;';
    pumpBtn.textContent = '\u{1F680} Open & Autofill Pump.fun';
    pumpBtn.addEventListener('click', async () => {
      pumpBtn.textContent = 'Opening pump.fun...';
      pumpBtn.disabled = true;
      const uploadedImg = getUploadedImageDataUrl();
      const ctxImg = contextArray.find(c => c.type === 'image');
      const launchInfo = {
        name: deployNameInput.value || data.tokenName || '',
        symbol: deploySymbolInput.value || data.tokenSymbol || '',
        description: deployDescInput.value || data.description || '',
        imageUrl: uploadedImg || (ctxImg ? ctxImg.value : (data.imageGuidance || '')),
        imageDataUrl: uploadedImg || null
      };
      await sendMsg({ action: 'AUTOFILL_PUMP', data: launchInfo });
      pumpBtn.textContent = '\u{1F680} Open & Autofill Pump.fun';
      pumpBtn.disabled = false;
    });
    container.appendChild(pumpBtn);

    const netDeployBtn = el('button', 'ub-btn ub-btn-cf');
    netDeployBtn.style.cssText += 'width:100%;margin-top:8px;padding:10px;font-size:13px;border-radius:10px;font-weight:600;cursor:pointer;border:none;';
    netDeployBtn.textContent = '🚀 Deploy Token Landing Page';
    netDeployBtn.addEventListener('click', async () => {
      const name = deployNameInput.value || 'Token';
      const symbol = deploySymbolInput.value || 'TKN';
      const desc = deployDescInput.value || '';
      if (!name) return;
      netDeployBtn.disabled = true;
      netDeployBtn.textContent = '🚀 Deploying…';

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name} ($${symbol})</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0e1a;color:#f8fafc;font-family:'Inter',system-ui,sans-serif;font-weight:600;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
.card{max-width:480px;width:100%;background:rgba(20,25,45,0.95);border:1px solid rgba(0,255,213,0.15);border-radius:20px;padding:40px;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.5)}
h1{font-size:2em;margin-bottom:8px;background:linear-gradient(135deg,#00ffd5,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.sym{color:#a78bfa;font-size:1.3em;margin-bottom:16px}.desc{color:#94a3b8;font-size:15px;line-height:1.6;margin-bottom:24px}
.links a{display:inline-block;margin:6px;padding:10px 20px;border-radius:10px;background:linear-gradient(135deg,#00ffd5,#22d3ee);color:#0a0e1a;font-weight:700;text-decoration:none;transition:transform .2s}
.links a:hover{transform:scale(1.05)}</style></head>
<body><div class="card"><h1>${name}</h1><div class="sym">$${symbol}</div><div class="desc">${desc}</div>
<div class="links"><a href="https://pump.fun" target="_blank">Pump.fun</a><a href="https://dexscreener.com" target="_blank">Chart</a></div></div></body></html>`;

      const project = {
        projectName: symbol.toLowerCase() + '-token',
        files: [{ path: 'index.html', content: html }]
      };

      const resp = await sendMsg({ action: 'DEPLOY_NETLIFY', project });
      netDeployBtn.disabled = false;
      netDeployBtn.textContent = '🚀 Deploy Token Landing Page';

      const existing = container.querySelector('.ub-deploy-url');
      if (existing) existing.remove();
      const info = el('div', 'ub-deploy-url');
      info.style.marginTop = '8px';
      if (resp && resp.success) {
        info.innerHTML = `Live at <a href="${resp.url}" target="_blank">${resp.url}</a>`;
      } else {
        info.style.borderColor = '#ff4d6a';
        info.style.color = '#ff4d6a';
        info.textContent = resp?.error || 'Deploy failed — check Netlify token in Settings';
      }
      container.appendChild(info);
    });
    container.appendChild(netDeployBtn);

    const disc = el('div', 'ub-disclaimer');
    disc.textContent = 'urchinbot assists with launch prep only. You confirm and sign on pump.fun. DYOR — memecoins are extremely risky.';
    container.appendChild(disc);
  }

  // Listen for launch data updates from Ask agent's PREPARE_LAUNCH tool
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.urchinLaunchData && changes.urchinLaunchData.newValue) {
      const d = changes.urchinLaunchData.newValue;
      if (deployNameInput && d.name) deployNameInput.value = d.name;
      if (deploySymbolInput && d.symbol) deploySymbolInput.value = d.symbol;
      if (deployDescInput && d.description) deployDescInput.value = d.description;
    }
  });

  /* ── Scan Tab ── */
  (function buildScanTab() {
    const tp = tabPanels.scan;
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = 'Paste Solana mint address...';
    const btnRow = el('div', 'ub-row');
    const btn = el('button', 'ub-btn ub-btn-primary');
    btn.textContent = 'Scan';
    btnRow.appendChild(btn);
    const resultArea = el('div');

    btn.addEventListener('click', async () => {
      const text = inp.value.trim();
      if (!text) return;
      resultArea.innerHTML = '';
      resultArea.appendChild(loading());
      btn.disabled = true;
      const resp = await sendMsg({ action: 'URCHINLOOP_REQUEST', task: 'SOLANA_SCAN', input: text, context: contextArray });
      resultArea.innerHTML = '';
      btn.disabled = false;
      if (!resp || !resp.success || !resp.data) {
        resultArea.appendChild(errorMsg((resp && resp.error) || 'Scan failed.'));
        return;
      }
      renderScanResult(resultArea, resp.data);
    });
    tp.append(inp, btnRow, resultArea);
  })();

  function renderScanResult(container, data) {
    container.innerHTML = '';

    const conc = el('div', 'ub-result');
    conc.innerHTML = `<strong>Top 1:</strong> ${data.top1Pct}%&nbsp;&nbsp;<strong>Top 5:</strong> ${data.top5Pct}%&nbsp;&nbsp;<strong>Top 10:</strong> ${data.top10Pct}%<br><strong>Fresh/empty owners in top 10:</strong> ${data.freshOwnerCount}`;
    container.appendChild(conc);

    if (data.topHolders && data.topHolders.length) {
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      const hr = document.createElement('tr');
      for (const h of ['#', 'Address', 'Amount', '%']) { const th = document.createElement('th'); th.textContent = h; hr.appendChild(th); }
      thead.appendChild(hr);
      const tbody = document.createElement('tbody');
      for (const h of data.topHolders) {
        const tr = document.createElement('tr');
        const td1 = document.createElement('td'); td1.textContent = h.rank;
        const td2 = document.createElement('td');
        const a = document.createElement('a');
        a.href = `https://solscan.io/account/${h.address}`;
        a.target = '_blank'; a.rel = 'noopener';
        a.textContent = truncAddr(h.address);
        a.title = h.address;
        td2.appendChild(a);
        const td3 = document.createElement('td'); td3.textContent = Number(h.amount).toLocaleString();
        const td4 = document.createElement('td'); td4.textContent = h.pct + '%';
        tr.append(td1, td2, td3, td4);
        tbody.appendChild(tr);
      }
      table.append(thead, tbody);
      container.appendChild(table);
    }

    if (data.links) {
      const linkRow = el('div', 'ub-row');
      if (data.links.solscan) {
        const a = document.createElement('a');
        a.href = data.links.solscan; a.target = '_blank'; a.rel = 'noopener';
        a.className = 'ub-btn ub-btn-secondary ub-btn-small';
        a.textContent = 'View on Solscan';
        a.style.textDecoration = 'none';
        linkRow.appendChild(a);
      }
      container.appendChild(linkRow);
    }

    if (data.summary) {
      const sum = el('div', 'ub-summary');
      sum.textContent = data.summary;
      container.appendChild(sum);
    }
  }

  /* ── Log Tab ── */
  const logResultArea = el('div');
  (function buildLogTab() {
    const tp = tabPanels.log;
    const btnRow = el('div', 'ub-row');
    const refreshBtn = el('button', 'ub-btn ub-btn-secondary ub-btn-small');
    refreshBtn.textContent = 'Refresh';
    refreshBtn.addEventListener('click', refreshLogs);
    const clearBtn = el('button', 'ub-btn ub-btn-secondary ub-btn-small');
    clearBtn.textContent = 'Clear Logs';
    clearBtn.addEventListener('click', async () => {
      await chrome.storage.local.set({ urchinLogs: [] });
      refreshLogs();
    });
    btnRow.append(refreshBtn, clearBtn);
    tp.append(btnRow, logResultArea);
  })();

  async function refreshLogs() {
    logResultArea.innerHTML = '';
    logResultArea.appendChild(loading());
    const logs = await sendMsg({ action: 'GET_LOGS' });
    logResultArea.innerHTML = '';
    const entries = Array.isArray(logs) ? logs : [];
    if (!entries.length) {
      logResultArea.appendChild(errorMsg('No logs yet.'));
      return;
    }
    for (const log of [...entries].reverse()) {
      const entry = el('div', 'ub-log-entry');
      const idRow = el('div', 'ub-log-id');
      idRow.textContent = `${log.requestId || '?'} — ${log.task || ''}`;
      entry.appendChild(idRow);
      if (log.startTime) {
        const ts = el('div', 'ub-log-step');
        ts.textContent = new Date(log.startTime).toLocaleString();
        if (log.endTime) ts.textContent += ` (${((log.endTime - log.startTime) / 1000).toFixed(1)}s)`;
        entry.appendChild(ts);
      }
      for (const step of (log.steps || [])) {
        const s = el('div', 'ub-log-step');
        s.textContent = `[${step.type}] ${step.data ? JSON.stringify(step.data).slice(0, 120) : ''}`;
        entry.appendChild(s);
      }
      logResultArea.appendChild(entry);
    }
  }

  /* ── Help Tab ── */
  (function buildHelpTab() {
    const tp = tabPanels.help;
    const wrap = el('div', 'ub-help');
    wrap.innerHTML = `
      <h3>What urchinbot does</h3>
      <ul>
        <li><strong>Ask</strong> — Chat with an advanced AI agent. It can reason, plan, search the web, analyze screenshots, check token prices, scan wallets, and remember things across sessions.</li>
        <li><strong>Build</strong> — Describe a website and get a complete static site generated with self-critique quality. Deploy instantly to Netlify.</li>
        <li><strong>Deploy</strong> — Generate a pump.fun launch packet and auto-fill the form. Upload token images directly.</li>
        <li><strong>Scan</strong> — Paste a Solana mint address to see top holders, concentration, and fresh-wallet flags.</li>
        <li><strong>Log</strong> — View all urchinbot request logs with step-by-step details including agent reasoning.</li>
        <li><strong>Context</strong> — Right-click text, links, images, or pages to capture context.</li>
      </ul>
      <h3>Agent Tools</h3>
      <ul>
        <li><strong>🔍 Web Search</strong> — Ask about prices, news, or any real-time info</li>
        <li><strong>📸 Screenshot</strong> — Visual analysis of your current page</li>
        <li><strong>💰 Token Price</strong> — Live Solana token prices via Jupiter</li>
        <li><strong>👛 Wallet Balance</strong> — Check any wallet's SOL and token holdings</li>
        <li><strong>🧠 Memory</strong> — Remembers important info across sessions</li>
        <li><strong>🌐 Build/Edit Sites</strong> — Creates and modifies websites with self-review</li>
        <li><strong>🚀 Deploy Tokens</strong> — Prepares launch packets for pump.fun</li>
      </ul>
      <h3>What urchinbot does NOT do</h3>
      <ul>
        <li>No tweeting, no posting, no social actions on your behalf.</li>
        <li>No custodial keys — never asks for or stores seed phrases.</li>
        <li>No automatic token deployment — you always launch manually.</li>
      </ul>
      <h3>Privacy</h3>
      <p>API keys and settings stored locally. Nothing sent to any server except your configured LLM provider, Solana RPC, and DuckDuckGo (for search).</p>
      <h3>Hotkeys</h3>
      <ul>
        <li><strong>Alt+U</strong> — Toggle overlay visibility</li>
        <li><strong>Alt+Shift+U</strong> — Show overlay &amp; focus Ask input</li>
      </ul>
      <h3>Links</h3>
      <ul>
        <li><a href="https://github.com/urchinbotdev/urchinbot/tree/main" target="_blank" style="color:#00ffd5;text-decoration:none;font-weight:600;">GitHub</a> — source code, docs, releases</li>
        <li><a href="https://x.com/urchinbot" target="_blank" style="color:#00ffd5;text-decoration:none;font-weight:600;">X / Twitter</a> — updates and announcements</li>
        <li><a href="https://urchinbot.fun/" target="_blank" style="color:#00ffd5;text-decoration:none;font-weight:600;">Website</a> — urchinbot.fun</li>
      </ul>
    `;
    tp.appendChild(wrap);
  })();

  /* ═══════════════════════════════════════════
     HOTKEYS
     ═══════════════════════════════════════════ */
  document.addEventListener('keydown', e => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'u') {
      if (e.shiftKey) {
        showPanel();
        switchTab('ask');
        const inp = tabPanels.ask.querySelector('textarea');
        if (inp) inp.focus();
        e.preventDefault();
      } else {
        if (panelOpen) { hidePanel(); } else { showPanel(); }
        e.preventDefault();
      }
    }
  });

  /* ── Check for undelivered autonomous results on startup ── */
  try {
    chrome.runtime.sendMessage({ action: 'GET_TASK_QUEUE' }, (resp) => {
      if (!resp || !resp.success) return;
      const unread = (resp.results || []).filter(r => r.answer);
      if (unread.length > 0) {
        if (!autoBadge) {
          autoBadge = el('div', 'ub-auto-badge');
          autoBadge.textContent = String(unread.length);
          mascot.appendChild(autoBadge);
        } else {
          autoBadge.textContent = String(unread.length);
        }
        autoBadge.style.display = 'block';

        for (const r of unread) {
          chatHistory.push({ role: 'system', text: `[Background task: "${r.input}"]`, ts: r.completedAt || Date.now() });
          chatHistory.push({ role: 'assistant', text: r.answer, ts: r.completedAt || Date.now() });
          if (panelOpen) {
            const separator = el('div', 'ub-auto-separator');
            separator.innerHTML = '<span class="ub-auto-label">Background Task Result</span>';
            thread.appendChild(separator);
            addBubble('assistant', r.answer, r.completedAt || Date.now());
          }
          lastAskResponse = r.answer;
          try { chrome.runtime.sendMessage({ action: 'ACK_AUTO_RESULT', taskId: r.id }); } catch (_) {}
        }
        saveChatHistory();
        if (panelOpen) scrollToBottom();
        else if (companionMode && unread.length > 0) showSpeechBubble(unread[unread.length - 1].answer);
      }
    });
  } catch (_) {}

  /* ═══════════════════════════════════════════
     MESSAGE HANDLING (from background)
     ═══════════════════════════════════════════ */
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'CONTEXT_CAPTURE' && msg.payload) {
      addContext(msg.payload);
      showPanel();
      if (!ctxBody.classList.contains('open')) {
        ctxBody.classList.add('open');
        ctxArrow.textContent = '\u25BC';
      }
      sendResponse({ ok: true });
    }

    if (msg.action === 'TOGGLE_OVERLAY') {
      showPanel();
      if (msg.tab && TABS.includes(msg.tab)) switchTab(msg.tab);
      sendResponse({ ok: true });
    }

    if (msg.action === 'GET_PAGE_CONTEXT') {
      sendResponse(capturePageContext());
    }

    if (msg.action === 'SIDE_PANEL_STATE') {
      sidePanelOpen = !!msg.open;
      applyCompanionVisibility();
      if (sidePanelOpen) {
        chatBtn.classList.remove('ub-chat-btn-visible');
        closeReply();
      }
      sendResponse({ ok: true });
    }

    if (msg.action === 'URCHIN_AUTONOMOUS_RESULT') {
      const autoAnswer = msg.answer || 'Background task complete.';
      const autoInput = msg.input || '';

      chatHistory.push({ role: 'system', text: `[Background task: "${autoInput}"]`, ts: msg.completedAt || Date.now() });
      chatHistory.push({ role: 'assistant', text: autoAnswer, ts: msg.completedAt || Date.now() });
      saveChatHistory();
      lastAskResponse = autoAnswer;

      if (panelOpen) {
        const separator = el('div', 'ub-auto-separator');
        separator.innerHTML = '<span class="ub-auto-label">Background Task Result</span>';
        thread.appendChild(separator);
        addBubble('assistant', autoAnswer, msg.completedAt || Date.now());
        scrollToBottom();
      }

      if (!panelOpen && companionMode) {
        showSpeechBubble(autoAnswer);
      }

      if (!autoBadge) {
        autoBadge = el('div', 'ub-auto-badge');
        autoBadge.textContent = '1';
        mascot.appendChild(autoBadge);
      } else {
        const cur = parseInt(autoBadge.textContent) || 0;
        autoBadge.textContent = String(cur + 1);
      }
      autoBadge.style.display = 'block';

      try {
        chrome.runtime.sendMessage({ action: 'ACK_AUTO_RESULT', taskId: msg.taskId });
      } catch (_) {}

      sendResponse({ ok: true });
    }
  });

})();

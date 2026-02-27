(async function() {
  const $ = id => document.getElementById(id);
  const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };

  const _spPort = chrome.runtime.connect({ name: 'urchin-sidepanel' });

  function sendMsg(payload) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage(payload, resp => {
        if (chrome.runtime.lastError) resolve({ success: false, error: chrome.runtime.lastError.message });
        else resolve(resp || { success: false, error: 'No response' });
      });
    });
  }

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
      .replace(/^\d+\. (.+)$/gm, (m, p1) => `<div style="padding-left:12px;">${m.match(/^\d+/)[0]}. ${p1}</div>`)
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      .replace(/(https?:\/\/[^\s<"]+)/g, (m) => {
        if (m.includes('</a>') || m.includes('href=')) return m;
        return `<a href="${m}" target="_blank">${m.length > 50 ? m.slice(0, 47) + '…' : m}</a>`;
      })
      .replace(/\n/g, '<br>');
    html = html.replace(/([1-9A-HJ-NP-Za-km-z]{32,44})/g, (addr) => {
      if (addr.length < 32 || addr.length > 44) return addr;
      return `<span class="sp-addr" data-addr="${addr}" style="display:inline-flex;align-items:center;gap:3px;padding:1px 6px;border-radius:4px;background:rgba(0,255,213,0.08);border:1px solid rgba(0,255,213,0.15);cursor:pointer;font-family:JetBrains Mono,monospace;font-size:10.5px;color:#00ffd5;" title="Scan ${addr}">${addr.slice(0,6)}…${addr.slice(-4)} 🔍</span>`;
    });
    return html;
  }

  function truncAddr(a) { return a ? a.slice(0,6) + '…' + a.slice(-4) : ''; }
  function loading() { const d = el('div','sp-progress'); const dot = el('div','sp-progress-dot'); const t = el('div','sp-progress-text'); t.textContent = 'Loading...'; d.append(dot,t); return d; }
  function errorMsg(text) { const d = el('div','sp-error'); d.textContent = text; return d; }
  function triggerDownload(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }

  // ── Tab switching ──
  const tabs = document.querySelectorAll('.sp-tab');
  const panels = {};
  document.querySelectorAll('.sp-panel').forEach(p => { panels[p.id.replace('panel-','')] = p; });

  function switchTab(t) {
    tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === t));
    Object.entries(panels).forEach(([k,p]) => p.classList.toggle('active', k === t));
    if (t === 'log') refreshLogs();
  }
  tabs.forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

  async function getPageContext() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return {};
      return await chrome.tabs.sendMessage(tab.id, { action: 'GET_PAGE_CONTEXT' }) || {};
    } catch (_) { return {}; }
  }

  let chatHistory = [];
  function saveChatHistory() { chrome.storage.local.set({ urchinChatHistory: chatHistory }); }

  // ════════════════════════════════════════
  //  ASK TAB
  // ════════════════════════════════════════
  (async function buildAskTab() {
    const tp = panels.ask;
    const chatWrap = el('div','sp-chat-wrap');
    const thread = el('div','sp-thread');

    function scrollToBottom() { setTimeout(() => { thread.scrollTop = thread.scrollHeight; }, 30); }

    function buildHero() {
      const hero = el('div','sp-hero');
      const img = document.createElement('img'); img.src = 'urchin.png'; img.alt = 'urchinbot';
      const name = el('div','sp-hero-name'); name.textContent = 'urchinbot';
      const sub = el('div','sp-hero-sub'); sub.textContent = 'Search the web, analyze screenshots, check prices, scan wallets, build sites, and more.';
      hero.append(img, name, sub); return hero;
    }

    function addBubble(role, text, ts) {
      const msg = el('div', `sp-msg sp-msg-${role === 'user' ? 'user' : 'bot'}`);
      if (role === 'user') { msg.textContent = text; }
      else {
        msg.innerHTML = renderMarkdown(text);
        msg.querySelectorAll('.sp-addr').forEach(card => {
          card.addEventListener('click', () => { if (card.dataset.addr) { ta.value = `scan token ${card.dataset.addr}`; handleSend(); } });
        });
      }
      thread.appendChild(msg);
      if (role !== 'user') {
        const retryRow = el('div',''); retryRow.style.cssText = 'display:flex;gap:4px;margin-top:2px;';
        const retryBtn = el('button','sp-retry-btn'); retryBtn.textContent = '↻ Retry';
        retryBtn.addEventListener('click', () => {
          const last = [...chatHistory].reverse().find(h => h.role === 'user');
          if (last) { msg.remove(); retryRow.remove(); chatHistory.pop(); saveChatHistory(); ta.value = last.text.replace(/^\[.*?\]\n?/g,'').trim(); handleSend(); }
        });
        retryRow.appendChild(retryBtn); thread.appendChild(retryRow);
      }
      if (ts) { const time = el('div','sp-msg-time'); time.textContent = new Date(ts).toLocaleTimeString(); time.style.textAlign = role === 'user' ? 'right' : 'left'; thread.appendChild(time); }
      scrollToBottom();
    }

    function refreshThread() {
      thread.innerHTML = '';
      if (chatHistory.length === 0) thread.appendChild(buildHero());
      else for (const h of chatHistory) addBubble(h.role, h.text, h.ts);
    }

    // Input row
    const inputRow = el('div','sp-input-row');
    const ta = document.createElement('textarea'); ta.rows = 1; ta.placeholder = 'Ask anything...';
    const sendBtn = el('button','sp-send-btn'); sendBtn.textContent = 'Ask';
    inputRow.append(ta, sendBtn);

    const actRow = el('div','sp-chat-actions');
    const clearBtn = el('button','sp-btn sp-btn-secondary sp-btn-small'); clearBtn.textContent = 'Clear Chat';
    clearBtn.addEventListener('click', () => { chatHistory = []; saveChatHistory(); refreshThread(); });
    const memBtn = el('button','sp-btn sp-btn-secondary sp-btn-small'); memBtn.textContent = '🧠 Memory';
    memBtn.addEventListener('click', async () => {
      const existing = thread.querySelector('.sp-memory-panel');
      if (existing) { existing.remove(); return; }
      const data = await chrome.storage.local.get(['urchinMemory','urchinUserProfile','urchinSessionSummaries','urchinCondensedHistory','urchinSkills']);
      const mem = data.urchinMemory || {}; const profile = data.urchinUserProfile || '';
      const summaries = data.urchinSessionSummaries || []; const condensed = data.urchinCondensedHistory || '';
      const skills = data.urchinSkills || [];
      const panel = el('div','sp-memory-panel');
      panel.style.cssText = 'padding:12px;background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.15);border-radius:10px;font-size:11px;color:#c4b5fd;max-height:300px;overflow-y:auto;';
      let c = '<div style="font-weight:700;font-size:13px;margin-bottom:8px;color:#a855f7;">🧠 Agent Memory</div>';
      if (profile) c += `<div style="margin-bottom:6px;"><strong>Profile:</strong> ${profile.slice(0,300)}</div>`;
      const keys = Object.keys(mem);
      if (keys.length) { c += `<div><strong>Memories (${keys.length}):</strong></div>`; keys.slice(0,10).forEach(k => { c += `<div style="padding-left:8px;">• ${k}: ${String(mem[k]).slice(0,100)}</div>`; }); }
      if (skills.length) { c += `<div style="margin-top:6px;"><strong>Skills (${skills.length}):</strong></div>`; skills.forEach(s => { c += `<div style="padding-left:8px;">• <span style="color:#00ffd5;">${s.name}</span>: ${s.instruction.slice(0,80)}</div>`; }); }
      c += `<div style="margin-top:6px;"><strong>Sessions:</strong> ${summaries.length}</div>`;
      c += '<button id="sp-wipe" style="margin-top:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;font-size:10px;padding:4px 10px;border-radius:4px;cursor:pointer;">Wipe All</button>';
      panel.innerHTML = c; thread.appendChild(panel); scrollToBottom();
      panel.querySelector('#sp-wipe').addEventListener('click', async () => {
        if (!confirm('Wipe all memory?')) return;
        await chrome.storage.local.remove(['urchinMemory','urchinUserProfile','urchinSessionSummaries','urchinCondensedHistory','urchinSkills','urchinChatHistory']);
        chatHistory = []; refreshThread();
      });
    });
    actRow.append(clearBtn, memBtn);

    async function handleSend() {
      const text = ta.value.trim(); if (!text) return;
      ta.value = ''; ta.style.height = 'auto'; sendBtn.disabled = true;
      const pageCtx = await getPageContext();
      let ctxSnippet = '';
      if (pageCtx.tweets) ctxSnippet = `[Tweets: ${pageCtx.tweets.slice(0,600)}]`;
      else if (pageCtx.selection) ctxSnippet = `[Selected: ${pageCtx.selection.slice(0,400)}]`;
      else if (pageCtx.visibleText) ctxSnippet = `[Page: ${(pageCtx.title||'').slice(0,60)} — ${pageCtx.visibleText.slice(0,400)}]`;
      chatHistory.push({ role:'user', text: ctxSnippet ? `${ctxSnippet}\n${text}` : text, ts: Date.now() });
      saveChatHistory(); addBubble('user', text, Date.now());

      const prog = el('div','sp-progress'); const dot = el('div','sp-progress-dot'); const ptxt = el('div','sp-progress-text'); ptxt.textContent = 'Thinking...';
      prog.append(dot, ptxt); thread.appendChild(prog); scrollToBottom();

      let streamBubble = null, streamCursor = null;
      const progressListener = (m) => {
        if (m.action !== 'URCHIN_PROGRESS') return;
        if (m.phase === 'routing_done') ptxt.textContent = m.maxSteps === 1 ? 'Quick reply...' : 'Reasoning...';
        else if (m.phase === 'llm_call') ptxt.textContent = m.maxSteps === 1 ? 'Generating...' : `Step ${m.step}/${m.maxSteps}...`;
        else if (m.phase === 'tools') ptxt.textContent = `Using: ${m.tools.join(', ')}...`;
        else if (m.phase === 'tool_done') ptxt.textContent = 'Processing...';
        else if (m.phase === 'streaming') {
          prog.style.display = 'none';
          if (!streamBubble) { streamBubble = el('div','sp-msg sp-msg-bot'); streamCursor = el('span','sp-stream-cursor'); thread.appendChild(streamBubble); }
          streamBubble.textContent = m.fullSoFar.replace(/<<THINK>>[\s\S]*?<<\/THINK>>/g,'').replace(/<<TOOL:[\s\S]+?>>/g,'').trim();
          streamBubble.appendChild(streamCursor); scrollToBottom();
        }
      };
      chrome.runtime.onMessage.addListener(progressListener);

      const resp = await sendMsg({ action:'URCHINLOOP_REQUEST', task:'ASK', input:text, context:[], pageContext:pageCtx, history:chatHistory.slice(0,-1), uploadedFiles:[] });
      chrome.runtime.onMessage.removeListener(progressListener);
      prog.remove(); sendBtn.disabled = false;
      if (streamBubble && streamCursor) streamCursor.remove();

      if (resp && resp.success && resp.data) {
        const answer = resp.data.answer || JSON.stringify(resp.data);
        chatHistory.push({ role:'assistant', text:answer, ts:Date.now() }); saveChatHistory();
        if (streamBubble) { streamBubble.innerHTML = renderMarkdown(answer); }
        else addBubble('assistant', answer, Date.now());
      } else {
        if (streamBubble) streamBubble.remove();
        thread.appendChild(errorMsg((resp && resp.error) || 'Request failed.')); scrollToBottom();
      }
    }

    sendBtn.addEventListener('click', handleSend);
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } });
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 100) + 'px'; });

    chatWrap.append(thread, actRow, inputRow);
    tp.appendChild(chatWrap);

    // Load history
    const stored = await chrome.storage.local.get(['urchinChatHistory']);
    chatHistory = stored.urchinChatHistory || [];
    refreshThread();

    if (chatHistory.length === 0) {
      try {
        const resp = await sendMsg({ action:'GET_BRIEFING' });
        if (resp && resp.success && resp.briefing) {
          const b = el('div','sp-msg sp-msg-bot'); b.innerHTML = renderMarkdown(resp.briefing);
          b.style.borderColor = 'rgba(0,255,213,0.2)'; b.style.background = 'rgba(0,255,213,0.04)';
          thread.appendChild(b); scrollToBottom();
        }
      } catch (_) {}
    }

    // Re-sync on visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        chrome.storage.local.get(['urchinChatHistory'], d => {
          const s = d.urchinChatHistory || [];
          if (s.length !== chatHistory.length) { chatHistory = s; refreshThread(); }
        });
      }
    });

    // Autonomous results
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === 'URCHIN_AUTONOMOUS_RESULT') {
        const sep = el('div',''); sep.style.cssText = 'text-align:center;font-size:10px;color:#a855f7;padding:6px 0;font-weight:600;';
        sep.textContent = '── Background Result ──';
        thread.appendChild(sep);
        addBubble('assistant', msg.answer || 'Task completed.', Date.now());
      }
    });
  })();

  // ════════════════════════════════════════
  //  BUILD TAB
  // ════════════════════════════════════════
  (function buildBuildTab() {
    const tp = panels.build;
    let buildProject = null, buildNetlifyInfo = null, buildEditHistory = [];

    chrome.storage.local.get(['urchinCurrentProject','urchinBuildNetlify'], r => {
      if (r.urchinCurrentProject && r.urchinCurrentProject.files) {
        buildProject = r.urchinCurrentProject;
        if (r.urchinBuildNetlify) buildNetlifyInfo = r.urchinBuildNetlify;
        showWorkspace();
      } else showEmpty();
    });

    function showEmpty() {
      tp.innerHTML = '';
      const hero = el('div',''); hero.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px 10px;text-align:center;';
      const icon = el('div',''); icon.style.cssText = 'font-size:28px;opacity:0.7;'; icon.textContent = '🏗';
      const title = el('div',''); title.style.cssText = 'font-size:14px;font-weight:700;color:#e2e8f0;'; title.textContent = 'Build a Website';
      const sub = el('div',''); sub.style.cssText = 'font-size:11px;color:#64748b;line-height:1.5;max-width:280px;'; sub.textContent = 'Describe what you want and urchinbot will generate a full static site. Deploy to Netlify in one click.';
      hero.append(icon, title, sub); tp.appendChild(hero);

      const ta = document.createElement('textarea'); ta.placeholder = 'Describe your website...'; ta.style.minHeight = '60px';
      const buildBtn = el('button','sp-btn sp-btn-primary'); buildBtn.textContent = 'Build Site'; buildBtn.style.cssText += 'width:100%;padding:10px;';

      buildBtn.addEventListener('click', async () => {
        const text = ta.value.trim(); if (!text) return;
        buildBtn.disabled = true; buildBtn.textContent = 'Building...';
        const prog = loading(); tp.appendChild(prog);
        const resp = await sendMsg({ action:'URCHINLOOP_REQUEST', task:'BUILD_SITE', input:text, context:[], uploadedFiles:[] });
        prog.remove(); buildBtn.disabled = false; buildBtn.textContent = 'Build Site';
        if (resp && resp.success && resp.data) { buildProject = resp.data; showWorkspace(); }
        else { tp.appendChild(errorMsg((resp && resp.error) || 'Build failed.')); }
      });

      tp.append(ta, buildBtn);

      const mgrBtn = el('button','sp-btn sp-btn-secondary'); mgrBtn.textContent = '🌐 Manage Netlify Sites'; mgrBtn.style.cssText += 'width:100%;margin-top:8px;';
      const mgrArea = el('div','');
      mgrBtn.addEventListener('click', () => openSiteManager(mgrArea, mgrBtn));
      tp.append(mgrBtn, mgrArea);
    }

    function showWorkspace() {
      tp.innerHTML = '';
      if (!buildProject || !buildProject.files) { showEmpty(); return; }
      const isLive = !!(buildNetlifyInfo && buildNetlifyInfo.siteId);

      if (isLive && buildNetlifyInfo.url) {
        const banner = el('div','sp-live-banner');
        const dot = el('span',''); dot.style.cssText = 'width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 6px rgba(34,197,94,0.6);flex-shrink:0;';
        const tag = el('span',''); tag.style.cssText = 'font-size:10px;font-weight:700;color:#00ffd5;letter-spacing:1px;'; tag.textContent = 'LIVE';
        const url = el('a',''); url.href = buildNetlifyInfo.url; url.target = '_blank'; url.style.cssText = 'color:#e2e8f0;font-size:11px;text-decoration:none;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'; url.textContent = buildNetlifyInfo.url.replace('https://','');
        banner.append(dot, tag, url); tp.appendChild(banner);
      }

      const hdr = el('div',''); hdr.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 0;';
      const projName = el('div',''); projName.style.cssText = 'flex:1;font-size:12px;font-weight:700;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'; projName.textContent = buildProject.projectName || 'untitled';
      const fc = el('span',''); fc.style.cssText = 'font-size:10px;color:#64748b;'; fc.textContent = `${buildProject.files.length} files`;
      const newBtn = el('button','sp-btn sp-btn-secondary sp-btn-small'); newBtn.textContent = '+ New';
      newBtn.addEventListener('click', () => { buildProject = null; buildNetlifyInfo = null; buildEditHistory = []; chrome.storage.local.remove(['urchinCurrentProject','urchinBuildNetlify']); showEmpty(); });
      hdr.append(projName, fc, newBtn); tp.appendChild(hdr);

      // Files
      const fToggle = el('div',''); fToggle.style.cssText = 'cursor:pointer;display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);font-size:11px;color:#94a3b8;font-weight:600;user-select:none;';
      fToggle.innerHTML = '&#9654; View source';
      const fContainer = el('div',''); fContainer.style.display = 'none';
      let fOpen = false;
      fToggle.addEventListener('click', () => { fOpen = !fOpen; fContainer.style.display = fOpen ? 'block' : 'none'; fToggle.innerHTML = fOpen ? '&#9660; Hide source' : '&#9654; View source'; });
      for (const f of buildProject.files) {
        const item = el('div','sp-file-item');
        const fhdr = el('div','sp-file-hdr'); const fname = el('span',''); fname.textContent = f.path;
        const copyBtn = el('button','sp-btn sp-btn-secondary sp-btn-small'); copyBtn.textContent = 'Copy';
        copyBtn.addEventListener('click', e => { e.stopPropagation(); navigator.clipboard.writeText(f.content); copyBtn.textContent = '✓'; setTimeout(() => copyBtn.textContent = 'Copy', 1200); });
        fhdr.append(fname, copyBtn);
        const bd = el('div','sp-file-body'); const code = el('pre','sp-code'); code.textContent = f.content; bd.appendChild(code);
        fhdr.addEventListener('click', () => bd.classList.toggle('open'));
        item.append(fhdr, bd); fContainer.appendChild(item);
      }
      tp.append(fToggle, fContainer);

      // Actions
      const actBar = el('div','sp-row'); actBar.style.marginTop = '8px';
      const prevBtn = el('button','sp-btn sp-btn-secondary'); prevBtn.textContent = 'Preview'; prevBtn.style.flex = '1';
      prevBtn.addEventListener('click', () => {
        const existing = tp.querySelector('.sp-iframe'); if (existing) { existing.remove(); return; }
        const html = buildProject.files.find(f => f.path === 'index.html'); if (!html) return;
        let content = html.content;
        const css = buildProject.files.find(f => f.path === 'styles.css');
        const js = buildProject.files.find(f => f.path === 'app.js');
        if (css) content = content.replace(/<link[^>]*styles\.css[^>]*>/, `<style>${css.content}</style>`);
        if (js) content = content.replace(/<script[^>]*app\.js[^>]*><\/script>/, `<script>${js.content}<\/script>`);
        const iframe = document.createElement('iframe'); iframe.className = 'sp-iframe'; iframe.sandbox = 'allow-scripts';
        iframe.src = URL.createObjectURL(new Blob([content], { type:'text/html' }));
        tp.appendChild(iframe);
      });
      const dlBtn = el('button','sp-btn sp-btn-secondary'); dlBtn.textContent = 'ZIP';
      dlBtn.addEventListener('click', async () => { dlBtn.disabled = true; const r = await sendMsg({ action:'ZIP_PROJECT', project:buildProject }); dlBtn.disabled = false; if (r && r.success && r.data) triggerDownload(new Blob([new Uint8Array(r.data)], { type:'application/zip' }), r.name || 'project.zip'); });
      const netBtn = el('button','sp-btn sp-btn-cf'); netBtn.textContent = isLive ? '🔄 Update' : '🚀 Deploy'; netBtn.style.flex = '1';
      netBtn.addEventListener('click', async () => {
        netBtn.disabled = true; netBtn.textContent = isLive ? 'Updating...' : 'Deploying...';
        const r = isLive ? await sendMsg({ action:'UPDATE_NETLIFY', project:buildProject, siteId:buildNetlifyInfo.siteId }) : await sendMsg({ action:'DEPLOY_NETLIFY', project:buildProject });
        netBtn.disabled = false;
        if (r && r.success) { buildNetlifyInfo = { siteId: r.siteId || (buildNetlifyInfo && buildNetlifyInfo.siteId), url: r.url || (buildNetlifyInfo && buildNetlifyInfo.url), siteName: r.siteName }; chrome.storage.local.set({ urchinBuildNetlify: buildNetlifyInfo }); showWorkspace(); }
        else { netBtn.textContent = isLive ? '🔄 Update' : '🚀 Deploy'; }
      });
      actBar.append(prevBtn, dlBtn, netBtn); tp.appendChild(actBar);

      // Edit section
      const editSec = el('div',''); editSec.style.cssText = 'margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);';
      const editTitle = el('div',''); editTitle.style.cssText = 'font-size:11px;font-weight:700;color:#a855f7;letter-spacing:0.8px;margin-bottom:6px;'; editTitle.textContent = '✏️ EDIT YOUR SITE';
      editSec.appendChild(editTitle);
      if (buildEditHistory.length > 0) {
        const hw = el('div',''); hw.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;';
        buildEditHistory.forEach(h => { const c = el('span',''); c.style.cssText = 'font-size:10px;color:#94a3b8;padding:2px 8px;border-radius:10px;background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.15);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'; c.textContent = h; hw.appendChild(c); });
        editSec.appendChild(hw);
      }
      const editRow = el('div','sp-row'); editRow.style.alignItems = 'flex-end';
      const editInput = document.createElement('textarea'); editInput.placeholder = 'Describe changes...'; editInput.style.cssText = 'flex:1;min-height:36px;max-height:60px;';
      const editSendBtn = el('button','sp-btn sp-btn-cf'); editSendBtn.textContent = '▶'; editSendBtn.style.cssText += 'width:36px;height:36px;font-size:14px;display:flex;align-items:center;justify-content:center;';
      editRow.append(editInput, editSendBtn); editSec.appendChild(editRow);

      const editDeployBtn = el('button','sp-btn sp-btn-cf sp-btn-small'); editDeployBtn.textContent = isLive ? '✏️ Edit & Push Live' : '✏️ Edit & Deploy'; editDeployBtn.style.cssText += 'width:100%;margin-top:6px;';
      editSec.appendChild(editDeployBtn);

      async function handleEdit(andDeploy) {
        const changes = editInput.value.trim(); if (!changes) return;
        editSendBtn.disabled = true; editDeployBtn.disabled = true; editInput.disabled = true;
        const prog = loading(); editSec.appendChild(prog);
        const r = await sendMsg({ action:'EDIT_SITE_REQUEST', changes });
        prog.remove();
        if (r && r.success && r.data) {
          buildProject = r.data; buildEditHistory.push(changes);
          if (andDeploy) {
            if (buildNetlifyInfo && buildNetlifyInfo.siteId) { const dr = await sendMsg({ action:'UPDATE_NETLIFY', project:buildProject, siteId:buildNetlifyInfo.siteId }); if (dr && dr.success) { buildNetlifyInfo.url = dr.url || buildNetlifyInfo.url; chrome.storage.local.set({ urchinBuildNetlify:buildNetlifyInfo }); } }
            else { const dr = await sendMsg({ action:'DEPLOY_NETLIFY', project:buildProject }); if (dr && dr.success) { buildNetlifyInfo = { siteId:dr.siteId, url:dr.url, siteName:dr.siteName }; chrome.storage.local.set({ urchinBuildNetlify:buildNetlifyInfo }); } }
          }
          showWorkspace();
        } else { editSendBtn.disabled = false; editDeployBtn.disabled = false; editInput.disabled = false; }
      }
      editSendBtn.addEventListener('click', () => handleEdit(false));
      editDeployBtn.addEventListener('click', () => handleEdit(true));
      editInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEdit(false); } });
      tp.appendChild(editSec);
    }

    function openSiteManager(area, btn) {
      (async () => {
        btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Loading...'; area.innerHTML = '';
        const r = await sendMsg({ action:'LIST_NETLIFY_SITES' }); btn.disabled = false; btn.textContent = orig;
        if (!r || !r.success) { area.appendChild(errorMsg(r?.error || 'Failed')); return; }
        if (!r.sites || !r.sites.length) { const e = el('div',''); e.style.cssText = 'color:#94a3b8;font-size:11px;padding:6px 0;'; e.textContent = 'No sites found.'; area.appendChild(e); return; }
        const panel = el('div',''); panel.style.cssText = 'background:rgba(20,15,40,0.9);border:1px solid rgba(168,85,247,0.2);border-radius:8px;padding:8px;margin-top:6px;max-height:200px;overflow-y:auto;';
        for (const site of r.sites) {
          const row = el('div',''); row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 2px;border-bottom:1px solid rgba(255,255,255,0.04);font-size:11px;';
          const cb = document.createElement('input'); cb.type = 'checkbox'; cb.dataset.siteId = site.id; cb.dataset.siteName = site.name; cb.style.accentColor = '#a855f7';
          const info = el('div',''); info.style.cssText = 'flex:1;min-width:0;';
          info.innerHTML = `<div style="color:#e2e8f0;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${site.name||site.id}</div><a href="${site.url}" target="_blank" style="color:#00ffd5;text-decoration:none;font-size:10px;">${site.url}</a>`;
          row.append(cb, info); panel.appendChild(row);
        }
        const bRow = el('div','sp-row'); bRow.style.marginTop = '6px';
        const delBtn = el('button',''); delBtn.style.cssText = 'background:#7f1d1d;color:#fca5a5;border:1px solid #991b1b;border-radius:6px;padding:4px 12px;font-size:11px;cursor:pointer;'; delBtn.textContent = '🗑 Delete';
        const closeBtn = el('button','sp-btn sp-btn-secondary sp-btn-small'); closeBtn.textContent = 'Close';
        closeBtn.addEventListener('click', () => { area.innerHTML = ''; });
        delBtn.addEventListener('click', async () => {
          const checked = [...panel.querySelectorAll('input:checked')]; if (!checked.length) return;
          if (!confirm(`Delete ${checked.length} site(s)?`)) return;
          delBtn.disabled = true; delBtn.textContent = 'Deleting...';
          for (const cb of checked) { try { await sendMsg({ action:'DELETE_NETLIFY_SITE', siteId:cb.dataset.siteId }); cb.closest('div').style.opacity = '0.3'; } catch (_) {} }
          delBtn.textContent = 'Done'; setTimeout(() => { delBtn.textContent = '🗑 Delete'; delBtn.disabled = false; }, 2000);
        });
        bRow.append(delBtn, closeBtn); panel.appendChild(bRow); area.appendChild(panel);
      })();
    }

    chrome.storage.onChanged.addListener(changes => {
      if (changes.urchinCurrentProject && changes.urchinCurrentProject.newValue?.files) { buildProject = changes.urchinCurrentProject.newValue; showWorkspace(); }
    });
  })();

  // ════════════════════════════════════════
  //  DEPLOY TAB
  // ════════════════════════════════════════
  (function buildDeployTab() {
    const tp = panels.deploy;
    const nLabel = el('div','sp-label'); nLabel.textContent = 'Token Name';
    const nameInp = document.createElement('input'); nameInp.type = 'text'; nameInp.placeholder = 'e.g. DogWifHat';
    const sLabel = el('div','sp-label'); sLabel.textContent = 'Symbol / Ticker';
    const symInp = document.createElement('input'); symInp.type = 'text'; symInp.placeholder = 'e.g. WIF';
    const dLabel = el('div','sp-label'); dLabel.textContent = 'Description';
    const descInp = document.createElement('textarea'); descInp.placeholder = 'Describe your token...'; descInp.style.minHeight = '40px';

    const btnRow = el('div','sp-row');
    const genBtn = el('button','sp-btn sp-btn-primary'); genBtn.textContent = 'Generate';
    const autoBtn = el('button','sp-btn sp-btn-secondary'); autoBtn.textContent = 'From Chat';
    btnRow.append(genBtn, autoBtn);

    const resultArea = el('div','');

    autoBtn.addEventListener('click', async () => {
      if (!chatHistory.length) { resultArea.innerHTML = ''; resultArea.appendChild(errorMsg('No chat history yet.')); return; }
      resultArea.innerHTML = ''; resultArea.appendChild(loading()); autoBtn.disabled = true;
      const recent = chatHistory.slice(-10).map(h => `${h.role}: ${h.text}`).join('\n');
      const r = await sendMsg({ action:'URCHINLOOP_REQUEST', task:'PUMPFUN_LAUNCH_PACKET', input:`Based on recent conversation, generate a launch packet.\n\n${recent}`, context:[], pageContext: await getPageContext(), history:chatHistory });
      autoBtn.disabled = false; resultArea.innerHTML = '';
      if (r && r.success && r.data) { nameInp.value = r.data.tokenName || ''; symInp.value = r.data.tokenSymbol || ''; descInp.value = r.data.description || ''; renderDeployResult(resultArea, r.data); }
      else resultArea.appendChild(errorMsg(r?.error || 'Failed.'));
    });

    genBtn.addEventListener('click', async () => {
      const name = nameInp.value.trim(), sym = symInp.value.trim(), desc = descInp.value.trim();
      if (!name && !desc) { resultArea.innerHTML = ''; resultArea.appendChild(errorMsg('Enter a name or description.')); return; }
      resultArea.innerHTML = ''; resultArea.appendChild(loading()); genBtn.disabled = true;
      const r = await sendMsg({ action:'URCHINLOOP_REQUEST', task:'PUMPFUN_LAUNCH_PACKET', input:`Create launch packet: Name="${name||'auto'}", Symbol="${sym||'auto'}", Description: ${desc||'based on name'}`, context:[], pageContext: await getPageContext(), history:chatHistory });
      genBtn.disabled = false; resultArea.innerHTML = '';
      if (r && r.success && r.data) { if (r.data.tokenName) nameInp.value = r.data.tokenName; if (r.data.tokenSymbol) symInp.value = r.data.tokenSymbol; if (r.data.description) descInp.value = r.data.description; renderDeployResult(resultArea, r.data); }
      else resultArea.appendChild(errorMsg(r?.error || 'Failed.'));
    });

    tp.append(nLabel, nameInp, sLabel, symInp, dLabel, descInp, btnRow, resultArea);

    (async () => { const s = await sendMsg({ action:'GET_LAUNCH_DATA' }); if (s && s.name) { nameInp.value = s.name || ''; symInp.value = s.symbol || ''; descInp.value = s.description || ''; } })();

    function renderDeployResult(container, data) {
      container.innerHTML = '';
      if (data.checklist && data.checklist.length) {
        const ul = document.createElement('ul'); ul.style.cssText = 'padding-left:16px;font-size:12px;color:#c9d1d9;line-height:1.7;';
        data.checklist.forEach(s => { const li = document.createElement('li'); li.textContent = s; ul.appendChild(li); });
        container.appendChild(ul);
      }
      const actRow = el('div','sp-row'); actRow.style.marginTop = '6px';
      const copyBtn = el('button','sp-btn sp-btn-secondary sp-btn-small'); copyBtn.textContent = 'Copy All';
      copyBtn.addEventListener('click', () => { navigator.clipboard.writeText(JSON.stringify(data,null,2)); copyBtn.textContent = '✓'; setTimeout(() => copyBtn.textContent = 'Copy All', 1200); });
      actRow.appendChild(copyBtn); container.appendChild(actRow);

      const pumpBtn = el('button','sp-btn sp-btn-primary'); pumpBtn.style.cssText += 'width:100%;margin-top:6px;';
      pumpBtn.textContent = '🚀 Open & Autofill Pump.fun';
      pumpBtn.addEventListener('click', async () => {
        pumpBtn.disabled = true;
        await sendMsg({ action:'AUTOFILL_PUMP', data:{ name: nameInp.value || data.tokenName || '', symbol: symInp.value || data.tokenSymbol || '', description: descInp.value || data.description || '' } });
        pumpBtn.disabled = false;
      });
      container.appendChild(pumpBtn);

      const netBtn = el('button','sp-btn sp-btn-cf'); netBtn.style.cssText += 'width:100%;margin-top:6px;';
      netBtn.textContent = '🚀 Deploy Landing Page';
      netBtn.addEventListener('click', async () => {
        const name = nameInp.value || 'Token', sym = symInp.value || 'TKN', desc = descInp.value || '';
        netBtn.disabled = true; netBtn.textContent = 'Deploying...';
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name} ($${sym})</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0e1a;color:#f8fafc;font-family:'Inter',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}.card{max-width:480px;width:100%;background:rgba(20,25,45,0.95);border:1px solid rgba(0,255,213,0.15);border-radius:20px;padding:40px;text-align:center}h1{font-size:2em;margin-bottom:8px;background:linear-gradient(135deg,#00ffd5,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.sym{color:#a78bfa;font-size:1.3em;margin-bottom:16px}.desc{color:#94a3b8;font-size:15px;line-height:1.6;margin-bottom:24px}.links a{display:inline-block;margin:6px;padding:10px 20px;border-radius:10px;background:linear-gradient(135deg,#00ffd5,#22d3ee);color:#0a0e1a;font-weight:700;text-decoration:none}</style></head><body><div class="card"><h1>${name}</h1><div class="sym">$${sym}</div><div class="desc">${desc}</div><div class="links"><a href="https://pump.fun" target="_blank">Pump.fun</a><a href="https://dexscreener.com" target="_blank">Chart</a></div></div></body></html>`;
        const r = await sendMsg({ action:'DEPLOY_NETLIFY', project:{ projectName: sym.toLowerCase()+'-token', files:[{path:'index.html',content:html}] } });
        netBtn.disabled = false; netBtn.textContent = '🚀 Deploy Landing Page';
        const info = el('div','sp-deploy-url'); info.style.marginTop = '6px';
        if (r && r.success) info.innerHTML = `Live at <a href="${r.url}" target="_blank">${r.url}</a>`;
        else { info.style.borderColor = '#ff4d6a'; info.style.color = '#ff4d6a'; info.textContent = r?.error || 'Deploy failed'; }
        container.appendChild(info);
      });
      container.appendChild(netBtn);

      const disc = el('div','sp-disclaimer'); disc.textContent = 'urchinbot assists with launch prep only. You confirm on pump.fun. DYOR.';
      container.appendChild(disc);
    }
  })();

  // ════════════════════════════════════════
  //  SCAN TAB
  // ════════════════════════════════════════
  (function buildScanTab() {
    const tp = panels.scan;
    const inp = document.createElement('input'); inp.type = 'text'; inp.placeholder = 'Paste Solana mint address...';
    const btnRow = el('div','sp-row');
    const btn = el('button','sp-btn sp-btn-primary'); btn.textContent = 'Scan';
    btnRow.appendChild(btn);
    const resultArea = el('div','');

    btn.addEventListener('click', async () => {
      const text = inp.value.trim(); if (!text) return;
      resultArea.innerHTML = ''; resultArea.appendChild(loading()); btn.disabled = true;
      const r = await sendMsg({ action:'URCHINLOOP_REQUEST', task:'SOLANA_SCAN', input:text, context:[] });
      resultArea.innerHTML = ''; btn.disabled = false;
      if (!r || !r.success || !r.data) { resultArea.appendChild(errorMsg(r?.error || 'Scan failed.')); return; }
      const d = r.data;
      const conc = el('div','sp-result');
      conc.innerHTML = `<strong>Top 1:</strong> ${d.top1Pct}%&nbsp;&nbsp;<strong>Top 5:</strong> ${d.top5Pct}%&nbsp;&nbsp;<strong>Top 10:</strong> ${d.top10Pct}%<br><strong>Fresh/empty owners:</strong> ${d.freshOwnerCount}`;
      resultArea.appendChild(conc);
      if (d.topHolders && d.topHolders.length) {
        const table = document.createElement('table');
        const thead = document.createElement('thead'); const hr = document.createElement('tr');
        ['#','Address','Amount','%'].forEach(h => { const th = document.createElement('th'); th.textContent = h; hr.appendChild(th); });
        thead.appendChild(hr);
        const tbody = document.createElement('tbody');
        d.topHolders.forEach(h => {
          const tr = document.createElement('tr');
          const td1 = document.createElement('td'); td1.textContent = h.rank;
          const td2 = document.createElement('td'); const a = document.createElement('a'); a.href = `https://solscan.io/account/${h.address}`; a.target = '_blank'; a.textContent = truncAddr(h.address); a.title = h.address; td2.appendChild(a);
          const td3 = document.createElement('td'); td3.textContent = Number(h.amount).toLocaleString();
          const td4 = document.createElement('td'); td4.textContent = h.pct + '%';
          tr.append(td1,td2,td3,td4); tbody.appendChild(tr);
        });
        table.append(thead, tbody); resultArea.appendChild(table);
      }
      if (d.links && d.links.solscan) { const lr = el('div','sp-row'); const a = document.createElement('a'); a.href = d.links.solscan; a.target = '_blank'; a.className = 'sp-btn sp-btn-secondary sp-btn-small'; a.textContent = 'View on Solscan'; a.style.textDecoration = 'none'; lr.appendChild(a); resultArea.appendChild(lr); }
      if (d.summary) { const s = el('div','sp-summary'); s.textContent = d.summary; resultArea.appendChild(s); }
    });

    tp.append(inp, btnRow, resultArea);
  })();

  // ════════════════════════════════════════
  //  LOG TAB
  // ════════════════════════════════════════
  const logArea = el('div','');
  (function buildLogTab() {
    const tp = panels.log;
    const btnRow = el('div','sp-row');
    const refreshBtn = el('button','sp-btn sp-btn-secondary sp-btn-small'); refreshBtn.textContent = 'Refresh';
    refreshBtn.addEventListener('click', refreshLogs);
    const clearBtn = el('button','sp-btn sp-btn-secondary sp-btn-small'); clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', async () => { await chrome.storage.local.set({ urchinLogs: [] }); refreshLogs(); });
    btnRow.append(refreshBtn, clearBtn);
    tp.append(btnRow, logArea);
  })();

  async function refreshLogs() {
    logArea.innerHTML = ''; logArea.appendChild(loading());
    const logs = await sendMsg({ action:'GET_LOGS' });
    logArea.innerHTML = '';
    const entries = Array.isArray(logs) ? logs : [];
    if (!entries.length) { logArea.appendChild(errorMsg('No logs yet.')); return; }
    for (const log of [...entries].reverse()) {
      const entry = el('div','sp-log-entry'); entry.style.marginBottom = '6px';
      const id = el('div','sp-log-id'); id.textContent = `${log.requestId||'?'} — ${log.task||''}`;
      entry.appendChild(id);
      if (log.startTime) { const ts = el('div','sp-log-step'); ts.textContent = new Date(log.startTime).toLocaleString(); if (log.endTime) ts.textContent += ` (${((log.endTime-log.startTime)/1000).toFixed(1)}s)`; entry.appendChild(ts); }
      (log.steps || []).forEach(step => { const s = el('div','sp-log-step'); s.textContent = `[${step.type}] ${step.data ? JSON.stringify(step.data).slice(0,120) : ''}`; entry.appendChild(s); });
      logArea.appendChild(entry);
    }
  }

  // ════════════════════════════════════════
  //  HELP TAB
  // ════════════════════════════════════════
  (function buildHelpTab() {
    const tp = panels.help;
    const wrap = el('div','sp-help');
    wrap.innerHTML = `
      <h3>What urchinbot does</h3>
      <ul>
        <li><strong>Ask</strong> — Chat with an AI agent. Search the web, analyze screenshots, check prices, scan wallets, and remember things across sessions.</li>
        <li><strong>Build</strong> — Describe a website and get a full static site. Deploy to Netlify instantly.</li>
        <li><strong>Deploy</strong> — Generate pump.fun launch packets with auto-fill.</li>
        <li><strong>Scan</strong> — Paste a Solana mint to see top holders, concentration, and risk flags.</li>
        <li><strong>Log</strong> — View agent request logs with step-by-step details.</li>
      </ul>
      <h3>Agent Tools (30)</h3>
      <ul>
        <li><strong>🔍 Web Search</strong> — Real-time info via DuckDuckGo</li>
        <li><strong>📸 Screenshot</strong> — Visual analysis of current page</li>
        <li><strong>💰 Token Price</strong> — Live Solana prices via Jupiter</li>
        <li><strong>📊 DexScreener</strong> — Volume, liquidity, FDV</li>
        <li><strong>👛 Wallet</strong> — Balance + transaction history</li>
        <li><strong>🧠 Memory</strong> — Persistent across sessions</li>
        <li><strong>🌐 Build/Deploy</strong> — Sites and token launches</li>
        <li><strong>⏱ Monitor</strong> — Recurring token/wallet checks</li>
        <li><strong>📚 Skills</strong> — Self-evolving learned behaviors</li>
      </ul>
      <h3>Privacy</h3>
      <p>All data stored locally. Only calls your configured LLM, Solana RPC, DuckDuckGo, Jupiter, and Netlify.</p>
      <h3>Hotkeys</h3>
      <ul>
        <li><strong>Alt+U</strong> — Toggle overlay</li>
        <li><strong>Alt+Shift+U</strong> — Focus Ask input</li>
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
})();

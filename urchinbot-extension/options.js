const FIELDS = {
  'llm-provider':      'llmProvider',
  'llm-api-key':       'llmApiKey',
  'llm-model':         'llmModel',
  'llm-base-url':      'llmBaseUrl',
  'solana-rpc':        'solanaRpc',
  'feat-llm-summaries':'enableSummaries',
  'feat-overlay-all':  'enableAllSites',
  'feat-companion':    'companionMode',
  'feat-sidepanel':    'sidePanelOnClick',
  'netlify-token':     'netlifyToken',
  'pump-token-name':   'pumpTokenName',
  'pump-token-symbol': 'pumpTokenSymbol',
  'pump-use-image':    'pumpUseImage',
};

const TOGGLE_IDS = new Set([
  'feat-llm-summaries',
  'feat-overlay-all',
  'feat-companion',
  'feat-sidepanel',
  'pump-use-image',
]);

const MODEL_OPTIONS = {
  openai: [
    { value: 'gpt-4.1', label: 'GPT-4.1 (best quality)' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini (fast)' },
    { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano (cheapest)' },
    { value: 'o3', label: 'o3 (strongest reasoning)' },
    { value: 'o4-mini', label: 'o4-mini (fast reasoning)' },
    { value: 'o3-mini', label: 'o3-mini (reasoning)' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'custom', label: 'Custom...' },
  ],
  anthropic: [
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6 (most intelligent)' },
    { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5' },
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (recommended)' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (fast, cheap)' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus (legacy)' },
    { value: 'custom', label: 'Custom...' },
  ],
  openai_compatible: [
    { value: 'custom', label: 'Enter model name below...' },
  ],
};

const $ = (id) => document.getElementById(id);

function showStatus(msg, type = 'success') {
  const el = $('status-msg');
  el.textContent = msg;
  el.className = `status ${type}`;
  setTimeout(() => { el.textContent = ''; el.className = 'status'; }, 3000);
}

function updateProviderUI() {
  const provider = $('llm-provider').value;
  $('base-url-field').style.display =
    provider === 'openai_compatible' ? 'block' : 'none';
  populateModels(provider);
}

function populateModels(provider, selectedValue) {
  const select = $('llm-model');
  const options = MODEL_OPTIONS[provider] || [];
  select.innerHTML = '';

  if (!provider) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '— select provider first —';
    select.appendChild(opt);
    $('custom-model-field').style.display = 'none';
    return;
  }

  for (const m of options) {
    const opt = document.createElement('option');
    opt.value = m.value;
    opt.textContent = m.label;
    select.appendChild(opt);
  }

  if (selectedValue) {
    const match = options.find(o => o.value === selectedValue);
    if (match) {
      select.value = selectedValue;
    } else {
      select.value = 'custom';
      $('llm-model-custom').value = selectedValue;
    }
  } else {
    select.value = options[0]?.value || '';
  }

  updateCustomModelVisibility();
}

function updateCustomModelVisibility() {
  const isCustom = $('llm-model').value === 'custom';
  $('custom-model-field').style.display = isCustom ? 'block' : 'none';
}

function getEffectiveModel() {
  const select = $('llm-model');
  if (select.value === 'custom') {
    return $('llm-model-custom').value.trim();
  }
  return select.value;
}

function loadSettings() {
  const keys = Object.values(FIELDS);
  chrome.storage.local.get(keys, (data) => {
    for (const [domId, storeKey] of Object.entries(FIELDS)) {
      if (domId === 'llm-model') continue;
      const el = $(domId);
      if (!el) continue;
      const val = data[storeKey];
      if (TOGGLE_IDS.has(domId)) {
        el.checked = !!val;
      } else {
        el.value = val || '';
      }
    }
    const provider = $('llm-provider').value;
    $('base-url-field').style.display =
      provider === 'openai_compatible' ? 'block' : 'none';
    populateModels(provider, data.llmModel || '');
  });
}

function saveSettings() {
  const provider = $('llm-provider').value;
  const apiKey   = $('llm-api-key').value.trim();

  if (provider && !apiKey) {
    showStatus('API key is required when a provider is selected.', 'error');
    $('llm-api-key').focus();
    return;
  }

  const payload = {};
  for (const [domId, storeKey] of Object.entries(FIELDS)) {
    if (domId === 'llm-model') {
      payload[storeKey] = getEffectiveModel();
      continue;
    }
    const el = $(domId);
    if (!el) continue;
    payload[storeKey] = TOGGLE_IDS.has(domId) ? el.checked : el.value.trim();
  }

  chrome.storage.local.set(payload, () => {
    if (chrome.runtime.lastError) {
      showStatus('Error saving: ' + chrome.runtime.lastError.message, 'error');
    } else {
      showStatus('Settings saved — model: ' + (payload.llmModel || 'none'));
    }
  });
}

function clearSettings() {
  if (!confirm('Clear ALL urchinbot settings? This cannot be undone.')) return;
  chrome.storage.local.clear(() => {
    if (chrome.runtime.lastError) {
      showStatus('Error clearing: ' + chrome.runtime.lastError.message, 'error');
    } else {
      for (const [domId] of Object.entries(FIELDS)) {
        const el = $(domId);
        if (!el) continue;
        if (TOGGLE_IDS.has(domId)) el.checked = false;
        else el.value = '';
      }
      $('llm-model-custom').value = '';
      updateProviderUI();
      showStatus('All settings cleared.');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  $('llm-provider').addEventListener('change', updateProviderUI);
  $('llm-model').addEventListener('change', updateCustomModelVisibility);
  $('btn-save').addEventListener('click', saveSettings);
  $('btn-clear').addEventListener('click', clearSettings);
});

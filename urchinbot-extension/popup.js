document.querySelectorAll('.bubble-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;

    if (tab === 'settings') {
      chrome.runtime.openOptionsPage();
      window.close();
      return;
    }

    if (tab === 'sidepanel') {
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
      chrome.runtime.sendMessage({ action: 'OPEN_SIDE_PANEL' }, () => {
        setTimeout(() => window.close(), 300);
      });
      return;
    }

    btn.style.opacity = '0.5';
    btn.style.pointerEvents = 'none';
    chrome.runtime.sendMessage({ action: 'OPEN_OVERLAY', tab }, () => {
      setTimeout(() => window.close(), 300);
    });
  });
});

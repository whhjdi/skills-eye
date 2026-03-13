'use strict';

const STORAGE_KEY = 'theme';
const radios = document.querySelectorAll('input[name="theme"]');
const statusText = document.getElementById('status-text');

const STATUS_LABELS = {
  system: '跟随系统偏好',
  light: '亮色模式已启用',
  dark: '暗色模式已启用',
};

// ─── Init: read stored preference ──────────────────────────────────────────────

chrome.storage.local.get(STORAGE_KEY, (result) => {
  const stored = result[STORAGE_KEY] ?? 'system';
  setChecked(stored);
  setStatus(stored);
});

// ─── Radio change handler ───────────────────────────────────────────────────────

radios.forEach((radio) => {
  radio.addEventListener('change', (e) => {
    const newTheme = e.target.value;

    chrome.storage.local.set({ [STORAGE_KEY]: newTheme }, () => {
      setStatus(newTheme);
    });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.id) return;
      if (!tab.url || !tab.url.startsWith('https://skills.sh')) return;

      chrome.tabs.sendMessage(
        tab.id,
        { type: 'SET_THEME', theme: newTheme },
        () => {
          // Suppress error if content script isn't ready (new tab, etc.)
          void chrome.runtime.lastError;
        }
      );
    });
  });
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

function setChecked(value) {
  const radio = document.querySelector(`input[value="${value}"]`);
  if (radio) radio.checked = true;
}

function setStatus(stored) {
  statusText.textContent = STATUS_LABELS[stored] ?? '';
}

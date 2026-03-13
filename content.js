(function () {
  'use strict';

  const STORAGE_KEY = 'theme';
  const HTML = document.documentElement;

  // ─── Theme Logic ─────────────────────────────────────────────────────────────

  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // ─── Light Mode Fix Styles ───────────────────────────────────────────────────
  // 亮色模式下，站点的 CSS 变量未正确定义亮色值，导致代码块、
  // muted 文字对比度不足。注入覆盖样式修复。

  const LIGHT_FIX_ID = '__skills-eye-light-fix__';

  const LIGHT_FIX_CSS = `
    /* 代码块背景和文字 */
    html:not(.dark) pre,
    html:not(.dark) code,
    html:not(.dark) [class*="bg-muted"] {
      color: #1a1a1a !important;
    }
    /* inline code (行内代码标签) */
    html:not(.dark) :not(pre) > code {
      background-color: transparent !important;
      color: #1a1a1a !important;
    }
    /* muted 辅助文字 */
    html:not(.dark) [class*="text-muted"] {
      color: #4a4a55 !important;
    }
    /* 边框 */
    html:not(.dark) [class*="border"] {
      border-color: #d4d4d8 !important;
    }
  `;

  function injectLightFix() {
    if (document.getElementById(LIGHT_FIX_ID)) return;
    const style = document.createElement('style');
    style.id = LIGHT_FIX_ID;
    style.textContent = LIGHT_FIX_CSS;
    document.head.appendChild(style);
  }

  function removeLightFix() {
    const el = document.getElementById(LIGHT_FIX_ID);
    if (el) el.remove();
  }

  function applyTheme(stored) {
    const effective = stored === 'system' ? getSystemTheme() : stored;
    observerPaused = true;
    if (effective === 'light') {
      HTML.classList.remove('dark');
      if (document.head) {
        injectLightFix();
      } else {
        document.addEventListener('DOMContentLoaded', injectLightFix, { once: true });
      }
    } else {
      if (!HTML.classList.contains('dark')) HTML.classList.add('dark');
      removeLightFix();
    }
    observerPaused = false;
    return effective;
  }

  // ─── Initial Application (runs before first paint) ────────────────────────────

  let currentEffective = 'dark'; // pessimistic default matches site default

  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const stored = result[STORAGE_KEY] ?? 'system';
    currentEffective = applyTheme(stored);
    updateFloatingButton(currentEffective);
  });

  // ─── MutationObserver (survive Next.js SPA navigation + hydration) ───────────

  let observerPaused = false;

  const observer = new MutationObserver(() => {
    if (observerPaused) return;
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const stored = result[STORAGE_KEY] ?? 'system';
      currentEffective = applyTheme(stored);
      updateFloatingButton(currentEffective);
    });
  });

  observer.observe(HTML, { attributes: true, attributeFilter: ['class'] });

  // ─── System Preference Listener ──────────────────────────────────────────────

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      if ((result[STORAGE_KEY] ?? 'system') === 'system') {
        currentEffective = applyTheme('system');
        updateFloatingButton(currentEffective);
      }
    });
  });

  // ─── Floating Button (Shadow DOM) ─────────────────────────────────────────────

  let floatingHost = null;
  let shadowRoot = null;
  let btnElement = null;

  const SUN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="4"/>
    <line x1="12" y1="2" x2="12" y2="4"/>
    <line x1="12" y1="20" x2="12" y2="22"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="2" y1="12" x2="4" y2="12"/>
    <line x1="20" y1="12" x2="22" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>`;

  const MOON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>`;

  function createFloatingButton() {
    if (floatingHost) return;

    floatingHost = document.createElement('div');
    floatingHost.id = '__skills-theme-btn__';

    shadowRoot = floatingHost.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        display: block;
      }
      button {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 1.5px solid rgba(128, 128, 128, 0.3);
        background: rgba(24, 24, 27, 0.88);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: background 0.2s, border-color 0.2s, transform 0.15s, box-shadow 0.2s;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
        color: #e4e4e7;
      }
      button:hover {
        transform: scale(1.1);
        border-color: rgba(128, 128, 128, 0.55);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
      }
      button.light-mode {
        background: rgba(255, 255, 255, 0.92);
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.14);
        color: #18181b;
        border-color: rgba(0, 0, 0, 0.12);
      }
      button.light-mode:hover {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      }
      button svg {
        width: 20px;
        height: 20px;
        pointer-events: none;
        display: block;
      }
    `;

    btnElement = document.createElement('button');
    btnElement.setAttribute('aria-label', 'Toggle light/dark theme');
    btnElement.setAttribute('title', 'Toggle theme');

    btnElement.addEventListener('click', () => {
      chrome.storage.local.get(STORAGE_KEY, (result) => {
        const stored = result[STORAGE_KEY] ?? 'system';
        const effective = stored === 'system' ? getSystemTheme() : stored;
        const newStored = effective === 'dark' ? 'light' : 'dark';
        chrome.storage.local.set({ [STORAGE_KEY]: newStored }, () => {
          currentEffective = applyTheme(newStored);
          updateFloatingButton(currentEffective);
        });
      });
    });

    shadowRoot.appendChild(style);
    shadowRoot.appendChild(btnElement);
    document.body.appendChild(floatingHost);

    updateFloatingButton(currentEffective);
  }

  function updateFloatingButton(effective) {
    if (!btnElement) return;
    const isDark = effective === 'dark';
    btnElement.innerHTML = isDark ? SUN_SVG : MOON_SVG;
    btnElement.classList.toggle('light-mode', !isDark);
    btnElement.setAttribute('title', isDark ? '切换到亮色模式' : '切换到暗色模式');
    btnElement.setAttribute('aria-label', isDark ? '切换到亮色模式' : '切换到暗色模式');
  }

  if (document.body) {
    createFloatingButton();
  } else {
    document.addEventListener('DOMContentLoaded', createFloatingButton, { once: true });
  }

  // ─── Message Listener (from popup) ───────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'SET_THEME') {
      currentEffective = applyTheme(message.theme);
      updateFloatingButton(currentEffective);
      sendResponse({ success: true, effective: currentEffective });
    }
    return true;
  });

})();

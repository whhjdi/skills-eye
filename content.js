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
    /* 强制所有文字为深色 */
    html:not(.dark),
    html:not(.dark) body,
    html:not(.dark) span,
    html:not(.dark) p,
    html:not(.dark) h1,
    html:not(.dark) h2,
    html:not(.dark) h3,
    html:not(.dark) h4,
    html:not(.dark) h5,
    html:not(.dark) h6,
    html:not(.dark) li,
    html:not(.dark) td,
    html:not(.dark) th,
    html:not(.dark) label,
    html:not(.dark) div {
      color: #1a1a1a !important;
    }
    /* 代码块背景和文字 */
    html:not(.dark) pre,
    html:not(.dark) code,
    html:not(.dark) [class*="bg-muted"] {
      color: #1a1a1a !important;
    }
    /* inline code */
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

  // ─── Claude Theme Styles ──────────────────────────────────────────────────────

  const CLAUDE_FIX_ID = '__skills-eye-claude-fix__';

  const CLAUDE_FIX_CSS = `
    /* 强制所有文字为深色暖色调 */
    html:not(.dark),
    html:not(.dark) body,
    html:not(.dark) span,
    html:not(.dark) p,
    html:not(.dark) h1,
    html:not(.dark) h2,
    html:not(.dark) h3,
    html:not(.dark) h4,
    html:not(.dark) h5,
    html:not(.dark) h6,
    html:not(.dark) li,
    html:not(.dark) td,
    html:not(.dark) th,
    html:not(.dark) label,
    html:not(.dark) div {
      color: #1a1814 !important;
    }
    html:not(.dark) a,
    html:not(.dark) [class*="text-primary"] {
      color: #D97757 !important;
    }
    html:not(.dark) pre,
    html:not(.dark) code {
      color: #2d2a24 !important;
      background-color: transparent !important;
    }
    html:not(.dark) :not(pre) > code {
      background-color: transparent !important;
      color: #2d2a24 !important;
    }
    html:not(.dark) [class*="text-muted"] {
      color: #8a7e6e !important;
    }
    html:not(.dark) [class*="border"] {
      border-color: #D9D3C4 !important;
    }
    html:not(.dark) button[class*="primary"],
    html:not(.dark) [class*="bg-primary"] {
      background-color: #D97757 !important;
      color: #fff !important;
    }
  `;

  function injectClaudeFix() {
    if (document.getElementById(CLAUDE_FIX_ID)) return;
    const style = document.createElement('style');
    style.id = CLAUDE_FIX_ID;
    style.textContent = CLAUDE_FIX_CSS;
    document.head.appendChild(style);
  }

  function removeClaudeFix() {
    const el = document.getElementById(CLAUDE_FIX_ID);
    if (el) el.remove();
  }

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
      removeClaudeFix();
      if (document.head) {
        injectLightFix();
      } else {
        document.addEventListener('DOMContentLoaded', injectLightFix, { once: true });
      }
    } else if (effective === 'claude') {
      HTML.classList.remove('dark');
      removeLightFix();
      if (document.head) {
        injectClaudeFix();
      } else {
        document.addEventListener('DOMContentLoaded', injectClaudeFix, { once: true });
      }
    } else {
      if (!HTML.classList.contains('dark')) HTML.classList.add('dark');
      removeLightFix();
      removeClaudeFix();
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
  let menuElement = null;
  let menuOpen = false;

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

  const CLAUDE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
    <path d="M8 12h8M12 8v8"/>
  </svg>`;

  const SYSTEM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>`;

  const THEME_META = {
    system: { icon: SYSTEM_SVG, label: '跟随系统' },
    light:  { icon: SUN_SVG,    label: '亮色' },
    dark:   { icon: MOON_SVG,   label: '暗色' },
    claude: { icon: CLAUDE_SVG, label: 'Claude' },
  };

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
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .wrap {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
      }
      button.main-btn {
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
      button.main-btn:hover {
        transform: scale(1.08);
        border-color: rgba(128, 128, 128, 0.55);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
      }
      button.main-btn.light-mode {
        background: rgba(255, 255, 255, 0.92);
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.14);
        color: #18181b;
        border-color: rgba(0, 0, 0, 0.12);
      }
      button.main-btn.claude-mode {
        background: rgba(250, 249, 245, 0.95);
        box-shadow: 0 2px 12px rgba(217, 119, 87, 0.2);
        color: #D97757;
        border-color: rgba(217, 119, 87, 0.3);
      }
      button.main-btn svg {
        width: 20px;
        height: 20px;
        pointer-events: none;
        display: block;
      }
      .menu {
        display: flex;
        flex-direction: column;
        gap: 4px;
        border-radius: 12px;
        padding: 6px;
        transform-origin: bottom right;
        transform: scale(0.85) translateY(4px);
        opacity: 0;
        pointer-events: none;
        transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease;
      }
      .menu.open {
        transform: scale(1) translateY(0);
        opacity: 1;
        pointer-events: auto;
      }
      .menu-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 10px;
        border-radius: 8px;
        cursor: pointer;
        border: 1px solid transparent;
        background: rgba(24, 24, 27, 0.88);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: #a1a1aa;
        font-size: 12px;
        white-space: nowrap;
        transition: background 0.12s, color 0.12s;
        width: 100%;
        text-align: left;
      }
      .menu-item:hover {
        background: rgba(40, 40, 44, 0.95);
        color: #e4e4e7;
      }
      .menu-item.active {
        background: rgba(40, 40, 44, 0.95);
        border-color: rgba(129, 140, 248, 0.3);
        color: #818cf8;
      }
      .menu-item.active.claude-item {
        border-color: rgba(217, 119, 87, 0.35);
        color: #D97757;
      }
      .menu-item svg {
        width: 15px;
        height: 15px;
        flex-shrink: 0;
        pointer-events: none;
      }
    `;

    const wrap = document.createElement('div');
    wrap.className = 'wrap';

    menuElement = document.createElement('div');
    menuElement.className = 'menu';

    const themes = ['system', 'light', 'dark', 'claude'];
    themes.forEach((t) => {
      const item = document.createElement('button');
      item.className = 'menu-item' + (t === 'claude' ? ' claude-item' : '');
      item.dataset.theme = t;
      item.innerHTML = THEME_META[t].icon + `<span>${THEME_META[t].label}</span>`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        setTheme(t);
        closeMenu();
      });
      menuElement.appendChild(item);
    });

    btnElement = document.createElement('button');
    btnElement.className = 'main-btn';
    btnElement.setAttribute('aria-label', '切换主题');
    btnElement.setAttribute('title', '切换主题');

    btnElement.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    wrap.appendChild(menuElement);
    wrap.appendChild(btnElement);
    shadowRoot.appendChild(style);
    shadowRoot.appendChild(wrap);
    document.body.appendChild(floatingHost);

    document.addEventListener('click', () => closeMenu());

    updateFloatingButton(currentEffective);
  }

  function toggleMenu() {
    menuOpen ? closeMenu() : openMenu();
  }

  function openMenu() {
    menuOpen = true;
    menuElement.classList.add('open');
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const stored = result[STORAGE_KEY] ?? 'system';
      menuElement.querySelectorAll('.menu-item').forEach((item) => {
        item.classList.toggle('active', item.dataset.theme === stored);
      });
    });
  }

  function closeMenu() {
    menuOpen = false;
    menuElement.classList.remove('open');
  }

  function setTheme(theme) {
    chrome.storage.local.set({ [STORAGE_KEY]: theme }, () => {
      currentEffective = applyTheme(theme);
      updateFloatingButton(currentEffective);
    });
  }

  function updateFloatingButton(effective) {
    if (!btnElement) return;
    const icons = { dark: SUN_SVG, light: MOON_SVG, claude: CLAUDE_SVG, system: SYSTEM_SVG };
    btnElement.innerHTML = icons[effective] ?? SUN_SVG;
    btnElement.classList.toggle('light-mode', effective === 'light');
    btnElement.classList.toggle('claude-mode', effective === 'claude');
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

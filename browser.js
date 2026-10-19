
function applySidebarIconsTopRight(enabled) {
  const sidebar = document.getElementById('py-sidebar');
  if (!sidebar) return;

  const actions = sidebar.querySelector('.py-sidebar-actions');
  const bottom = sidebar.querySelector('.py-sidebar-bottom');
  if (!actions || !bottom) return;

  let style = document.getElementById('py-sidebar-icons-top-right-style');

  if (!enabled) {
    if (style) style.remove();
    actions.style.removeProperty('position');
    actions.style.removeProperty('top');
    actions.style.removeProperty('right');
    actions.style.removeProperty('left');
    actions.style.removeProperty('flex-direction');
    actions.style.removeProperty('width');
    bottom.style.removeProperty('position');
    bottom.style.removeProperty('top');
    bottom.style.removeProperty('right');
    bottom.style.removeProperty('left');
    bottom.style.removeProperty('flex-direction');
    bottom.style.removeProperty('width');
    return;
  }

  if (!style) {
    style = document.createElement('style');
    style.id = 'py-sidebar-icons-top-right-style';
    style.textContent = `
      #py-sidebar .py-sidebar-actions,
      #py-sidebar .py-sidebar-bottom {
        position: fixed !important;
        left: auto !important;
        right: 12px !important;
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        width: max-content !important;
        height: auto !important;
        margin: 0 !important;
        padding: 6px !important;
        z-index: 99999 !important;
        background: rgba(20, 22, 30, .92);
        border-radius: 10px;
      }
      #py-sidebar .py-sidebar-actions { top: 10px !important; }
      #py-sidebar .py-sidebar-bottom { top: 64px !important; }
      #py-sidebar .py-sidebar-actions button,
      #py-sidebar .py-sidebar-bottom button { margin: 0 !important; }
    `;
    document.head.appendChild(style);
  }
}

console.log('[TRACE] browser.js iniciou');
console.log('[PYBROWSER] browser.js carregado');
const tabList = document.getElementById('tab-list');
const webviews = document.getElementById('webviews');

if (window.pybrowser?.onContextOpenLink) {
  window.pybrowser.onContextOpenLink(url => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
      createTab(url, true);
    }
  });
}

const newTabButton = document.getElementById('new-tab');

const address = document.getElementById('address');

const back = document.getElementById('back');
const forward = document.getElementById('forward');
const reload = document.getElementById('reload');

const menu = document.getElementById('menu');
const menuPopup = document.getElementById('menu-popup');

/* Recuperação do clique do menu de três pontos */
if (menu && menuPopup && !menu.dataset.clickRestored) {
  menu.dataset.clickRestored = 'true';

  menu.addEventListener('click', (event) => {
    event.stopPropagation();
    menuPopup.classList.toggle('open');
  });

  document.addEventListener('click', (event) => {
    if (!menuPopup.contains(event.target) && !menu.contains(event.target)) {
      menuPopup.classList.remove('open');
    }
  });

  menuPopup.addEventListener('click', (event) => {
    event.stopPropagation();
  });
}


const extensionsButton = document.getElementById('extensions');
const extensionPanel = document.getElementById('extension-panel');

const settingsPage = document.getElementById('settings-page');

/* Recuperação da navegação das Configurações */
if (settingsPage && !settingsPage.dataset.settingsNavigationRestored) {
  settingsPage.dataset.settingsNavigationRestored = 'true';

  const settingsNavButtons = settingsPage.querySelectorAll('.settings-nav');
  const settingsSections = settingsPage.querySelectorAll('.settings-section-page');

  function showSettingsSection(name) {
    const target = settingsPage.querySelector(
      `.settings-section-page[data-section-page="${name}"]`
    );
    if (!target) return;

    settingsNavButtons.forEach(button => {
      const selected = button.dataset.section === name;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
    });

    settingsSections.forEach(section => {
      section.classList.toggle('active', section === target);
    });
  }

  settingsNavButtons.forEach(button => {
    button.addEventListener('click', () => {
      showSettingsSection(button.dataset.section);
    });
  });

  const closeSettingsButton =
    document.getElementById('close-settings-page');

  closeSettingsButton?.addEventListener('click', () => {
    settingsPage.classList.remove('open');
  });

  document.querySelectorAll('#menu-popup [data-action="settings"]')
    .forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();

        document.getElementById('menu-popup')?.classList.remove('open');
        settingsPage.classList.add('open');
        showSettingsSection('general');
      });
    });
}


const historyPage = document.getElementById('history-page');
const downloadsPage = document.getElementById('downloads-page');

let tabs = [];
let activeTab = null;
let nextTabId = 1;
let zoom = 1;

/* Recuperação dos controles principais da navegação */
if (newTabButton && !newTabButton.dataset.eventsRestored) {
  newTabButton.dataset.eventsRestored = 'true';
  newTabButton.addEventListener('click', () => createTab());
}

if (back && !back.dataset.eventsRestored) {
  back.dataset.eventsRestored = 'true';
  back.addEventListener('click', () => {
    if (activeTab?.webview?.canGoBack()) activeTab.webview.goBack();
  });
}

if (forward && !forward.dataset.eventsRestored) {
  forward.dataset.eventsRestored = 'true';
  forward.addEventListener('click', () => {
    if (activeTab?.webview?.canGoForward()) activeTab.webview.goForward();
  });
}

if (reload && !reload.dataset.eventsRestored) {
  reload.dataset.eventsRestored = 'true';
  reload.addEventListener('click', () => {
    if (activeTab?.webview) activeTab.webview.reload();
  });
}


let history = JSON.parse(
  localStorage.getItem('pybrowser-history') || '[]'
);

let downloads = JSON.parse(
  localStorage.getItem('pybrowser-downloads') || '[]'
);


/* =========================
   ÍCONES
========================= */

function globeIcon() {
  return `
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9"/>
      <path d="M3 12h18"/>
      <path d="M12 3c3 3 3 15 0 18"/>
      <path d="M12 3c-3 3-3 15 0 18"/>
    </svg>
  `;
}

function historyIcon() {
  return `
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8"/>
      <path d="M12 8v5l3 2"/>
    </svg>
  `;
}

function downloadIcon() {
  return `
    <svg viewBox="0 0 24 24">
      <path d="M12 3v12"/>
      <path d="M7 10l5 5 5-5"/>
      <path d="M5 20h14"/>
    </svg>
  `;
}


/* =========================
   NAVEGAÇÃO
========================= */


function updateAddressBar(tab) {
  if (!tab || !tab.webview) return;

  const url = tab.webview.src || '';

  if (url.includes('home.html')) {
    address.value = '';
    address.placeholder = 'Pesquisar ou digitar endereço...';
    return;
  }

  address.value = url;
  address.placeholder = 'Pesquisar ou digitar endereço...';
}

/* Restaura a pesquisa pela tecla Enter */
if (address && !address.dataset.enterNavigationRestored) {
  address.dataset.enterNavigationRestored = 'true';

  address.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;

    event.preventDefault();

    if (activeTab) {
      navigate(activeTab);
    } else {
      createTab();
      setTimeout(() => {
        if (activeTab) navigate(activeTab);
      }, 300);
    }
  });
}

function navigate(tab) {

  if (!tab) return;

  const text = address.value.trim();

  if (!text) return;

  if (/^https?:\/\//i.test(text)) {

    tab.webview.loadURL(text);

    return;
  }

  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(text)) {

    tab.webview.loadURL(
      'https://' + text
    );

    return;
  }

  const engine =
    localStorage.getItem('search-engine') ||
    'google';

  let base =
    'https://www.google.com/search?q=';

  if (engine === 'duckduckgo')
    base = 'https://duckduckgo.com/?q=';

  if (engine === 'bing')
    base = 'https://www.bing.com/search?q=';

  if (engine === 'brave')
    base = 'https://search.brave.com/search?q=';

  tab.webview.loadURL(
    base + encodeURIComponent(text)
  );
}


/* =========================
   HISTÓRICO
========================= */

function addHistory(url, title) {

  if (!url || !/^https?:\/\//i.test(url))
    return;

  history = history.filter(
    item => item.url !== url
  );

  history.unshift({
    url,
    title: title || url,
    time: Date.now()
  });

  history = history.slice(0, 500);

  localStorage.setItem(
    'pybrowser-history',
    JSON.stringify(history)
  );
}


/* =========================
   CRIAR ABA
========================= */


async function applyHomeAppearance(webview) {
  try {
    if (
      !window.pybrowser ||
      typeof window.pybrowser.getSettings !== 'function'
    ) {
      console.warn('[PY-HOME] getSettings não disponível.');
      return;
    }

    const settings = await window.pybrowser.getSettings();

    if (!settings || typeof settings !== 'object') {
      console.warn('[PY-HOME] Configurações vazias.');
      return;
    }

    const settingsJson = JSON.stringify(settings);

    webview.executeJavaScript(`
      (() => {
        const settings = ${settingsJson};
        const root = document.documentElement;
        const body = document.body;

        if (settings.accent) {
          root.style.setProperty('--accent', settings.accent);
        }

        if (settings.radius !== undefined) {
          root.style.setProperty(
            '--radius',
            settings.radius + 'px'
          );
        }

        if (settings.wallpaper) {
          body.style.backgroundImage =
            'linear-gradient(rgba(10,10,12,.38), rgba(10,10,12,.38)), url("' +
            settings.wallpaper.replace(/"/g, '\\"') +
            '")';

          body.style.backgroundSize = 'cover';
          body.style.backgroundPosition = 'center';
          body.style.backgroundAttachment = 'fixed';
        } else {
          body.style.backgroundImage = '';
        }

        body.classList.toggle('light', settings.theme === 'light');

        body.classList.toggle(
          'py-transparent',
          !!settings.transparent
        );

        body.classList.toggle(
          'py-no-animations',
          settings.homeAnimations === false
        );

        root.style.setProperty(
          '--clock-size',
          (settings.clockSize || 92) + 'px'
        );

        root.style.setProperty(
          '--clock-weight',
          settings.clockWeight || 700
        );

        root.style.setProperty(
          '--animation-speed',
          (settings.animationSpeed || 0.45) + 's'
        );

        const clock = document.getElementById('clock');

        if (clock) {
          clock.classList.remove(
            'clock-minimal',
            'clock-elegant',
            'clock-neon'
          );

          if (settings.clockStyle === 'minimal') {
            clock.classList.add('clock-minimal');
          }

          if (settings.clockStyle === 'elegant') {
            clock.classList.add('clock-elegant');
          }

          if (settings.clockStyle === 'neon') {
            clock.classList.add('clock-neon');
          }
        }

        body.classList.remove(
          'clock-position-top',
          'clock-position-bottom',
          'clock-position-left',
          'clock-position-right'
        );

        if (
          settings.clockPosition &&
          settings.clockPosition !== 'center'
        ) {
          body.classList.add(
            'clock-position-' + settings.clockPosition
          );
        }

        if (typeof updateClock === 'function') {
          updateClock();
        }

        if (typeof applyClockSettings === 'function') {
          applyClockSettings();
        }

        if (typeof applyShortcutSettings === 'function') {
          applyShortcutSettings({
            preset: settings.shortcutPreset || 'modern',
            size: settings.shortcutSize ?? 88,
            gap: settings.shortcutGap ?? 14,
            iconSize: settings.shortcutIconSize ?? 32,
            labels: settings.shortcutLabels ?? true,
            columns: settings.shortcutColumns ?? 'auto'
          });
        }
      })();
    `, true).catch(error => {
      console.warn(
        '[PY-HOME] Falha ao aplicar:',
        error
      );
    });

  } catch (error) {
    console.warn(
      '[PY-HOME] Falha ao carregar configurações:',
      error
    );
  }
}

function createTab(
  url = new URL('home.html', window.location.href).href,
  activate = true,
  privateMode = false
) {

  const id = nextTabId++;

  const tabElement =
    document.createElement('div');

  tabElement.className = 'tab tab-new';

  requestAnimationFrame(() => {
    setTimeout(() => {
      tabElement.classList.remove('tab-new');
    }, 300);
  });

  tabElement.dataset.id = id;

  tabElement.innerHTML = `
    <div class="tab-icon">
      ${globeIcon()}
    </div>

    <span class="tab-title">
      Nova aba
    </span>

    <button class="tab-close">
      ×
    </button>
  `;

  const webview =
    document.createElement('webview');

  if (privateMode) {
    webview.setAttribute(
      'partition',
      `persist:pybrowser-private-${id}`
    );
    webview.dataset.private = 'true';
  }

  webview.className =
    'browser-webview';




  webview.dataset.id = id;

  webview.src = url;

  webview.setAttribute(
    'allowpopups',
    ''
  );

  webviews.appendChild(webview);
  tabList.appendChild(tabElement);

  const tab = {
    id,
    element: tabElement,
    webview,
    title: 'Nova aba'
  };

  tabs.push(tab);

  let tabDragging = false;
  let tabPointerId = null;
  let tabStartX = 0;
  let tabStartY = 0;
  let suppressNextTabClick = false;

  tabElement.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    if (event.target.closest('.tab-close')) return;

    tabPointerId = event.pointerId;
    tabStartX = event.clientX;
    tabStartY = event.clientY;
    tabDragging = false;

    tabElement.setPointerCapture(event.pointerId);
  });

  tabElement.addEventListener('pointermove', event => {
    if (event.pointerId !== tabPointerId) return;

    const dx = event.clientX - tabStartX;
    const dy = event.clientY - tabStartY;

    if (!tabDragging && Math.hypot(dx, dy) < 5) {
      return;
    }

    if (!tabDragging) {
      tabDragging = true;
      suppressNextTabClick = true;
      tabElement.classList.add('dragging');
    }

    const elements = [...tabList.querySelectorAll('.tab')];

    for (const other of elements) {
      if (other === tabElement) continue;

      const rect = other.getBoundingClientRect();
      const middle = rect.left + rect.width / 2;

      if (event.clientX < middle) {
        if (tabElement.nextElementSibling !== other) {
          tabList.insertBefore(tabElement, other);
        }
        break;
      }

      if (event.clientX > middle && other === elements[elements.length - 1]) {
        tabList.appendChild(tabElement);
      }
    }

    tabs.sort((a, b) => {
      const children = [...tabList.children];
      return children.indexOf(a.element) - children.indexOf(b.element);
    });
  });

  tabElement.addEventListener('pointerup', event => {
    if (event.pointerId !== tabPointerId) return;

    if (tabElement.hasPointerCapture(event.pointerId)) {
      tabElement.releasePointerCapture(event.pointerId);
    }

    if (tabDragging) {
      tabElement.classList.remove('dragging');
    }

    tabDragging = false;
    tabPointerId = null;
  });

  tabElement.addEventListener('pointercancel', event => {
    if (event.pointerId !== tabPointerId) return;

    tabDragging = false;
    tabPointerId = null;
    tabElement.classList.remove('dragging');
  });

  tabElement.addEventListener(
    'click',
    event => {
      if (suppressNextTabClick) {
        suppressNextTabClick = false;
        event.preventDefault();
        return;
      }

      activateTab(id);
    }
  );

  tabElement
    .querySelector('.tab-close')
    .addEventListener(
      'click',
      event => {
        event.stopPropagation();
        closeTab(id);
      }
    );

  webview.addEventListener(
    'did-finish-load',
    () => {
      if (webview.getURL().includes('home.html')) {
        applyHomeAppearance(webview).catch(() => {});

        webview.executeJavaScript(`
          try {
            if (typeof applyClockSettings === 'function') {
              applyClockSettings();
              updateClock();
            }
          } catch {}
        `, true).catch(() => {});
      }
    }
  );

  webview.addEventListener(
    'did-navigate',
    () => {

      if (webview.getURL().includes('home.html')) {
        applyHomeAppearance(webview).catch(() => {});
      webview.executeJavaScript(`
        try {
          if (typeof applyClockSettings === 'function') {
            applyClockSettings();
            updateClock();
          }
        } catch {}
      `, true).catch(() => {});
      }

      if (activeTab === tab) {
        updateAddressBar(tab);
      }

      if (!privateMode) {
      addHistory(
        webview.getURL(),
        tab.title
      );
      }

    }
  );

  webview.addEventListener(
    'did-navigate-in-page',
    () => {

      if (activeTab === tab) {
        updateAddressBar(tab);
      }

    }
  );

  webview.addEventListener(
    'page-favicon-updated',
    event => {
      const icon = tabElement.querySelector('.tab-icon');
      if (!icon) return;

      if (webview.getURL().includes('home.html')) {
        icon.innerHTML = `
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 10.5 12 3l9 7.5"/>
            <path d="M5.5 9.5V21h13V9.5"/>
            <path d="M9.5 21v-6h5v6"/>
          </svg>
        `;
        return;
      }

      const favicon = event.favicons?.[0];
      if (!favicon) return;

      icon.innerHTML = `<img src="${favicon}" alt="" draggable="false">`;
    }
  );

  webview.addEventListener(
    'page-title-updated',
    event => {

      if (event.title) {

        tab.title = event.title;

        tabElement
          .querySelector('.tab-title')
          .textContent =
          event.title;

      }

    }
  );

  webview.addEventListener(
    'did-stop-loading',
    () => {

      if (activeTab === tab) {
        updateAddressBar(tab);
      }

    }
  );

  /*
   * Download real do Electron.
   */

  webview.getWebContentsId;

  webview.addEventListener(
    'will-navigate',
    () => {}
  );

  if (activate)
    activateTab(id);
}


/* =========================
   ATIVAR ABA
========================= */

function activateTab(id) {

  const tab =
    tabs.find(t => t.id === id);

  if (!tab) return;

  tabs.forEach(t => {

    t.element.classList.remove('active');
    t.webview.classList.remove('active');

  });

  tab.element.classList.add('active');
  tab.webview.classList.add('active');

  activeTab = tab;

  updateAddressBar(tab);
}


/* =========================
   FECHAR ABA
========================= */

function closeTab(id) {

  const index =
    tabs.findIndex(t => t.id === id);

  if (index === -1)
    return;

  const tab = tabs[index];

  tab.element.remove();
  tab.webview.remove();

  tabs.splice(index, 1);

  if (!tabs.length) {

    createTab();

    return;
  }

  if (activeTab === tab) {

    const next =
      tabs[index] ||
      tabs[index - 1];

    activateTab(next.id);
  }
}


/* =========================
   HISTÓRICO UI
========================= */


function closeSpecialPage() {
  const previousId = window.pyPreviousTabId;

  historyPage?.classList.remove('open');
  downloadsPage?.classList.remove('open');

  if (previousId !== null && previousId !== undefined) {
    const previousTab = tabs.find(tab => tab.id === previousId);

    if (previousTab) {
      activateTab(previousId);
    }
  }

  window.pyPreviousTabId = null;
}

function openHistory() {
  menuPopup?.classList.remove('open');
  window.pyPreviousTabId = activeTab?.id ?? window.pyPreviousTabId ?? null;
  historyPage.classList.add('open');
  downloadsPage.classList.remove('open');
  renderHistory();
  document.getElementById('history-search')?.focus();
}

function faviconFor(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return `${parsed.origin}/favicon.ico`;
  } catch {
    return '';
  }
}

function formatDay(timestamp) {
  const date = new Date(timestamp || Date.now());
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(date, today)) return 'HOJE';
  if (sameDay(date, yesterday)) return 'ONTEM';
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
}

function renderHistory() {
  const list = document.getElementById('history-list');
  if (!list) return;
  const query = (document.getElementById('history-search')?.value || '').trim().toLocaleLowerCase('pt-BR');
  const filtered = history.filter(item =>
    `${item.title || ''} ${item.url || ''}`.toLocaleLowerCase('pt-BR').includes(query)
  );
  const count = document.getElementById('history-count');
  if (count) count.textContent = `${filtered.length} ${filtered.length === 1 ? 'página' : 'páginas'}`;
  list.replaceChildren();

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'library-empty';
    empty.innerHTML = `<div class="library-empty-icon">⌕</div><h2>${query ? 'Nada encontrado' : 'Seu histórico está vazio'}</h2><p>${query ? 'Tente pesquisar por outro nome ou endereço.' : 'As páginas que você visitar aparecerão aqui.'}</p>`;
    list.appendChild(empty);
    return;
  }

  let previousDay = '';
  filtered.forEach(item => {
    const day = formatDay(item.time);
    if (day !== previousDay) {
      const heading = document.createElement('h2');
      heading.className = 'library-day';
      heading.textContent = day;
      list.appendChild(heading);
      previousDay = day;
    }

    const row = document.createElement('article');
    row.className = 'library-row history-row';

    const favicon = document.createElement('img');
    favicon.className = 'library-favicon';
    favicon.alt = '';
    favicon.loading = 'lazy';
    favicon.src = faviconFor(item.url);
    favicon.addEventListener('error', () => {
      favicon.replaceWith(Object.assign(document.createElement('span'), {
        className: 'library-favicon-fallback',
        textContent: '◎'
      }));
    }, { once: true });

    const info = document.createElement('button');
    info.type = 'button';
    info.className = 'library-item-main';
    const title = document.createElement('span');
    title.className = 'library-item-title';
    title.textContent = item.title || item.url;
    const url = document.createElement('span');
    url.className = 'library-item-subtitle';
    url.textContent = item.url;
    info.append(title, url);
    info.title = 'Abrir esta página';
    info.addEventListener('click', () => {
      closeSpecialPage();
      if (activeTab) activeTab.webview.loadURL(item.url);
      else createTab(item.url, true);
    });

    const time = document.createElement('time');
    time.className = 'library-item-time';
    time.dateTime = new Date(item.time || Date.now()).toISOString();
    time.textContent = new Date(item.time || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'library-icon-button';
    remove.title = 'Remover do histórico';
    remove.setAttribute('aria-label', 'Remover do histórico');
    remove.textContent = '×';
    remove.addEventListener('click', event => {
      event.stopPropagation();
      history = history.filter(entry => entry !== item);
      localStorage.setItem('pybrowser-history', JSON.stringify(history));
      renderHistory();
    });

    row.append(favicon, info, time, remove);
    list.appendChild(row);
  });
}

document.getElementById('history-search')?.addEventListener('input', renderHistory);

document.getElementById('clear-history')?.addEventListener('click', () => {
  history = [];
  localStorage.removeItem('pybrowser-history');
  renderHistory();
});

/* =========================
   DOWNLOADS — dados reais do Electron
========================= */

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Tamanho desconhecido';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${units[unit]}`;
}

function persistDownloads() {
  downloads = downloads.slice(0, 200);
  try {
    localStorage.setItem('pybrowser-downloads', JSON.stringify(downloads));
  } catch (error) {
    console.warn('[YANTUX] Não foi possível salvar downloads:', error);
  }
}

function receiveDownloadUpdate(update) {
  if (!update?.id) return;
  const index = downloads.findIndex(item => item.id === update.id);
  const previous = index >= 0 ? downloads[index] : null;
  const merged = {
    ...(previous || {}),
    ...update,
    time: previous?.time || update.startTime || Date.now()
  };
  if (index >= 0) downloads[index] = merged;
  else downloads.unshift(merged);
  persistDownloads();
  renderDownloads();
  if (document.getElementById('download-mini-popup')?.classList.contains('open')) {
    renderDownloadPopup();
  }
}

if (window.pybrowser?.onDownloadUpdate) {
  window.pybrowser.onDownloadUpdate(receiveDownloadUpdate);
}

function toggleDownloadPopup(event) {
  event?.stopPropagation();
  const popup = document.getElementById('download-mini-popup');
  const button = document.getElementById('py-sidebar-downloads');
  if (!popup) return;

  const willOpen = !popup.classList.contains('open');
  popup.classList.toggle('open', willOpen);
  popup.setAttribute('aria-hidden', String(!willOpen));
  button?.setAttribute('aria-expanded', String(willOpen));

  if (willOpen) {
    menuPopup?.classList.remove('open');
    renderDownloadPopup();
    document.getElementById('download-mini-search')?.focus();
  }
}

function closeDownloadPopup() {
  const popup = document.getElementById('download-mini-popup');
  popup?.classList.remove('open');
  popup?.setAttribute('aria-hidden', 'true');
  document.getElementById('py-sidebar-downloads')?.setAttribute('aria-expanded', 'false');
}

function renderDownloadPopup() {
  const list = document.getElementById('download-mini-list');
  if (!list) return;

  const query = (document.getElementById('download-mini-search')?.value || '')
    .trim().toLocaleLowerCase('pt-BR');
  const filtered = downloads.filter(item =>
    `${item.name || ''} ${item.url || ''}`.toLocaleLowerCase('pt-BR').includes(query)
  );
  const count = document.getElementById('download-mini-count');
  if (count) count.textContent = `${filtered.length} ${filtered.length === 1 ? 'arquivo' : 'arquivos'}`;

  list.replaceChildren();

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'download-mini-empty';
    empty.textContent = query ? 'Nenhum download encontrado.' : 'Seus downloads aparecerão aqui.';
    list.appendChild(empty);
    return;
  }

  filtered.slice(0, 8).forEach(item => {
    const row = document.createElement('article');
    row.className = 'download-mini-item';

    const heading = document.createElement('div');
    heading.className = 'download-mini-item-heading';

    const name = document.createElement('strong');
    name.textContent = item.name || 'Arquivo';
    name.title = item.name || 'Arquivo';

    const percent = document.createElement('span');
    const received = Number(item.receivedBytes) || 0;
    const total = Number(item.totalBytes) || 0;
    const active = item.state === 'downloading' || item.state === 'paused' || item.paused;
    const progress = total > 0 ? Math.min(100, Math.round(received / total * 100)) : (item.state === 'completed' ? 100 : 0);
    percent.textContent = item.state === 'completed' ? '100%' : (total > 0 ? `${progress}%` : (active ? '…' : ''));

    heading.append(name, percent);

    const track = document.createElement('div');
    track.className = 'download-mini-progress';
    const fill = document.createElement('div');
    fill.className = 'download-mini-progress-fill';
    fill.style.width = `${progress}%`;
    if (active && total <= 0 && item.state !== 'paused' && !item.paused) fill.classList.add('is-indeterminate');
    if (item.state === 'interrupted' || item.state === 'cancelled') fill.classList.add('is-failed');
    track.appendChild(fill);

    const detail = document.createElement('div');
    detail.className = 'download-mini-detail';
    if (item.state === 'completed') {
      detail.textContent = `Concluído · ${formatBytes(total || received)}`;
    } else if (item.state === 'paused' || item.paused) {
      detail.textContent = `Pausado · ${formatBytes(received)}${total ? ` de ${formatBytes(total)}` : ''}`;
    } else if (item.state === 'downloading') {
      detail.textContent = `${formatBytes(received)}${total ? ` de ${formatBytes(total)}` : ''} · ${formatBytes(Number(item.speed) || 0)}/s`;
    } else if (item.state === 'interrupted') {
      detail.textContent = `Interrompido · ${formatBytes(received)}`;
    } else if (item.state === 'cancelled') {
      detail.textContent = 'Cancelado';
    } else {
      detail.textContent = new Date(item.time || Date.now()).toLocaleString('pt-BR');
    }

    const actions = document.createElement('div');
    actions.className = 'download-mini-actions';

    const addAction = (label, symbol, callback, disabled = false) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.title = label;
      button.setAttribute('aria-label', label);
      button.textContent = symbol;
      button.disabled = disabled;
      button.addEventListener('click', async event => {
        event.stopPropagation();
        await callback();
        renderDownloadPopup();
      });
      actions.appendChild(button);
    };

    if (item.state === 'downloading' || item.state === 'paused' || item.paused) {
      const paused = item.state === 'paused' || item.paused;
      addAction(paused ? 'Continuar' : 'Pausar', paused ? '▶' : 'Ⅱ',
        () => runDownloadAction(item, paused ? 'resume' : 'pause'), !item.id);
      addAction('Cancelar download', '×', () => runDownloadAction(item, 'cancel'), !item.id);
    } else {
      addAction('Abrir arquivo', '↗', () => runDownloadAction(item, 'open'), !item.savePath);
      addAction('Mostrar na pasta', '▣', () => runDownloadAction(item, 'show'), !item.savePath);
    }

    addAction('Remover da lista', '−', () => {
      downloads = downloads.filter(entry => entry !== item);
      persistDownloads();
    });

    row.append(heading, track, detail, actions);
    list.appendChild(row);
  });

  if (filtered.length > 8) {
    const more = document.createElement('div');
    more.className = 'download-mini-more';
    more.textContent = `Mais ${filtered.length - 8} downloads. Use “Ver todos”.`;
    list.appendChild(more);
  }
}

function openDownloads() {
  closeDownloadPopup();
  menuPopup?.classList.remove('open');
  window.pyPreviousTabId = activeTab?.id ?? window.pyPreviousTabId ?? null;
  downloadsPage.classList.add('open');
  historyPage.classList.remove('open');
  renderDownloads();
  document.getElementById('downloads-search')?.focus();
}

function downloadStatus(item) {
  if (item.state === 'completed') return 'Concluído';
  if (item.state === 'cancelled') return 'Cancelado';
  if (item.state === 'interrupted') return 'Interrompido';
  if (item.state === 'paused' || item.paused) return 'Pausado';
  return 'Baixando';
}

async function runDownloadAction(item, action) {
  if (!window.pybrowser?.downloadAction || !item.id) return;
  const result = await window.pybrowser.downloadAction(item.id, action, item.savePath);
  if (result && result.ok === false) console.warn('[YANTUX] Ação do download falhou:', result.error);
}

function renderDownloads() {
  const list = document.getElementById('downloads-list');
  if (!list) return;
  const query = (document.getElementById('downloads-search')?.value || '').trim().toLocaleLowerCase('pt-BR');
  const filtered = downloads.filter(item =>
    `${item.name || ''} ${item.url || ''}`.toLocaleLowerCase('pt-BR').includes(query)
  );
  const count = document.getElementById('downloads-count');
  if (count) count.textContent = `${filtered.length} ${filtered.length === 1 ? 'arquivo' : 'arquivos'}`;
  list.replaceChildren();

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'library-empty';
    empty.innerHTML = `<div class="library-empty-icon">↓</div><h2>${query ? 'Nenhum arquivo encontrado' : 'Nenhum download ainda'}</h2><p>${query ? 'Tente outra pesquisa.' : 'Quando você baixar um arquivo, o progresso aparecerá aqui.'}</p>`;
    list.appendChild(empty);
    return;
  }

  filtered.forEach(item => {
    const row = document.createElement('article');
    row.className = 'library-row download-row';

    const fileIcon = document.createElement('div');
    fileIcon.className = 'download-file-icon';
    const extension = (item.name || '').split('.').pop().toLowerCase();
    fileIcon.textContent = ({ zip: 'ZIP', rar: 'RAR', '7z': '7Z', pdf: 'PDF', png: 'IMG', jpg: 'IMG', jpeg: 'IMG', mp4: 'VID', mp3: 'AUD', deb: 'DEB', iso: 'ISO' })[extension] || 'FILE';

    const body = document.createElement('div');
    body.className = 'download-main';
    const top = document.createElement('div');
    top.className = 'download-topline';
    const name = document.createElement('strong');
    name.className = 'library-item-title';
    name.textContent = item.name || 'arquivo';
    const percent = document.createElement('span');
    percent.className = 'download-percent';
    const received = Number(item.receivedBytes) || 0;
    const total = Number(item.totalBytes) || 0;
    const hasTotal = total > 0;
    const progress = hasTotal ? Math.min(100, Math.round(received / total * 100)) : (item.state === 'completed' ? 100 : 0);
    percent.textContent = item.state === 'completed' ? '100%' : (hasTotal ? `${progress}%` : (item.state === 'downloading' || item.state === 'paused' ? '…' : ''));

    top.append(name, percent);
    const source = document.createElement('div');
    source.className = 'library-item-subtitle download-source';
    source.textContent = item.url || 'Download antigo';
    const track = document.createElement('div');
    track.className = 'download-progress-track';
    const fill = document.createElement('div');
    fill.className = 'download-progress-fill';
    fill.style.width = `${progress}%`;
    if (!hasTotal && item.state === 'downloading') fill.classList.add('download-indeterminate');
    if (item.state === 'interrupted' || item.state === 'cancelled') fill.classList.add('download-failed');
    track.appendChild(fill);

    const meta = document.createElement('div');
    meta.className = 'download-meta';
    const details = document.createElement('span');
    if (item.state === 'completed') details.textContent = `Concluído · ${formatBytes(total || received)}`;
    else if (item.state === 'downloading' || item.state === 'paused') {
      details.textContent = `${formatBytes(received)}${hasTotal ? ` de ${formatBytes(total)}` : ''} · ${formatBytes(Number(item.speed) || 0)}/s`;
    } else if (item.state === 'interrupted') details.textContent = `Download interrompido · ${formatBytes(received)}`;
    else if (item.state === 'cancelled') details.textContent = 'Download cancelado';
    else details.textContent = new Date(item.time || Date.now()).toLocaleString('pt-BR');
    const status = document.createElement('span');
    status.className = `download-status status-${item.state || 'legacy'}`;
    status.textContent = downloadStatus(item);
    meta.append(details, status);
    body.append(top, source, track, meta);

    const actions = document.createElement('div');
    actions.className = 'download-actions';
    const makeAction = (label, symbol, action, disabled = false) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'library-icon-button';
      button.title = label;
      button.setAttribute('aria-label', label);
      button.textContent = symbol;
      button.disabled = disabled;
      button.addEventListener('click', () => runDownloadAction(item, action));
      actions.appendChild(button);
    };

    if (item.state === 'downloading' || item.state === 'paused') {
      makeAction(item.state === 'paused' || item.paused ? 'Continuar download' : 'Pausar download', item.state === 'paused' || item.paused ? '▶' : 'Ⅱ', item.state === 'paused' || item.paused ? 'resume' : 'pause', !item.id);
      makeAction('Cancelar download', '×', 'cancel', !item.id);
    } else {
      makeAction('Abrir arquivo', '↗', 'open', !item.savePath);
      makeAction('Mostrar na pasta', '▣', 'show', !item.savePath);
    }
    makeAction('Remover da lista', '−', 'remove', false);
    actions.lastChild.addEventListener('click', () => {
      downloads = downloads.filter(entry => entry !== item);
      persistDownloads();
      renderDownloads();
    });

    row.append(fileIcon, body, actions);
    list.appendChild(row);
  });
}


document.getElementById('download-mini-search')?.addEventListener('input', renderDownloadPopup);
document.getElementById('download-mini-close')?.addEventListener('click', closeDownloadPopup);

document.getElementById('download-mini-clear')?.addEventListener('click', () => {
  downloads = [];
  localStorage.removeItem('pybrowser-downloads');
  renderDownloads();
  renderDownloadPopup();
});

document.getElementById('download-mini-all')?.addEventListener('click', openDownloads);

document.addEventListener('click', event => {
  const popup = document.getElementById('download-mini-popup');
  const button = document.getElementById('py-sidebar-downloads');
  if (popup?.classList.contains('open') &&
      !popup.contains(event.target) &&
      !button?.contains(event.target)) {
    closeDownloadPopup();
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeDownloadPopup();
});

document.getElementById('downloads-search')?.addEventListener('input', renderDownloads);

document.getElementById('clear-downloads')?.addEventListener('click', () => {
  downloads = [];
  localStorage.removeItem('pybrowser-downloads');
  renderDownloads();
});

/* =========================
   INICIAR
========================= */

createTab();

/* =========================================================
   PERSONALIZAÇÃO AVANÇADA - PyBrowser
   ========================================================= */

(() => {
  const KEY = 'pybrowser-personalizacao';

  const defaults = {
    theme: 'dark',
    accent: '#8ab4f8',
    transparent: false,
    radius: 10,
    wallpaper: '',
    language: 'pt-BR',

    tabWidth: 180,
    clockStyle: 'digital',
    clockSize: 92,
    clockSeconds: false,
    clockWeight: 700,
    clockPosition: 'center',
    homeAnimations: true,
    animationSpeed: 0.45,
    shortcutPreset: 'modern',
    shortcutSize: 88,
    shortcutGap: 14,
    shortcutIconSize: 32,
    shortcutLabels: true,
    shortcutColumns: 'auto',
    tbHeight:48,tbPadding:10,tbGap:6,tbPosition:'normal',tbShadow:true,
    tbAddressHeight:34,tbAddressWidth:100,tbAddressRadius:12,tbAddressMargin:4,tbAddressFont:13,
    tbButtonSize:32,tbButtonRadius:10,tbIconSize:17,tbButtonStyle:'minimal',
    tbBg:'#202124',tbFg:'#c4c9d2',tbAddressBg:'#303134',tbAddressFg:'#e8eaed',tbBorder:'#45474d',tbFocus:'#8ab4f8',tbHover:'#3b4049',
    tbOpacity:92,tbAddressOpacity:94,tbBlur:16,tbBorderWidth:1,tbGlass:true,tbAddressShadow:12,tbFocusWidth:2,
    tbHideAddress:false,tbHideMenu:false,tbHideSecurity:false,
    toolbarBack:true,toolbarForward:true,toolbarReload:true,toolbarExtensions:true,toolbarStar:true,toolbarSidebar:true,toolbarZoom:true
  };

  let settings = { ...defaults };

  try {
    const local = JSON.parse(
      localStorage.getItem(KEY) || '{}'
    );

    settings = {
      ...defaults,
      ...local
    };
  } catch {}

  if (
    window.pybrowser &&
    typeof window.pybrowser.getSettings === 'function'
  ) {
    window.pybrowser.getSettings()
      .then(saved => {
        if (!saved || typeof saved !== 'object') return;

        let local = {};
        try {
          local = JSON.parse(localStorage.getItem(KEY) || '{}');
        } catch (_) {}

        settings = {
          ...defaults,
          ...local,
          ...saved
        };

        localStorage.setItem(KEY, JSON.stringify(settings));
        apply();
        updateControls();
      })
      .catch(() => {});
  }

  const save = () => {
    console.log('[PY-SETTINGS] SAVE CHAMADO:', settings);
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify(settings)
      );
    } catch {}

    if (
      window.pybrowser &&
      typeof window.pybrowser.saveSettings === 'function'
    ) {
      window.pybrowser.saveSettings(settings)
        .catch(() => {});
    }
  };

  function apply() {
    console.log('[PY-DEBUG] 2 - APPLY CHAMADO', settings.accent);
    const root = document.documentElement;
    const body = document.body;

    // PYBROWSER_THEME_BUTTONS
    body.classList.toggle('light', settings.theme === 'light');
    document.querySelectorAll('.theme-choice').forEach(button => {
      const active = button.dataset.theme === settings.theme;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    root.style.setProperty('--py-accent', settings.accent);
    root.style.setProperty('--py-radius', `${settings.radius}px`);
    settings.tabWidth = 180;
    root.style.setProperty('--py-tab-width', '180px');

    body.classList.toggle(
      'py-transparent-ui',
      settings.transparent
    );
if (settings.wallpaper) {
      body.style.backgroundImage =
        `url("${settings.wallpaper}")`;

      body.classList.add('py-custom-wallpaper');
    } else {
      body.style.backgroundImage = '';
      body.classList.remove('py-custom-wallpaper');
    }

    // YANTUX STUDIO — personalização completa da toolbar real.
    const safeColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
    const num = (value, min, max, fallback) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : fallback));
    const toolbarStyleId = 'yantux-studio-toolbar-style';
    let toolbarStyle = document.getElementById(toolbarStyleId);
    if (!toolbarStyle) { toolbarStyle = document.createElement('style'); toolbarStyle.id = toolbarStyleId; document.head.appendChild(toolbarStyle); }
    const tb = settings;
    const bg = safeColor(tb.tbBg, '#202124'), fg = safeColor(tb.tbFg, '#c4c9d2');
    const addrBg = safeColor(tb.tbAddressBg, '#303134'), addrFg = safeColor(tb.tbAddressFg, '#e8eaed');
    const border = safeColor(tb.tbBorder, '#45474d'), focus = safeColor(tb.tbFocus, '#8ab4f8'), hover = safeColor(tb.tbHover, '#3b4049');
    const glass = Boolean(tb.tbGlass);
    toolbarStyle.textContent = `
      #toolbar{height:${num(tb.tbHeight,36,76,48)}px!important;min-height:${num(tb.tbHeight,36,76,48)}px!important;padding:4px ${num(tb.tbPadding,0,28,10)}px!important;gap:${num(tb.tbGap,0,18,6)}px!important;background:rgba(${parseInt(bg.slice(1,3),16)},${parseInt(bg.slice(3,5),16)},${parseInt(bg.slice(5,7),16)},${num(tb.tbOpacity,35,100,92)/100})!important;backdrop-filter:${glass ? `blur(${num(tb.tbBlur,0,30,16)}px) saturate(140%)` : 'none'}!important;border-bottom:${num(tb.tbBorderWidth,0,3,1)}px solid ${border}!important;box-shadow:${tb.tbShadow ? '0 5px 18px rgba(0,0,0,.18)' : 'none'}!important;position:relative!important;z-index:20!important}
      #address-container{height:${num(tb.tbAddressHeight,28,58,34)}px!important;max-width:${num(tb.tbAddressWidth,40,100,100)}%!important;margin-left:${num(tb.tbAddressMargin,0,24,4)}px!important;margin-right:${num(tb.tbAddressMargin,0,24,4)}px!important;border-radius:${num(tb.tbAddressRadius,0,30,12)}px!important;background:rgba(${parseInt(addrBg.slice(1,3),16)},${parseInt(addrBg.slice(3,5),16)},${parseInt(addrBg.slice(5,7),16)},${num(tb.tbAddressOpacity,35,100,94)/100})!important;border:${num(tb.tbBorderWidth,0,3,1)}px solid ${border}!important;box-shadow:0 ${Math.round(num(tb.tbAddressShadow,0,32,12)/3)}px ${num(tb.tbAddressShadow,0,32,12)}px rgba(0,0,0,.18)!important;backdrop-filter:${glass ? `blur(${num(tb.tbBlur,0,30,16)}px)` : 'none'}!important;${tb.tbPosition === 'center' ? 'position:absolute!important;left:50%!important;transform:translateX(-50%)!important;width:48%!important;flex:none!important;' : ''}}
      #address{font-size:${num(tb.tbAddressFont,11,18,13)}px!important;color:${addrFg}!important}#address::placeholder{color:${fg}aa!important}#address-container:focus-within{border-color:${focus}!important;box-shadow:0 0 0 ${num(tb.tbFocusWidth,0,4,2)}px ${focus}55,0 4px ${num(tb.tbAddressShadow,0,32,12)}px rgba(0,0,0,.16)!important}
      #toolbar .nav-buttons button,#toolbar button#menu,#toolbar #extensions,#toolbar #star,#toolbar #py-sidebar-toolbar,#toolbar #toolbar-zoom{width:${num(tb.tbButtonSize,24,48,32)}px!important;height:${num(tb.tbButtonSize,24,48,32)}px!important;min-width:${num(tb.tbButtonSize,24,48,32)}px!important;border-radius:${num(tb.tbButtonRadius,0,24,10)}px!important;color:${fg}!important;${tb.tbButtonStyle === 'filled' ? `background:${hover}!important;` : ''}${tb.tbButtonStyle === 'outlined' ? `border:1px solid ${border}!important;` : 'border:1px solid transparent!important;'}}
      #toolbar button:hover{background:${hover}!important;color:${addrFg}!important}#toolbar button svg,#toolbar button img{width:${num(tb.tbIconSize,12,26,17)}px!important;height:${num(tb.tbIconSize,12,26,17)}px!important;max-width:${num(tb.tbIconSize,12,26,17)}px!important;max-height:${num(tb.tbIconSize,12,26,17)}px!important}
      ${tb.tbHideAddress ? '#address-container{display:none!important}' : ''}${tb.tbHideMenu ? '#menu{display:none!important}' : ''}${tb.tbHideSecurity ? '#security{display:none!important}' : ''}
      ${tb.toolbarBack === false ? '#back{display:none!important}' : ''}${tb.toolbarForward === false ? '#forward{display:none!important}' : ''}${tb.toolbarReload === false ? '#reload{display:none!important}' : ''}${tb.toolbarExtensions === false ? '#extensions{display:none!important}' : ''}${tb.toolbarStar === false ? '#star{display:none!important}' : ''}${tb.toolbarSidebar === false ? '#py-sidebar-toolbar{display:none!important}' : ''}${tb.toolbarZoom === false ? '#toolbar-zoom{display:none!important}' : ''}
    `;

    updateControls();

    // Atualiza a Home imediatamente
    tabs.forEach(tab => {
      if (!tab.webview) return;

      try {
        if (tab.webview.getURL().includes('home.html')) {
          console.log('[PY-DEBUG] 3 - HOME ENCONTRADA:', tab.webview.getURL());
          const accent = settings.accent;
          const wallpaper = settings.wallpaper || '';
          const shortcutOptions = {
            preset: settings.shortcutPreset,
            size: settings.shortcutSize,
            gap: settings.shortcutGap,
            iconSize: settings.shortcutIconSize,
            labels: settings.shortcutLabels,
            columns: settings.shortcutColumns
          };

          const js = `
            (() => {
              const root = document.documentElement;
              const body = document.body;

              root.style.setProperty('--accent', ${JSON.stringify(accent)});
              body.classList.toggle('light', ${JSON.stringify(settings.theme === 'light')});

              if (${JSON.stringify(wallpaper)}) {
                body.style.backgroundImage =
                  'linear-gradient(rgba(10,10,12,.38), rgba(10,10,12,.38)), url("' +
                  ${JSON.stringify(wallpaper)}.replace(/"/g, '\\\"') +
                  '")';
                body.style.backgroundSize = 'cover';
                body.style.backgroundPosition = 'center';
                body.style.backgroundAttachment = 'fixed';
              } else {
                body.style.backgroundImage = '';
              }

              if (typeof applyShortcutSettings === 'function') {
                applyShortcutSettings(${JSON.stringify(shortcutOptions)});
              }

              if (typeof applyClockSettings === 'function') {
                applyClockSettings();
                updateClock();
              }
            })();
          `;

          console.log('[PY-DEBUG] 4 - ENVIANDO PARA HOME:', accent);
          tab.webview.executeJavaScript(js, true)
            .then(() => console.log('[PY-DEBUG] 5 - HOME RECEBEU'))
            .catch(err => console.error('[PY-DEBUG] 5 - ERRO HOME:', err));
        }
      } catch {}
    });
  }

  function updateControls() {
    const accent = document.querySelector('#py-accent-color');
    const transparent = document.querySelector('#py-transparent');
    const radius = document.querySelector('#py-radius');
    const language = document.querySelector('#py-language');
    const width = document.querySelector('#py-tab-width');
    const preview = document.querySelector('#py-wallpaper-preview');
    const shortcutPreset = document.querySelector('#py-shortcut-preset');
    const shortcutSize = document.querySelector('#py-shortcut-size');
    const shortcutGap = document.querySelector('#py-shortcut-gap');
    const shortcutIconSize = document.querySelector('#py-shortcut-icon-size');
    const shortcutLabels = document.querySelector('#py-shortcut-labels');
    const shortcutColumns = document.querySelector('#py-shortcut-columns');

    if (shortcutPreset) shortcutPreset.value = settings.shortcutPreset;
    if (shortcutSize) shortcutSize.value = settings.shortcutSize;
    if (shortcutGap) shortcutGap.value = settings.shortcutGap;
    if (shortcutIconSize) shortcutIconSize.value = settings.shortcutIconSize;
    if (shortcutLabels) shortcutLabels.checked = settings.shortcutLabels;
    if (shortcutColumns) shortcutColumns.value = settings.shortcutColumns;

    if (accent) accent.value = settings.accent;
    if (transparent) transparent.checked = settings.transparent;
    if (radius) radius.value = settings.radius;
    if (language) language.value = settings.language;
    if (width) width.value = 180;

    if (preview && settings.wallpaper) {
      preview.style.backgroundImage =
        `url("${settings.wallpaper}")`;
    }
  }

  function setup() {
    const accent = document.querySelector('#py-accent-color');
    const transparent = document.querySelector('#py-transparent');
    const radius = document.querySelector('#py-radius');
    const language = document.querySelector('#py-language');
    const width = document.querySelector('#py-tab-width');
    const clockStyle = document.querySelector('#py-clock-style');
    const clockSize = document.querySelector('#py-clock-size');
    const clockSeconds = document.querySelector('#py-clock-seconds');
    const clockWeight = document.querySelector('#py-clock-weight');
    const clockPosition = document.querySelector('#py-clock-position');
    const homeAnimations = document.querySelector('#py-home-animations');
    const animationSpeed = document.querySelector('#py-animation-speed');

    // PYBROWSER_THEME_BUTTONS
    document.querySelectorAll('.theme-choice').forEach(button => {
      button.addEventListener('click', () => {
        const theme = button.dataset.theme;
        if (theme !== 'light' && theme !== 'dark') return;
        settings.theme = theme;
        save();
        apply();
      });
    });

    const shortcutPreset = document.querySelector('#py-shortcut-preset');
    const shortcutSize = document.querySelector('#py-shortcut-size');
    const shortcutGap = document.querySelector('#py-shortcut-gap');
    const shortcutIconSize = document.querySelector('#py-shortcut-icon-size');
    const shortcutLabels = document.querySelector('#py-shortcut-labels');
    const shortcutColumns = document.querySelector('#py-shortcut-columns');

    const wallpaper = document.querySelector('#py-wallpaper');
    const resetWallpaper =
      document.querySelector('#py-reset-wallpaper');

    if (accent) {
      accent.addEventListener('input', e => {
        console.log('[PY-DEBUG] 1 - COR ALTERADA:', e.target.value);
        settings.accent = e.target.value;
        save();
        apply();
      });
    }

    if (transparent) {
      transparent.addEventListener('change', e => {
        settings.transparent = e.target.checked;
        save();
        apply();
      });
    }

    if (radius) {
      radius.addEventListener('input', e => {
        settings.radius = Number(e.target.value);
        save();
        apply();
      });
    }

    if (language) {
      language.addEventListener('change', e => {
        settings.language = e.target.value;
        save();

        // Mantém o idioma escolhido salvo.
        // A tradução completa será ligada na próxima etapa.
        apply();
      });
    }

    if (width) {
      width.addEventListener('input', e => {
        settings.tabWidth = Number(e.target.value);
        save();
        apply();
      });
    }


    if (clockStyle) {
      clockStyle.value = settings.clockStyle;
      clockStyle.addEventListener('change', e => {
        settings.clockStyle = e.target.value;
        save();
        apply();
      });
    }

    if (clockSize) {
      clockSize.value = settings.clockSize;
      clockSize.addEventListener('input', e => {
        settings.clockSize = Number(e.target.value);
        save();
        apply();
      });
    }

    if (clockSeconds) {
      clockSeconds.checked = settings.clockSeconds;
      clockSeconds.addEventListener('change', e => {
        settings.clockSeconds = e.target.checked;
        save();
        apply();
      });
    }

    if (clockWeight) {
      clockWeight.value = settings.clockWeight;
      clockWeight.addEventListener('change', e => {
        settings.clockWeight = Number(e.target.value);
        save();
        apply();
      });
    }

    if (clockPosition) {
      clockPosition.value = settings.clockPosition;
      clockPosition.addEventListener('change', e => {
        settings.clockPosition = e.target.value;
        save();
        apply();
      });
    }

    if (homeAnimations) {
      homeAnimations.checked = settings.homeAnimations;
      homeAnimations.addEventListener('change', e => {
        settings.homeAnimations = e.target.checked;
        save();
        apply();
      });
    }

    if (animationSpeed) {
      animationSpeed.value = settings.animationSpeed;
      animationSpeed.addEventListener('input', e => {
        settings.animationSpeed = Number(e.target.value);
        save();
        apply();
      });
    }

    const bindShortcutSetting = (element, key, convert = value => value) => {
      if (!element) return;
      element.value = settings[key] ?? defaults[key];
      element.addEventListener('input', e => {
        settings[key] = convert(e.target.value);
        save();
        apply();
      });
      element.addEventListener('change', e => {
        settings[key] = convert(e.target.value);
        save();
        apply();
      });
    };

    bindShortcutSetting(shortcutPreset, 'shortcutPreset');
    bindShortcutSetting(shortcutSize, 'shortcutSize', Number);
    bindShortcutSetting(shortcutGap, 'shortcutGap', Number);
    bindShortcutSetting(shortcutIconSize, 'shortcutIconSize', Number);
    bindShortcutSetting(shortcutColumns, 'shortcutColumns');

    if (shortcutLabels) {
      shortcutLabels.checked = settings.shortcutLabels;
      shortcutLabels.addEventListener('change', e => {
        settings.shortcutLabels = e.target.checked;
        save();
        apply();
      });
    }

    if (wallpaper) {
      wallpaper.addEventListener('change', e => {
        const file = e.target.files?.[0];

        if (!file) return;

        const reader = new FileReader();

        reader.onload = () => {
          settings.wallpaper = reader.result;
          save();
          apply();
        };

        reader.readAsDataURL(file);
      });
    }

    if (resetWallpaper) {
      resetWallpaper.addEventListener('click', () => {
        settings.wallpaper = '';
        save();
        apply();

        if (wallpaper) {
          wallpaper.value = '';
        }

        const preview =
          document.querySelector('#py-wallpaper-preview');

        if (preview) {
          preview.style.backgroundImage = '';
        }
      });
    }

    apply();

  const saveSettingsButton =
    document.querySelector('#save-settings');

  if (saveSettingsButton) {
    saveSettingsButton.addEventListener('click', async () => {
      console.log('[PY-SETTINGS] Salvando e aplicando configurações...');

      try {
        await window.pybrowser.saveSettings(settings);
      await window.pybrowser.reloadBrowser();
        apply();

        tabs.forEach(tab => {
          if (!tab.webview) return;

          try {
            const url = tab.webview.getURL();

            if (url && url !== 'about:blank') {
              tab.webview.reload();
            }
          } catch {}
        });

        console.log('[PY-SETTINGS] Configurações aplicadas sem recarregar.');
      } catch (error) {
        console.error(
          '[PY-SETTINGS] Erro ao salvar:',
          error
        );
      }
    });
  }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();


/* =====================================================
   PYBROWSER — BARRA LATERAL
===================================================== */

function openPinnedSitePanel(url, name = 'Site') {
  const sidebar = document.getElementById('py-sidebar');
  const content = document.getElementById('py-sidebar-panel-content');
  const title = document.getElementById('py-sidebar-panel-title');

  if (!sidebar || !content) return;

  sidebar.classList.add('sidebar-panel-open');

  if (title) {
    title.textContent = name;
  }

  content.innerHTML = '';

  const webview = document.createElement('webview');

  webview.className = 'py-sidebar-webview';
  if (/yantux-control\.html/.test(url)) {
    webview.setAttribute('preload', new URL('control-preload.js', window.location.href).href);
    webview.addEventListener('ipc-message', e => {
      if (e.channel === 'yantux-profile') yxApplyProfile(e.args[0]);
    });
  }
  webview.src = url;
  webview.setAttribute('allowpopups', '');
  webview.setAttribute('disablewebsecurity', '');

  content.appendChild(webview);

  webview.addEventListener('dom-ready', () => {
    webview.setZoomFactor(1);
  }, { once: true });
}

function closePinnedSitePanel() {
  const sidebar = document.getElementById('py-sidebar');
  const content = document.getElementById('py-sidebar-panel-content');

  if (!sidebar?.classList.contains('sidebar-panel-open')) return;

  sidebar.classList.remove('sidebar-panel-open');

  setTimeout(() => {
    if (!sidebar.classList.contains('sidebar-panel-open') && content) {
      content.innerHTML = '';
    }
  }, 370);
}

function pyAskSiteUrl(callback) {
  const overlay = document.createElement('div');

  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,.45);
  `;

  overlay.innerHTML = `
    <div style="
      width: 360px;
      padding: 20px;
      box-sizing: border-box;
      border-radius: 12px;
      background: #292b32;
      border: 1px solid #3a3d46;
      box-shadow: 0 20px 60px rgba(0,0,0,.5);
      color: #fff;
      font-family: sans-serif;
    ">
      <div style="
        font-size: 15px;
        font-weight: 600;
        margin-bottom: 12px;
      ">Adicionar site</div>

      <input
        id="py-site-url-input"
        type="text"
        placeholder="https://exemplo.com"
        style="
          width: 100%;
          box-sizing: border-box;
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid #454954;
          background: #202124;
          color: #fff;
          outline: none;
        "
      >

      <div style="
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 14px;
      ">
        <button id="py-site-cancel" style="
          padding: 8px 14px;
          border: 0;
          border-radius: 7px;
          background: #3a3d46;
          color: #ddd;
          cursor: pointer;
        ">Cancelar</button>

        <button id="py-site-ok" style="
          padding: 8px 14px;
          border: 0;
          border-radius: 7px;
          background: #4b8cff;
          color: #fff;
          cursor: pointer;
        ">Adicionar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const input = overlay.querySelector('#py-site-url-input');
  const cancel = overlay.querySelector('#py-site-cancel');
  const ok = overlay.querySelector('#py-site-ok');

  const close = value => {
    overlay.remove();
    callback(value);
  };

  input.focus();

  cancel.addEventListener('click', () => close(null));

  ok.addEventListener('click', () => {
    close(input.value.trim() || null);
  });

  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      ok.click();
    }

    if (event.key === 'Escape') {
      cancel.click();
    }
  });
}

function setupPySidebar() {
  console.log('[PY-SIDEBAR-TEST] setup executou');
  const sidebar = document.getElementById('py-sidebar');
  console.log('[PY-SIDEBAR] setup:', !!sidebar);
  if (!sidebar) return;

  const close = document.getElementById('py-sidebar-close');
  const toolbarButton = document.getElementById('py-sidebar-toolbar');
  const toggle = document.getElementById('py-sidebar-toggle');
  const add = document.getElementById('py-sidebar-add');

  console.log('[PY-SIDEBAR] add:', !!add);
  console.log('[PY-SIDEBAR] new:', !!document.getElementById('py-sidebar-new'));
  console.log('[PY-SIDEBAR] toggle:', !!toggle);
  const pinned = document.getElementById('py-pinned-sites');

  const STORAGE_KEY = 'pybrowser-pinned-sites';

  function loadSites() {
    try {
      return JSON.parse(
        localStorage.getItem(STORAGE_KEY) || '[]'
      );
    } catch {
      return [];
    }
  }

  function saveSites(sites) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(sites)
    );
  }

  function favicon(url) {
    return 'https://www.google.com/s2/favicons?sz=128&domain_url=' +
      encodeURIComponent(url);
  }

  function renderSites() {
    if (!pinned) return;

    pinned.innerHTML = '';

    loadSites().forEach(site => {
      const button = document.createElement('button');

      button.className = 'py-pinned-site';
      button.title = site.url;

      const img = document.createElement('img');
      img.src = favicon(site.url);
      img.alt = '';
      console.log('[PY-FAVICON]', site.url, '->', img.src);
      img.onload = () => console.log('[PY-FAVICON-OK]', img.src, img.naturalWidth, img.naturalHeight);
      img.onerror = () => console.log('[PY-FAVICON-ERRO]', img.src);
      img.onerror = () => {
        img.onerror = null;
        img.src =
          'https://www.google.com/s2/favicons?sz=128&domain_url=' +
          encodeURIComponent(site.url);
      };

      const name = document.createElement('span');
      name.textContent = site.name || site.url;

      button.append(img, name);

      button.addEventListener('click', () => {
        openPinnedSitePanel(
          site.url,
          site.name || site.url
        );
      });

      button.addEventListener('contextmenu', event => {
        event.preventDefault();
        event.stopPropagation();
      });

      pinned.appendChild(button);
    });
  }

  toolbarButton?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  toggle?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  close?.addEventListener('click', () => {
    sidebar.classList.remove('open');
  });

  const addSite = () => {
    pyAskSiteUrl(url => {
      if (!url) return;

    let finalUrl = url.trim();

    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }

    let name;

    try {
      name = new URL(finalUrl).hostname
        .replace(/^www\./, '');
    } catch {
      name = finalUrl;
    }

    const sites = loadSites();

    if (
      sites.some(
        site => site.url === finalUrl
      )
    ) {
      return;
    }

    sites.push({
      name,
      url: finalUrl
    });

    saveSites(sites);
    renderSites();
    });
  };

  add?.addEventListener('click', addSite);
  document.getElementById('py-sidebar-control')?.addEventListener('click', () => {
    openPinnedSitePanel('yantux-control.html', 'Yantux Control');
  });
  document.getElementById('py-sidebar-new')?.addEventListener(
    'click',
    addSite
  );

  document.getElementById('py-sidebar-history')?.addEventListener('click', (event) => {
    event.preventDefault();
    openHistory();
  });


  document.getElementById('py-sidebar-private')?.addEventListener('click', () => {
    console.log('[PY-SIDEBAR] Clique em Privada');
    createTab(
      new URL('home.html', window.location.href).href,
      true,
      true
    );
  });

  renderSites();
}

console.log('[TRACE] antes do setupPySidebar');

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupPySidebar, { once: true });
} else {
  setupPySidebar();
}

console.log('[TRACE] depois do setupPySidebar');


/* =====================================================
   PYBROWSER — BARRA LATERAL
===================================================== */

setTimeout(() => {
  const nav = document.querySelector('.nav-buttons');
  const address = document.getElementById('address-container');

  if (nav && address) {
    const n = nav.getBoundingClientRect();
    const a = address.getBoundingClientRect();

    console.log('[PY-ALIGN] nav-left:', n.left, 'nav-width:', n.width);
    console.log('[PY-ALIGN] address-left:', a.left, 'address-width:', a.width);
  }
}, 2000);

setTimeout(() => {
  const nav = document.querySelector('.nav-buttons');
  const address = document.getElementById('address-container');

  if (nav && address) {
    console.log('[PY-ALIGN] nav:', nav.getBoundingClientRect().toJSON());
    console.log('[PY-ALIGN] address:', address.getBoundingClientRect().toJSON());
  }
}, 2000);

setTimeout(() => {
  const sidebar = document.getElementById('py-sidebar');
  const actions = document.querySelector('.py-sidebar-actions');
  const button = document.querySelector('.py-sidebar-actions button');

  if (sidebar && actions && button) {
    const s = sidebar.getBoundingClientRect();
    const a = actions.getBoundingClientRect();
    const b = button.getBoundingClientRect();

    console.log(
      '[PY-SIDEBAR-ALIGN]',
      'sidebar-left:', s.left,
      'actions-left:', a.left,
      'button-left:', b.left,
      'sidebar-width:', s.width,
      'actions-width:', a.width
    );
  }
}, 2000);

/* Zoom com Ctrl + roda do mouse */
document.addEventListener('wheel', (event) => {
  if (!event.ctrlKey) return;

  const webview = event.target.closest?.('webview');
  if (!webview) return;

  event.preventDefault();

  const step = event.deltaY < 0 ? 0.1 : -0.1;
  const current = webview.getZoomFactor?.() ?? zoom;
  const next = Math.min(2, Math.max(0.5, current + step));

  webview.setZoomFactor(next);
  if (webview === activeTab?.webview) {
    zoom = next;
    const label = document.getElementById('zoom-value');
    if (label) label.textContent = Math.round(next * 100) + '%';
  }
}, { passive: false });


/* Controles de zoom da toolbar — sem dependências indefinidas */
function changeZoom(amount) {
  const webview = activeTab?.webview;
  if (!webview) return;

  const current = webview.getZoomFactor?.() ?? zoom ?? 1;
  const next = Math.min(2, Math.max(0.5, current + amount));

  webview.setZoomFactor(next);
  zoom = next;

  const value = Math.round(next * 100) + '%';
  const zoomLabel = document.getElementById('zoom-value');
  const toolbarValue = document.getElementById('toolbar-zoom-value');

  if (zoomLabel) zoomLabel.textContent = value;
  if (toolbarValue) toolbarValue.textContent = value;
}

document.getElementById('toolbar-zoom-in')?.addEventListener('click', () => changeZoom(0.1));
document.getElementById('toolbar-zoom-out')?.addEventListener('click', () => changeZoom(-0.1));





setTimeout(() => {
  const sidebar = document.getElementById('py-sidebar');
  const actions = sidebar?.querySelector('.py-sidebar-actions');
  const button = document.getElementById('py-sidebar-downloads');

  console.log('[DOWNLOADS DEBUG]', {
    sidebarExiste: !!sidebar,
    actionsExiste: !!actions,
    botaoExiste: !!button,
    sidebar: sidebar?.getBoundingClientRect().toJSON(),
    actions: actions?.getBoundingClientRect().toJSON(),
    botao: button?.getBoundingClientRect().toJSON(),
    estilo: button ? {
      display: getComputedStyle(button).display,
      visibility: getComputedStyle(button).visibility,
      opacity: getComputedStyle(button).opacity,
      color: getComputedStyle(button).color,
      largura: getComputedStyle(button).width,
      altura: getComputedStyle(button).height
    } : null
  });
}, 3000);

/* ===== ATALHOS DO NAVEGADOR (eventos vindos do main.js) ===== */
(() => {
  const closedTabs = [];

  // guarda a URL de toda aba fechada (atalho ou botao X) para Ctrl+Shift+T
  const originalCloseTab = closeTab;
  closeTab = function (id) {
    try {
      const t = tabs.find(x => x.id === id);
      const u = t && t.webview && t.webview.getURL();
      if (u && !u.includes('home.html')) {
        closedTabs.push(u);
        if (closedTabs.length > 20) closedTabs.shift();
      }
    } catch (_) {}
    return originalCloseTab(id);
  };

  function goToTab(index) {
    if (!tabs.length) return;
    const n = tabs.length;
    const target = tabs[((index % n) + n) % n];
    if (target) activateTab(target.id);
  }

  window.addEventListener('yantux-shortcut', e => {
    const a = e.detail;
    const cur = tabs.indexOf(activeTab);

    if (a === 'new-tab') createTab();
    else if (a === 'close-tab') { if (activeTab) closeTab(activeTab.id); }
    else if (a === 'reopen-tab') { const u = closedTabs.pop(); if (u) createTab(u); }
    else if (a === 'next-tab') goToTab(cur + 1);
    else if (a === 'prev-tab') goToTab(cur - 1);
    else if (a === 'focus-address') {
      const el = document.getElementById('address');
      if (el) { el.focus(); el.select(); }
    }
    else if (a === 'reload') { try { activeTab && activeTab.webview.reload(); } catch (_) {} }
    else if (a === 'zoom-in') changeZoom(0.1);
    else if (a === 'zoom-out') changeZoom(-0.1);
    else if (a === 'zoom-reset') {
      const cz = (activeTab && activeTab.webview.getZoomFactor && activeTab.webview.getZoomFactor()) || 1;
      changeZoom(1 - cz);
    }
    else if (/^tab-[1-9]$/.test(a)) {
      const n = Number(a.slice(4));
      goToTab(n === 9 ? tabs.length - 1 : n - 1);
    }
  });
})();

/* ===== PERFIS DE DESEMPENHO (Yantux Control) ===== */
function yxEcoHome(wv) {
  try {
    if (!wv.getURL().includes('home.html')) return;
    const on = document.body.classList.contains('yx-eco');
    wv.executeJavaScript(
      "(()=>{let s=document.getElementById('yx-eco-style');" +
      "if(" + on + "){if(!s){s=document.createElement('style');s.id='yx-eco-style';" +
      "s.textContent='*,*::before,*::after{animation:none!important;transition:none!important;backdrop-filter:none!important}';" +
      "document.head.appendChild(s)}}else if(s){s.remove()}})()"
    ).catch(() => {});
  } catch (_) {}
}

function yxApplyProfile(name) {
  if (!['economico', 'equilibrado', 'desempenho'].includes(name)) return;
  try { localStorage.setItem('yantux-profile-host', name); } catch (_) {}
  document.body.classList.toggle('yx-eco', name === 'economico');
  document.body.classList.toggle('yx-perf', name === 'desempenho');
  document.querySelectorAll('webview').forEach(yxEcoHome);
}

// abas novas da home tambem recebem o perfil
document.addEventListener('dom-ready', e => {
  if (e.target && e.target.tagName === 'WEBVIEW') yxEcoHome(e.target);
}, true);

yxApplyProfile(localStorage.getItem('yantux-profile-host') || 'equilibrado');

/* ===== sincroniza o tema do app com o sistema de cores das paginas ===== */
(() => {
  const api = window.pybrowser;
  if (!api || typeof api.themeSet !== 'function') return;
  let last = null;
  const sync = () => {
    const t = document.body.classList.contains('light') ? 'light' : 'dark';
    if (t !== last) { last = t; api.themeSet(t); }
  };
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  sync();
})();


(async () => {
  try {
    const settings = await window.pybrowser.getSettings();
    applySidebarIconsTopRight(!!settings.sidebarIconsTopRight);
  } catch (e) {
    console.warn('[PY-SIDEBAR] Não foi possível carregar a preferência:', e);
  }
})();



window.pybrowser?.getSettings?.().then(settings => {
  applySidebarIconsTopRight(!!settings?.sidebarIconsTopRight);
}).catch(console.error);

window.pybrowser?.onSidebarIconsTopRight?.((enabled) => {
  applySidebarIconsTopRight(Boolean(enabled));
});


// Posição dos ícones da barra lateral, controlada pelo Studio.
(async () => {
  try {
    const settings = await window.pybrowser.getSettings();
    applySidebarIconsTopRight(Boolean(settings?.sidebarIconsTopRight));
  } catch (error) {
    console.warn('Não foi possível carregar a posição dos ícones:', error);
  }
})();

window.pybrowser?.onSidebarIconsTopRight?.((enabled) => {
  applySidebarIconsTopRight(Boolean(enabled));
});




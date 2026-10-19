const {
  app,
  BrowserWindow,
  ipcMain,
  webContents,
  dialog,
  shell,
  session
} = require('electron');

const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const appIconPath = path.join(__dirname, 'build', 'icon.png');
app.setName('Yantux Plus');

if (fs.existsSync(appIconPath)) {
  console.log('[YANTUX ICON] Ícone encontrado:', appIconPath);
} else {
  console.error('[YANTUX ICON] ERRO: ícone não encontrado:', appIconPath);
}


let mainWindow;

const yxThumbnailDir = path.join(__dirname, 'thumbnails');
let yxThumbnailQueue = Promise.resolve();

ipcMain.handle('yx-thumbnail-generate', async (_event, rawUrl) => {
  let target;
  try {
    target = new URL(String(rawUrl));
    if (!['http:', 'https:'].includes(target.protocol)) return false;
  } catch {
    return false;
  }

  const file = path.join(
    yxThumbnailDir,
    encodeURIComponent(target.hostname) + '.jpg'
  );

  // Reaproveita miniaturas recentes para evitar trabalho repetido.
  try {
    const stat = fs.statSync(file);
    if (Date.now() - stat.mtimeMs < 24 * 60 * 60 * 1000) return true;
  } catch {}

  const task = async () => {
    let preview;
    try {
      fs.mkdirSync(yxThumbnailDir, { recursive: true });

      preview = new BrowserWindow({
        width: 1000,
        height: 650,
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true
        }
      });

      await Promise.race([
        preview.loadURL(target.href),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Tempo limite')), 20000)
        )
      ]);

      // Dá tempo para o site desenhar o conteúdo antes da captura.
      await new Promise(resolve => setTimeout(resolve, 1800));

      if (preview.isDestroyed()) return false;
      const image = await preview.webContents.capturePage();
      if (image.isEmpty()) return false;

      fs.writeFileSync(file, image.toJPEG(78));
      return true;
    } catch (error) {
      console.warn('[YX-THUMBNAIL] Falha:', target.hostname, error.message);
      return false;
    } finally {
      if (preview && !preview.isDestroyed()) preview.close();
    }
  };

  const result = yxThumbnailQueue.then(task, task);
  yxThumbnailQueue = result.then(() => undefined, () => undefined);
  return result;
});


ipcMain.handle('yantux-control-memory', () => ({ memory: process.memoryUsage(), processes: app.getAppMetrics() }));

const zoomLevels = new Map();


function setupContextMenu(contents) {
  if (!contents || contents.isDestroyed()) return;

  contents.on('context-menu', async (event, params) => {
    const { clipboard, dialog, screen } = require('electron');
    const items = [];
    const add = (label, click, enabled = true) =>
      items.push({ label, click, enabled });
    const sep = () => {
      if (items.length && items[items.length - 1].type !== 'separator') {
        items.push({ type: 'separator' });
      }
    };

    const openInNewTab = (url) => {
      if (!url || !mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send('context-open-link', url);
    };

    if (params.hasImageContents && params.srcURL) {
      add('Abrir imagem em nova aba', () => openInNewTab(params.srcURL));
      add('Copiar endereço da imagem', () => clipboard.writeText(params.srcURL));
      add('Salvar imagem como…', () => contents.downloadURL(params.srcURL));
      sep();
    }

    if (params.linkURL) {
      add('Abrir link em nova aba', () => openInNewTab(params.linkURL));
      add('Copiar endereço do link', () => clipboard.writeText(params.linkURL));
      add('Baixar link', () => contents.downloadURL(params.linkURL));
      sep();
    }

    if (params.isEditable) {
      add('Desfazer', () => contents.undo());
      add('Refazer', () => contents.redo());
      sep();
      add('Recortar', () => contents.cut());
      add('Copiar', () => contents.copy());
      add('Colar', () => contents.paste());
      add('Selecionar tudo', () => contents.selectAll());
      sep();
    } else if (params.selectionText) {
      add('Copiar', () => clipboard.writeText(params.selectionText));
      add('Pesquisar texto no Google', () => {
        openInNewTab(
          'https://www.google.com/search?q=' +
          encodeURIComponent(params.selectionText)
        );
      });
      sep();
    }

    add('Voltar', () => contents.goBack(), contents.canGoBack());
    add('Avançar', () => contents.goForward(), contents.canGoForward());
    add('Recarregar', () => contents.reload());
    add('Selecionar tudo', () => contents.selectAll());
    add('Salvar página como…', async () => {
      try {
        const result = await dialog.showSaveDialog(mainWindow, {
          title: 'Salvar página',
          defaultPath: 'pagina.html',
          filters: [{ name: 'Página HTML', extensions: ['html'] }]
        });
        if (result.canceled || !result.filePath) return;
        await contents.savePage(result.filePath, 'HTMLComplete');
      } catch (error) {
        console.error('Erro ao salvar página:', error);
      }
    });
    sep();

    add('Inspecionar elemento', () => {
      if (!contents.isDestroyed()) {
        contents.inspectElement(params.x, params.y);
      }
    });

    if (!mainWindow || mainWindow.isDestroyed()) return;

    // Busca as cores salvas no personalizador do Yantux.
    const readTheme = `(() => {
      try {
        const raw = localStorage.getItem('pybrowser-personalizacao');
        if (!raw) return null;
        const s = JSON.parse(raw);
        return {
          bg: s.bg, card: s.card, text: s.text,
          accent: s.accent, border: s.border
        };
      } catch (_) { return null; }
    })()`;

    let theme = null;
    const candidates = [contents, ...webContents.getAllWebContents()];

    for (const candidate of candidates) {
      if (!candidate || candidate.isDestroyed()) continue;
      try {
        theme = await candidate.executeJavaScript(readTheme);
        if (theme && theme.bg && theme.text) break;
      } catch (_) {}
    }

    const validColor = (value, fallback) =>
      /^#[0-9a-f]{6}$/i.test(String(value || ''))
        ? value : fallback;

    const bg = validColor(theme && theme.card, '#292a2d');
    const fg = validColor(theme && theme.text, '#e8eaed');
    const accent = validColor(theme && theme.accent, '#aaaaaa');
    const border = validColor(theme && theme.border, '#454545');

    const escapeHtml = value => String(value).replace(
      /[&<>"']/g,
      ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;',
        '"': '&quot;', "'": '&#39;'
      })[ch]
    );

    const body = items.map((item, index) => {
      if (item.type === 'separator') {
        return '<div class="separator"></div>';
      }
      return '<button data-index="' + index + '"' +
        (item.enabled === false ? ' disabled' : '') + '>' +
        escapeHtml(item.label) + '</button>';
    }).join('');

    // Fecha um menu anterior antes de abrir outro.
    if (globalThis.__yantuxContextPopup &&
        !globalThis.__yantuxContextPopup.isDestroyed()) {
      globalThis.__yantuxContextPopup.close();
    }

    const point = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(point);
    const area = display.workArea;
    const width = 270;
    const height = Math.min(
      Math.max(80, items.reduce(
        (sum, item) => sum + (item.type === 'separator' ? 9 : 34), 16
      )),
      Math.max(120, area.height - 20)
    );
    const x = Math.max(area.x, Math.min(point.x, area.x + area.width - width));
    const y = Math.max(area.y, Math.min(point.y, area.y + area.height - height));

    const menuId = Date.now().toString(36) +
      Math.random().toString(36).slice(2, 8);

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; overflow: hidden;
  background: ${bg}; color: ${fg};
  font: 13px system-ui, sans-serif;
}
main {
  padding: 6px; max-height: 100vh; overflow-y: auto;
  border: 1px solid ${border}; border-radius: 9px;
}
button {
  display: block; width: 100%; min-height: 31px;
  padding: 6px 10px; border: 0; border-radius: 5px;
  text-align: left; font: inherit;
  color: ${fg}; background: transparent; cursor: default;
}
button:hover:not(:disabled) {
  background: ${accent}; color: ${bg};
}
button:disabled { opacity: .42; }
.separator { height: 1px; margin: 5px 4px; background: ${border}; }
</style>
</head>
<body>
<main>${body}</main>
<script>
document.addEventListener('contextmenu', e => e.preventDefault());
document.querySelectorAll('button').forEach(button => {
  button.addEventListener('click', () => {
    location.href = 'yantux-menu://action/${menuId}/' + button.dataset.index;
  });
});
</script>
</body>
</html>`;

    const popup = new (require('electron').BrowserWindow)({
      width, height, x, y,
      parent: mainWindow,
      frame: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      show: false,
      backgroundColor: bg,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });

    globalThis.__yantuxContextPopup = popup;

    popup.webContents.on('will-navigate', (navigationEvent, url) => {
      if (!url.startsWith('yantux-menu://action/')) return;
      navigationEvent.preventDefault();

      try {
        const parsed = new URL(url);
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts[0] !== menuId) return;

        const index = Number(parts[1]);
        const item = items[index];
        if (item && item.enabled !== false && typeof item.click === 'function') {
          Promise.resolve(item.click()).catch(error =>
            console.error('[YANTUX CONTEXT MENU]', error)
          );
        }
      } catch (error) {
        console.error('[YANTUX CONTEXT MENU]', error);
      }

      if (!popup.isDestroyed()) popup.close();
    });

    popup.on('blur', () => {
      setTimeout(() => {
        if (!popup.isDestroyed() && popup.isVisible()) popup.close();
      }, 250);
    });

    popup.on('closed', () => {
      if (globalThis.__yantuxContextPopup === popup) {
        globalThis.__yantuxContextPopup = null;
      }
    });

    popup.once('ready-to-show', () => {
      if (!popup.isDestroyed()) popup.show();
    });

    try {
      await popup.loadURL(
        'data:text/html;charset=utf-8,' + encodeURIComponent(html)
      );
    } catch (error) {
      console.error('[YANTUX CONTEXT MENU]', error);
      if (!popup.isDestroyed()) popup.close();
    }
  });
}

function setupWebViewZoom(contents) {
  if (!contents || zoomLevels.has(contents.id)) return;

  zoomLevels.set(contents.id, 1);

  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'mouseWheel' || !input.control) return;

    event.preventDefault();

    const current = zoomLevels.get(contents.id) ?? 1;
    const step = input.deltaY > 0 ? -0.1 : 0.1;
    const next = Math.min(5, Math.max(0.25, current + step));

    zoomLevels.set(contents.id, next);
    contents.setZoomFactor(next);
  });

  contents.on('destroyed', () => {
    zoomLevels.delete(contents.id);
  });
}


const {
  setupAdBlocker,
  setAdBlockerEnabled,
  setYouTubeAdBlockerEnabled,
  getYouTubeAdBlockerEnabled
} = require('./adblocker');

console.log('[PY-SETTINGS-PATH]', app.getPath('userData'));

const settingsStore = path.join(
  app.getPath('userData'),
  'pybrowser-settings.json'
);

function readSettings() {
  try {
    if (!fs.existsSync(settingsStore)) return {};
    return JSON.parse(
      fs.readFileSync(settingsStore, 'utf8')
    );
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(
      settingsStore,
      JSON.stringify(settings, null, 2)
    );
    return true;
  } catch (error) {
    console.error(
      'Erro ao salvar configurações:',
      error
    );
    return false;
  }
}

const extensionStore = path.join(
  app.getPath('userData'),
  'extensions.json'
);

function readExtensions() {
  try {
    if (!fs.existsSync(extensionStore)) return [];
    return JSON.parse(fs.readFileSync(extensionStore, 'utf8'));
  } catch {
    return [];
  }
}

function saveExtensions(list) {
  fs.writeFileSync(
    extensionStore,
    JSON.stringify(list, null, 2)
  );
}


ipcMain.handle('set-adblocker', (_, enabled) => {
  return setAdBlockerEnabled(Boolean(enabled));
});

const musicListFile = path.join(app.getPath('userData'), 'background-music.json');

function readMusicList() {
  try {
    const files = JSON.parse(fs.readFileSync(musicListFile, 'utf8'));
    return files.filter(f => typeof f === 'string' && fs.existsSync(f))
      .map(f => ({ path: f, name: path.basename(f), url: pathToFileURL(f).href }));
  } catch {
    return [];
  }
}

ipcMain.handle('yx-music-get', () => readMusicList());

ipcMain.handle('yx-music-choose', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Adicionar músicas ao Yantux Plus',
    properties: ['openFile', 'multiSelections'],
    filters: [{
      name: 'Arquivos de áudio',
      extensions: ['mp3', 'ogg', 'wav', 'flac', 'm4a', 'aac', 'opus']
    }]
  });
  if (result.canceled || !result.filePaths.length) return readMusicList();
  fs.mkdirSync(path.dirname(musicListFile), { recursive: true });
  fs.writeFileSync(musicListFile, JSON.stringify(result.filePaths, null, 2));
  return readMusicList();
});


ipcMain.on('sidebar-icons-top-right', (_, enabled) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sidebar-icons-top-right', Boolean(enabled));
  }
});

ipcMain.handle('get-settings', () => {
  return readSettings();
});

ipcMain.handle('save-settings', (_, settings) => {
  return saveSettings(settings);
});


// Downloads reais do Electron: progresso, pausa, cancelamento e abertura.
const activeDownloads = new Map();
let nextDownloadId = 1;

function sendDownloadUpdate(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('download-update', payload);
  }
}

function registerDownloads() {
  session.defaultSession.on('will-download', (event, item, contents) => {
    const id = `dl-${Date.now()}-${nextDownloadId++}`;
    const startedAt = Date.now();
    let lastBytes = 0;
    let lastTime = startedAt;
    let currentSpeed = 0;
  
    activeDownloads.set(id, item);
  
    const base = {
      id,
      url: item.getURL(),
      name: item.getFilename() || 'arquivo',
      savePath: item.getSavePath(),
      startTime: startedAt
    };
  
    const snapshot = (state = 'downloading') => ({
      ...base,
      savePath: item.getSavePath(),
      state,
      receivedBytes: item.getReceivedBytes(),
      totalBytes: item.getTotalBytes(),
      speed: currentSpeed,
      paused: item.isPaused()
    });
  
    sendDownloadUpdate(snapshot());
  
    item.on('updated', (_event, state) => {
      const now = Date.now();
      const received = item.getReceivedBytes();
      const elapsed = Math.max(1, now - lastTime);
      currentSpeed = Math.max(0, (received - lastBytes) * 1000 / elapsed);
      lastBytes = received;
      lastTime = now;
      sendDownloadUpdate(snapshot(item.isPaused() ? 'paused' : (state === 'interrupted' ? 'interrupted' : 'downloading')));
    });
  
    item.once('done', (_event, state) => {
      const finalState = state === 'completed' ? 'completed' :
        state === 'cancelled' ? 'cancelled' : 'interrupted';
      sendDownloadUpdate(snapshot(finalState));
      activeDownloads.delete(id);
    });
  });
}

app.whenReady().then(registerDownloads);

ipcMain.handle('download-action', async (_event, id, action, savedPath) => {
  const item = activeDownloads.get(id);
  const filePath = item?.getSavePath() || savedPath || '';
  if (!item && !['open', 'show'].includes(action)) {
    return { ok: false, error: 'Este download não está mais ativo.' };
  }

  try {
    if (action === 'pause' && !item.isPaused()) item.pause();
    else if (action === 'resume' && item.isPaused()) item.resume();
    else if (action === 'cancel') item.cancel();
    else if (action === 'open') {
      if (!filePath) return { ok: false, error: 'O arquivo ainda não tem caminho.' };
      const error = await shell.openPath(filePath);
      return { ok: !error, error: error || undefined };
    } else if (action === 'show') {
      if (!filePath) return { ok: false, error: 'O arquivo ainda não tem caminho.' };
      shell.showItemInFolder(filePath);
      return { ok: true };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});

async function loadSavedExtensions() {
  const list = readExtensions();

  for (const item of list) {
    try {
      await session.defaultSession.extensions.loadExtension(
        item.path
      );
    } catch (error) {
      console.error(
        `Não foi possível carregar ${item.path}:`,
        error.message
      );
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Yantux Plus',
    icon: appIconPath,
    width: 1280,
    height: 800,

    minWidth: 850,
    minHeight: 550,

    backgroundColor: '#202124',

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
    console.log('[PY-ZOOM] webview anexado:', webContents.id);
    setupWebViewZoom(webContents);
    setupContextMenu(webContents);
  });



  setupContextMenu(mainWindow.webContents);

  mainWindow.loadFile(
    path.join(__dirname, 'index.html')
  );

  mainWindow.webContents.on('did-finish-load', async () => {
    const result = await mainWindow.webContents.executeJavaScript(`
      ({
        ready: document.readyState,
        browserJs: typeof setupPySidebar,
        sidebar: !!document.getElementById('py-sidebar'),
        add: !!document.getElementById('py-sidebar-add'),
        script: [...document.scripts].map(s => s.src)
      })
    `);

    console.log('[PY-DIAGNOSTICO]', JSON.stringify(result, null, 2));
  });

  mainWindow.webContents.on('console-message', (_, level, message, line, sourceId) => {
    console.log(`[RENDERER-CONSOLE] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('render-process-gone', (_, details) => {
    console.error('[RENDERER-GONE]', details);
  });

  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription, validatedURL) => {
    console.error('[RENDERER-LOAD-ERROR]', errorCode, errorDescription, validatedURL);
  });
}

ipcMain.handle('open-extension-folder', async () => {

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecionar extensão',
    properties: ['openDirectory']
  });

  if (result.canceled || !result.filePaths.length) {
    return {
      ok: false,
      canceled: true
    };
  }

  const extensionPath = result.filePaths[0];

  try {

    const extension =
      await session.defaultSession.extensions.loadExtension(
        extensionPath
      );

    const list = readExtensions();

    if (!list.some(x => x.id === extension.id)) {
      list.push({
        id: extension.id,
        name: extension.name,
        version: extension.version,
        path: extensionPath
      });

      saveExtensions(list);
    }

    return {
      ok: true,
      extension: {
        id: extension.id,
        name: extension.name,
        version: extension.version
      }
    };

  } catch (error) {

    return {
      ok: false,
      error: error.message
    };

  }
});

ipcMain.handle('get-extensions', () => {

  const loaded =
    session.defaultSession.extensions
      .getAllExtensions();

  return loaded.map(yxExtInfo);
});

ipcMain.handle(
  'remove-extension',
  async (_, extensionId) => {

    try {

      try { await yxStoreUninstall(extensionId, { session: session.defaultSession }); } catch (_) {}
      try { session.defaultSession.extensions.removeExtension(extensionId); } catch (_) {}

      const list = readExtensions().filter(
        x => x.id !== extensionId
      );

      saveExtensions(list);

      return {
        ok: true
      };

    } catch (error) {

      return {
        ok: false,
        error: error.message
      };

    }
  }
);

ipcMain.handle(
  'open-external',
  async (_, url) => {

    if (
      typeof url === 'string' &&
      /^https?:\/\//i.test(url)
    ) {
      await shell.openExternal(url);
    }

  }
);

ipcMain.handle('open-devtools', () => {

  if (mainWindow) {
    mainWindow.webContents.openDevTools({
      mode: 'detach'
    });
  }

});

ipcMain.handle('reload-browser', () => {
  if (mainWindow) {
    mainWindow.reload();
    return true;
  }

  return false;
});

app.whenReady().then(async () => {

  await loadSavedExtensions();

  await setupAdBlocker();

  const savedSettings = readSettings();
  setYouTubeAdBlockerEnabled(
    Boolean(savedSettings.youtubeAdBlockerEnabled)
  );

  createWindow();

  app.on('activate', () => {

    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }

  });

});

app.on('window-all-closed', () => {

  if (process.platform !== 'darwin') {
    app.quit();
  }

});

/* ===== ATALHOS DO NAVEGADOR ===== */
function yxZoom(contents, dir) {
  const z = contents.getZoomLevel();
  contents.setZoomLevel(dir === 0 ? 0 : Math.max(-3, Math.min(5, z + dir * 0.5)));
}

function yxSend(contents, action) {
  const host = contents.hostWebContents || contents;
  if (host.isDestroyed()) return;
  host.executeJavaScript(
    "window.dispatchEvent(new CustomEvent('yantux-shortcut',{detail:" + JSON.stringify(action) + "}))"
  ).catch(() => {});
}

app.on('web-contents-created', (_e, contents) => {
  const isWebview = contents.getType() === 'webview';

  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    // F5 e Ctrl+R recarregam
    if (input.key === 'F5') { event.preventDefault(); yxSend(contents, 'reload'); return; }

    if (!(input.control || input.meta) || input.alt) return;
    const k = String(input.key).toLowerCase();
    let action = null;

    if (k === 't') action = input.shift ? 'reopen-tab' : 'new-tab';
    else if (k === 'w') action = 'close-tab';
    else if (k === 'l') action = 'focus-address';
    else if (k === 'r') action = 'reload';
    else if (k === 'tab') action = input.shift ? 'prev-tab' : 'next-tab';
    else if (/^[1-9]$/.test(k)) action = 'tab-' + k;

    if (action) { event.preventDefault(); yxSend(contents, action); }
  });

  // Ctrl + roda do mouse dentro das paginas
  if (isWebview) {
  }
});

/* yx-zoom-v2: zoom pelo changeZoom do browser.js */
app.on('web-contents-created', (_e, contents) => {
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta) || input.alt) return;
    const k = String(input.key);
    let a = null;
    if (k === '+' || k === '=') a = 'zoom-in';
    else if (k === '-' || k === '_') a = 'zoom-out';
    else if (k === '0') a = 'zoom-reset';
    if (a) { event.preventDefault(); yxSend(contents, a); }
  });
  if (contents.getType() === 'webview') {
    contents.on('zoom-changed', (_ev, dir) => yxSend(contents, dir === 'in' ? 'zoom-in' : 'zoom-out'));
  }
});

/* ===== DESEMPENHO ===== */
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

/* ===== CHROME WEB STORE ===== */
const {
  installChromeWebStore,
  installExtension: yxStoreInstall,
  uninstallExtension: yxStoreUninstall
} = require('electron-chrome-web-store');

app.whenReady().then(async () => {
  try {
    await installChromeWebStore({ session: session.defaultSession });
    console.log('[YX-STORE] Chrome Web Store ativada');
  } catch (e) {
    console.error('[YX-STORE] falha ao ativar:', e);
  }
});

function yxExtractId(text) {
  const all = String(text || '').match(/[a-p]{32}/g);
  return all ? all[all.length - 1] : null;
}

ipcMain.handle('yx-store-install', async (_e, input) => {
  const id = yxExtractId(input);
  if (!id) return { ok: false, error: 'Cole o link da loja ou o ID de 32 letras da extensão.' };
  try {
    await yxStoreInstall(id, { session: session.defaultSession });
    const ext = session.defaultSession.extensions.getAllExtensions().find(x => x.id === id);
    return { ok: true, id, name: ext ? ext.name : id, version: ext ? ext.version : '' };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

ipcMain.handle('yx-store-uninstall', async (_e, id) => {
  try {
    await yxStoreUninstall(id, { session: session.defaultSession });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});
require('./wallpaper-main.js');
require('./theme-main.js');

/* ===== info das extensoes para o gerenciador ===== */
function yxExtInfo(extension) {
  const fsx = require('fs');
  const pathx = require('path');
  const { pathToFileURL } = require('url');
  const m = extension.manifest || {};

  function resolveMsg(str) {
    const hit = /^__MSG_(.+)__$/.exec(String(str || ''));
    if (!hit) return String(str || '');
    const key = hit[1].toLowerCase();
    const locales = [m.default_locale, 'pt_BR', 'pt', 'en', 'en_US'].filter(Boolean);
    for (const loc of locales) {
      try {
        const file = pathx.join(extension.path, '_locales', loc, 'messages.json');
        const data = JSON.parse(fsx.readFileSync(file, 'utf8'));
        for (const k of Object.keys(data)) {
          if (k.toLowerCase() === key && data[k] && data[k].message) return data[k].message;
        }
      } catch (_) {}
    }
    return '';
  }

  let icon = '';
  try {
    let icons = m.icons || (m.action && m.action.default_icon) || (m.browser_action && m.browser_action.default_icon) || {};
    if (typeof icons === 'string') icons = { 128: icons };
    const sizes = Object.keys(icons).map(Number).filter(n => !Number.isNaN(n)).sort((a, b) => b - a);
    const pick = sizes.find(n => n <= 128) || sizes[0];
    if (pick && icons[pick]) {
      const root = pathx.resolve(extension.path);
      const full = pathx.resolve(root, icons[pick]);
      if (full.startsWith(root) && fsx.existsSync(full)) icon = pathToFileURL(full).href;
    }
  } catch (_) {}

  return {
    id: extension.id,
    name: resolveMsg(extension.name || m.name) || extension.id,
    version: extension.version,
    description: resolveMsg(m.description),
    icon
  };
}
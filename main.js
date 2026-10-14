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

let mainWindow;
ipcMain.handle('yantux-control-memory', () => ({ memory: process.memoryUsage(), processes: app.getAppMetrics() }));

const zoomLevels = new Map();


function setupContextMenu(contents) {
  if (!contents || contents.isDestroyed()) return;

  contents.on('context-menu', (event, params) => {
    const { Menu, clipboard, dialog } = require('electron');
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

    // Imagens
    if (params.hasImageContents && params.srcURL) {
      add('Abrir imagem em nova aba', () => openInNewTab(params.srcURL));
      add('Copiar endereço da imagem', () => clipboard.writeText(params.srcURL));
      add('Salvar imagem como…', () => contents.downloadURL(params.srcURL));
      sep();
    }

    // Links
    if (params.linkURL) {
      add('Abrir link em nova aba', () => openInNewTab(params.linkURL));
      add('Copiar endereço do link', () => clipboard.writeText(params.linkURL));
      add('Baixar link', () => contents.downloadURL(params.linkURL));
      sep();
    }

    // Texto e formulários
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

    // Página e navegação
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

    if (mainWindow && !mainWindow.isDestroyed()) {
      Menu.buildFromTemplate(items).popup({ window: mainWindow });
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
    title: 'Yantux',
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

  return loaded.map(extension => ({
    id: extension.id,
    name: extension.name,
    version: extension.version
  }));
});

ipcMain.handle(
  'remove-extension',
  async (_, extensionId) => {

    try {

      session.defaultSession.extensions.removeExtension(
        extensionId
      );

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

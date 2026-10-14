const {
  contextBridge,
  ipcRenderer
} = require('electron');

contextBridge.exposeInMainWorld(
  'pybrowser',
  {

    addExtension:
      () => ipcRenderer.invoke(
        'open-extension-folder'
      ),

    getExtensions:
      () => ipcRenderer.invoke(
        'get-extensions'
      ),

    removeExtension:
      (id) => ipcRenderer.invoke(
        'remove-extension',
        id
      ),

    openExternal:
      (url) => ipcRenderer.invoke(
        'open-external',
        url
      ),

    openDevTools:
      () => ipcRenderer.invoke(
        'open-devtools'
      ),

    getSettings:
      () => ipcRenderer.invoke(
        'get-settings'
      ),

    saveSettings:
      (settings) => ipcRenderer.invoke(
        'save-settings',
        settings
      ),

    reloadBrowser:
      () => ipcRenderer.invoke(
        'reload-browser'
      ),

    getYantuxControlMemory: () => ipcRenderer.invoke('yantux-control-memory'),

    onContextOpenLink:
      (callback) => ipcRenderer.on(
        'context-open-link',
        (_, url) => callback(url)
      ),

    setAdBlocker:
      (enabled) => ipcRenderer.invoke(
        'set-adblocker',
        enabled
      ),

    onDownloadUpdate:
      (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on('download-update', listener);
        return () => ipcRenderer.removeListener('download-update', listener);
      },

    downloadAction:
      (id, action, savedPath) => ipcRenderer.invoke(
        'download-action', id, action, savedPath
      )

  }
);

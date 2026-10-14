const { app, session } = require('electron');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const { NetworkFilter } = require('@ghostery/adblocker');
const fetch = require('cross-fetch');
const fs = require('node:fs');

let blocker = null;
let youtubeAdBlockerEnabled = false;

const YOUTUBE_AD_RULES = [
  '||googleads.g.doubleclick.net^$domain=youtube.com',
  '||pagead2.googlesyndication.com^$domain=youtube.com',
  '||www.googleadservices.com^$domain=youtube.com'
];

const YOUTUBE_FILTERS = YOUTUBE_AD_RULES.map((rule) => {
  const filter = NetworkFilter.parse(rule);
  if (!filter) throw new Error(`Regra inválida: ${rule}`);
  return filter;
});

async function setupAdBlocker() {
  try {
    const cachePath =
      `${app.getPath('userData')}/pybrowser-adblocker-tracking.bin`;

    if (fs.existsSync(cachePath)) {
      blocker = ElectronBlocker.deserialize(
        fs.readFileSync(cachePath)
      );

      console.log('[PY-BLOCKER] Cache carregado.');
    } else {
      blocker =
        await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);

      fs.writeFileSync(
        cachePath,
        blocker.serialize()
      );

      console.log(
        '[PY-BLOCKER] Lista criada e cache salvo.'
      );
    }

    blocker.enableBlockingInSession(
      session.defaultSession
    );

    console.log(
      '[PY-BLOCKER] Ghostery Adblocker ativado.'
    );
  } catch (error) {
    console.error(
      '[PY-BLOCKER] Falha ao iniciar:',
      error
    );
  }
}

function setYouTubeAdBlockerEnabled(enabled) {
  if (!blocker) return false;

  const next = Boolean(enabled);
  if (next === youtubeAdBlockerEnabled) return true;

  if (next) {
    blocker.update({ newNetworkFilters: YOUTUBE_FILTERS });
  } else {
    blocker.update({
      removedNetworkFilters: YOUTUBE_FILTERS.map((filter) => filter.getId())
    });
  }

  youtubeAdBlockerEnabled = next;
  console.log('[YT-BLOCKER]', next ? 'ligado' : 'desligado');
  return true;
}

function getYouTubeAdBlockerEnabled() {
  return youtubeAdBlockerEnabled;
}

function setAdBlockerEnabled(enabled) {
  if (!blocker) return false;

  if (enabled) {
    blocker.enableBlockingInSession(
      session.defaultSession
    );
  } else {
    blocker.disableBlockingInSession(
      session.defaultSession
    );
  }

  return true;
}

module.exports = {
  setupAdBlocker,
  setAdBlockerEnabled,
  setYouTubeAdBlockerEnabled,
  getYouTubeAdBlockerEnabled
};

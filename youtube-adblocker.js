const { session } = require('electron');

let enabled = false;
let installedSession = null;

const AD_HOSTS = new Set([
  'www.googleadservices.com',
  'googleads.g.doubleclick.net',
  'static.doubleclick.net',
  'ad.doubleclick.net',
  'pagead2.googlesyndication.com',
  'pubads.g.doubleclick.net'
]);

function isAdRequest(details) {
  if (!enabled) return false;

  let url;
  let initiator;

  try {
    url = new URL(details.url);
    initiator = new URL(details.referrer || details.initiator || '');
  } catch {
    return false;
  }

  const isYouTube =
    initiator.hostname === 'youtube.com' ||
    initiator.hostname.endsWith('.youtube.com');

  return isYouTube && AD_HOSTS.has(url.hostname);
}

function setYouTubeAdBlockerEnabled(value) {
  enabled = Boolean(value);

  const currentSession = session.defaultSession;

  if (installedSession !== currentSession) {
    currentSession.webRequest.onBeforeRequest(
      { urls: ['*://*/*'] },
      (details, callback) => {
        callback({ cancel: isAdRequest(details) });
      }
    );

    installedSession = currentSession;
  }

  console.log('[YT-ADBLOCK]', enabled ? 'ligado' : 'desligado');
  return enabled;
}

function getYouTubeAdBlockerEnabled() {
  return enabled;
}

module.exports = {
  setYouTubeAdBlockerEnabled,
  getYouTubeAdBlockerEnabled
};

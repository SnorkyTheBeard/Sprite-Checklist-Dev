const CACHE = 'galaxy-sprite-checklist-v86';
const CORE = [
  './',
  './index.html',
  './styles.css?v=86',
  './published-design.js',
  './art-config.js?v=67',
  './data.js?v=82',
  './app.js?v=86',
  './manifest.webmanifest?v=67',
  './fonts/Burbank Big Condensed Black.otf',
  './fonts/Fredoka-Regular.woff2',
  './fonts/Fredoka-SemiBold.woff2',
  './fonts/Fredoka-Bold.woff2',
  './apple-touch-icon.png?v=67',
  './favicon.ico?v=67',
  './icons/app-icon-180-v67.png',
  './icons/app-icon-192-v67.png',
  './icons/app-icon-512-v67.png',
  './icons/app-icon-maskable-192-v67.png',
  './icons/app-icon-maskable-512-v67.png',
  './icons/favicon-16-v67.png',
  './icons/favicon-32-v67.png',
  './assets/variant-backgrounds/variant-well-base.webp',
  './assets/variant-backgrounds/variant-well-gold.webp',
  './assets/variant-backgrounds/variant-well-gummy.webp',
  './assets/variant-backgrounds/variant-well-galaxy.webp',
  './assets/variant-backgrounds/variant-well-cube.webp',
  './assets/variant-backgrounds/variant-well-gem.webp',
  './assets/variant-backgrounds/variant-well-quack.webp',
  './assets/variant-backgrounds/variant-well-holofoil.webp',
  './assets/page-backgrounds/page-bg-rare.webp',
  './assets/page-backgrounds/page-bg-epic.webp',
  './assets/page-backgrounds/page-bg-legendary.webp',
  './assets/page-backgrounds/page-bg-mythic.webp',
  './assets/header/main-header.webp?v=3'
];
const FRESH_CODE_FILES = new Set(['styles.css','art-config.js','data.js','app.js','manifest.webmanifest']);
const FRESH_ASSET_PATHS = ['/assets/header/','/assets/page-backgrounds/','/assets/social/','/icons/'];

async function freshOrCached(networkRequest, cachedResponse) {
  try {
    const response = await networkRequest;
    return response?.ok ? response : (cachedResponse || response);
  } catch {
    return cachedResponse || Response.error();
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all(CORE.map((path) => cache.add(path).catch(() => null))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== 'GET' || requestUrl.origin !== self.location.origin) return;

  if (requestUrl.pathname.endsWith('/published-design.js')) {
    const cacheKey = new URL(event.request.url);
    cacheKey.search = '';
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(event.request,{ cache:'no-cache' });
        if (response.ok) await cache.put(cacheKey.toString(),response.clone());
        return response;
      } catch {
        return (await cache.match(cacheKey.toString())) || Response.error();
      }
    })());
    return;
  }

  const requestedFile = requestUrl.pathname.split('/').pop();
  if (FRESH_CODE_FILES.has(requestedFile) || FRESH_ASSET_PATHS.some((path) => requestUrl.pathname.includes(path))) {
    const networkUpdate = caches.open(CACHE).then((cache) =>
      fetch(event.request,{ cache:'no-cache' }).then(async (response) => {
        if (response.ok) await cache.put(event.request,response.clone());
        return response;
      })
    );
    event.waitUntil(networkUpdate.catch(() => null));
    event.respondWith(
      caches.match(event.request).then((cached) => freshOrCached(networkUpdate,cached))
    );
    return;
  }

  if (event.request.mode === 'navigate') {
    const networkUpdate = fetch(event.request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put('./index.html',response.clone());
      }
      return response;
    });
    event.waitUntil(networkUpdate.catch(() => null));
    event.respondWith(
      caches.match('./index.html').then((cached) => freshOrCached(networkUpdate,cached))
    );
    return;
  }

  const networkUpdate = caches.open(CACHE).then((cache) =>
    fetch(event.request).then(async (response) => {
      if (response.ok) await cache.put(event.request,response.clone());
      return response;
    })
  );
  event.waitUntil(networkUpdate.catch(() => null));
  event.respondWith(
    caches.match(event.request).then((cached) => cached || networkUpdate).catch(() => networkUpdate)
  );
});

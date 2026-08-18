const CACHE = 'galaxy-sprite-checklist-v152';
const CORE = [
  './',
  './index.html',
  './styles.css?v=135',
  './vault-v105.css?v=112',
  './viewport-v106.css?v=107',
  './scene-v126.css?v=126',
  './cloud-v128.css?v=135',
  './profile-v133.css?v=135',
  './v135.css?v=135',
  './v136.css?v=136',
  './v137.css?v=137',
  './v138.css?v=138',
  './v139.css?v=139',
  './v140.css?v=140',
  './v142.css?v=142',
  './v143.css?v=143',
  './v144.css?v=144',
  './v145.css?v=145',
  './v150.css?v=150',
  './v151.css?v=151',
  './v152.css?v=152',
  './v152.js?v=152',
  './published-design.js',
  './art-config.js?v=67',
  './data.js?v=82',
  './sprite-events-v140.js?v=140',
  './state-schema-v127.js?v=127',
  './feature-config-v129.js?v=150',
  './app.js?v=150',
  './cloud-config-v128.js?v=128',
  './cloud-v128.js?v=150',
  './profile-v133.js?v=150',
  './manifest.webmanifest?v=101',
  './fonts/Burbank Big Condensed Black.otf',
  './fonts/Fredoka-Regular.woff2',
  './fonts/Fredoka-SemiBold.woff2',
  './fonts/Fredoka-Bold.woff2',
  './apple-touch-icon-v101.png',
  './favicon-v101.ico',
  './icons/app-icon-180-v101.png',
  './icons/app-icon-192-v101.png',
  './icons/app-icon-512-v101.png',
  './icons/app-icon-maskable-192-v101.png',
  './icons/app-icon-maskable-512-v101.png',
  './icons/favicon-16-v101.png',
  './icons/favicon-32-v101.png',
  './assets/variant-backgrounds/variant-well-base.webp',
  './assets/variant-backgrounds/variant-well-gold.webp',
  './assets/variant-backgrounds/variant-well-gummy.webp',
  './assets/variant-backgrounds/variant-well-galaxy.webp',
  './assets/variant-backgrounds/variant-well-cube.webp',
  './assets/variant-backgrounds/variant-well-gem.webp',
  './assets/variant-backgrounds/variant-well-quack.webp',
  './assets/variant-backgrounds/variant-well-holofoil.webp',
  './assets/variant-backgrounds/variant-well-john-wick.webp?v=92',
  './published-assets/sprite-custom-john-wick-base.webp',
  './assets/page-backgrounds/page-bg-rare.webp',
  './assets/page-backgrounds/page-bg-epic.webp',
  './assets/page-backgrounds/page-bg-rare-lifty-lodge-v113.webp',
  './assets/page-backgrounds/page-bg-rare-lifty-lodge-mobile-v113.webp',
  './assets/page-backgrounds/page-bg-epic-wonkeeland-v113.webp',
  './assets/page-backgrounds/page-bg-epic-wonkeeland-mobile-v113.webp',
  './assets/page-backgrounds/page-bg-legendary.webp',
  './assets/page-backgrounds/page-bg-mythic.webp',
  './assets/page-backgrounds/page-bg-unowned.webp?v=93',
  './assets/page-backgrounds/page-bg-unmastered.webp?v=93',
  './assets/page-backgrounds/page-bg-sprite-vault-v100.webp',
  './V150-bg-rare.webp',
  './V150-bg-epic.webp',
  './V150-bg-legendary.webp',
  './V150-bg-mythic.webp',
  './V150-bg-unowned.webp',
  './V150-bg-unmastered.webp',
  './V150-bg-rare-desktop.webp',
  './V150-bg-epic-desktop.webp',
  './V150-bg-archive.webp',
  './V150-bg-assistant.webp',
  './V150-bg-profile.webp',
  './V150-bg-settings.webp',
  './assets/header/main-header.webp?v=3'
];
const FRESH_CODE_FILES = new Set(['styles.css','vault-v105.css','viewport-v106.css','scene-v126.css','cloud-v128.css','profile-v133.css','v135.css','v136.css','v137.css','v138.css','v139.css','v140.css','v142.css','v143.css','v144.css','v145.css','v150.css','v151.css','v152.css','v152.js','art-config.js','data.js','sprite-events-v140.js','state-schema-v127.js','feature-config-v129.js','app.js','cloud-config-v128.js','cloud-v128.js','profile-v133.js','manifest.webmanifest']);
const FRESH_ASSET_PATHS = ['/assets/header/','/assets/page-backgrounds/','/assets/feature-backgrounds/','/assets/social/','/icons/','/V150-bg-'];
const V152_HEAD = '<link rel="stylesheet" href="v152.css?v=152">';
const V152_BODY = '<script src="v152.js?v=152"><\/script>';

async function freshOrCached(networkRequest, cachedResponse) {
  try {
    const response = await networkRequest;
    return response?.ok ? response : (cachedResponse || response);
  } catch {
    return cachedResponse || Response.error();
  }
}

async function injectV152(response) {
  if (!response || !response.ok) return response;
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;
  const text = await response.text();
  let html = text;
  if (!html.includes('v152.css?v=152')) html = html.replace('</head>',`${V152_HEAD}\n</head>`);
  if (!html.includes('v152.js?v=152')) html = html.replace('</body>',`${V152_BODY}\n</body>`);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new Response(html,{ status:response.status,statusText:response.statusText,headers });
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
    const networkUpdate = fetch(event.request,{ cache:'no-cache' }).then(async (response) => {
      const injected = await injectV152(response);
      if (injected.ok) {
        const cache = await caches.open(CACHE);
        await cache.put('./index.html',injected.clone());
      }
      return injected;
    });
    event.waitUntil(networkUpdate.catch(() => null));
    event.respondWith((async () => {
      const cached = await caches.match('./index.html');
      const response = await freshOrCached(networkUpdate,cached);
      return injectV152(response);
    })());
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

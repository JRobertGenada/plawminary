/**
 * PLawminary Service Worker (Application Shell & Offline Support)
 *
 * Provides full offline startup for PLawminary SPA:
 * - Caches index.html, Vite JS/CSS bundles, logos, fonts, and pdf.worker.min.mjs
 * - Intercepts navigation requests offline to serve the cached application shell
 * - Preserves IndexedDB persistence for policy and handbook offline records
 */

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `plawminary-shell-${CACHE_VERSION}`;

// Fixed static assets present in public directory
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.png',
  '/favicon.svg',
  '/icons.svg',
  '/pdf.worker.min.mjs',
  '/handbook.pdf',
];

// Production bundle assets injected by vite.config.js plugin during build
const BUILD_ASSETS = [
  /* __VITE_ASSETS_PLACEHOLDER__ */
];

const PRECACHE_ASSETS = Array.from(new Set([...STATIC_ASSETS, ...BUILD_ASSETS]));

// ── Install: Pre-cache the App Shell ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Pre-cache assets safely; individual failures should not halt activation
      const cachePromises = PRECACHE_ASSETS.map(async (url) => {
        try {
          const response = await fetch(url, { cache: 'no-cache' });
          if (response && response.ok) {
            await cache.put(url, response);
          }
        } catch (err) {
          console.warn(`[SW] Pre-cache skipped for ${url}:`, err.message);
        }
      });
      await Promise.all(cachePromises);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: Clean up outdated caches & take immediate control ──────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key.startsWith('plawminary-shell-')) {
            console.log(`[SW] Removing outdated cache: ${key}`);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch: Serve cached assets & intercept navigation requests ───────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Bypass Vite internal and development modules if in dev mode
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.includes('node_modules') ||
    url.pathname.includes('?import')
  ) {
    return;
  }

  // 1. API Requests (/api/*): Network-only; do NOT return HTML app shell
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            error: 'You are currently offline. PLawminary is serving offline content from local storage.',
            offline: true,
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // 2. Navigation requests (HTML document loads for client-side routes)
  // e.g. /saved, /ordinances/1, /handbook, /login
  if (
    request.mode === 'navigate' ||
    (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))
  ) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // OFFLINE: Serve the cached SPA application shell
          const cache = await caches.open(CACHE_NAME);
          const cachedShell = (await cache.match('/index.html')) || (await cache.match('/'));
          if (cachedShell) {
            return cachedShell;
          }
          return new Response(
            '<!DOCTYPE html><html><head><title>PLawminary - Offline</title></head><body><h2>PLawminary Offline</h2><p>Please connect to the internet once to cache the application shell.</p></body></html>',
            {
              status: 503,
              headers: { 'Content-Type': 'text/html' },
            }
          );
        })
    );
    return;
  }

  // 3. Static Assets: Same-origin bundles, icons, fonts, images, and pdf worker
  const isSameOrigin = url.origin === self.location.origin;
  const isGoogleFont =
    url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  if (isSameOrigin || isGoogleFont) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        // Cache miss: fetch from network and dynamically store in cache
        return fetch(request)
          .then((networkResponse) => {
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              (networkResponse.type === 'basic' || networkResponse.type === 'cors')
            ) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch((err) => {
            // For pdf worker specifically, try exact path matching
            if (url.pathname.includes('pdf.worker')) {
              return caches.match('/pdf.worker.min.mjs');
            }
            throw err;
          });
      })
    );
  }
});

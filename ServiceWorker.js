const cacheName = "Xex-PAWTestTemplate-1.0";
const contentToCache = [
  "Build/TestWebGL.loader.js",
  "Build/TestWebGL.framework.js",
  "Build/TestWebGL.data",
  "Build/TestWebGL.wasm",
  "TemplateData/style.css"

];

self.addEventListener('install', function (e) {
  console.log('[Service Worker] Install');

  e.waitUntil((async function () {
    const cache = await caches.open(cacheName);
    console.log('[Service Worker] Caching all: app shell and content');
    await cache.addAll(contentToCache);
  })());
});

self.addEventListener('fetch', function (e) {
  e.respondWith((async function () {
    let response = await caches.match(e.request);
    console.log(`[Service Worker] Fetching resource: ${e.request.url}`);
    if (response) { return response; }

    try {
      response = await fetch(e.request);
      const cache = await caches.open(cacheName);
      console.log(`[Service Worker] Caching new resource: ${e.request.url}`);
      await cache.add(e.request.url);
    } catch (error) {
      console.error(`Error caching ${e.request.url}: ${error}`);
    }
    return response;
  })());
});

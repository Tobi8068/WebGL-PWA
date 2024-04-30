const cacheName = "Xex-PAWTestTemplate-1.0";
const contentToCache = [
  "/",
  "index.html",
  "Build/TestWebGL.loader.js",
  "Build/TestWebGL.framework.js",
  "Build/TestWebGL.data",
  "Build/TestWebGL.wasm",
  "TemplateData/style.css",
  "lib/thirdweb-unity-bridge.js",
  "manifest.json",
];

self.addEventListener('install', function (e) {
  console.log('[Service Worker] Install');
  e.waitUntil((async function () {
    const cache = await caches.open(cacheName);
    console.log('[Service Worker] Caching all: app shell and content');
    return await cache.addAll(contentToCache);
  })());
});

self.addEventListener('fetch', function (e) {
  e.respondWith((async function () {
    let response = await caches.match(e.request);
    console.log(`[Service Worker] Fetching resource: ${e.request.url}`);
    if (response) { return response; }

    // Check if the requested resource is part of the contentToCache array
    if (contentToCache.includes(new URL(e.request.url, self.location).pathname.slice(1))) {
      response = await fetch(e.request);
      const cache = await caches.open(cacheName);
      console.log(`[Service Worker] Caching new resource: ${e.request.url}`);
      if (e.request.url.startsWith('http')) {
        cache.put(e.request, response.clone());
      }
      return response;
    } else {
      return fetch(e.request);
    }
  })());
});

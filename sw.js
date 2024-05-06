const cacheName = "Xex-PAWTestTemplate-1.0";
importScripts('./lib/dexie.min.js')
const contentToCache = [
  "/",
  "index.html",
  "Build/TestWebGL.loader.js",
  "Build/TestWebGL.framework.js",
  "Build/TestWebGL.data",
  "Build/TestWebGL.wasm",
  "TemplateData/style.css",
  "lib/thirdweb-unity-bridge.js",
  // "/lib/dexie.min.js",
  // "/lib/dexie.min.js.map",
  "manifest.json",
];

self.addEventListener('install', function (e) {
  console.log("Install============>")
  e.waitUntil((async function () {
    const cache = await caches.open(cacheName);
    console.log('[Service Worker] Caching all: app shell and content');
    await cache.addAll(contentToCache);
  })());
});

self.addEventListener('fetch', function (event) {
  if (event.request.method === 'GET') {
    event.respondWith((async function () {
      let response = await caches.match(event.request);
      console.log(`[Service Worker] Fetching resource: ${event.request.url}`);
      if (response) { return response; }
      if (contentToCache.includes(new URL(event.request.url, self.location).pathname.slice(1))) {
        response = await fetch(event.request);
        const cache = await caches.open(cacheName);
        console.log(`[Service Worker] Caching new resource: ${event.request.url}`);
        if (event.request.url.startsWith('http')) {
          cache.put(event.request, response.clone());
        }
        return response;
      } else {
        return fetch(event.request);
      }
    })());
  }
  else if (event.request.method === "POST") {
    var db = new Dexie("post_cache");
    db.version(1).stores({
      post_cache: 'key,response,timestamp'
    })
    event.respondWith(
      // First try to fetch the request from the server

      fetch(event.request.clone())
        .then(function (response) {
          // If it works, put the response into IndexedDB
          console.log("onlineState=============>")
          cachePut(event.request.clone(), response.clone(), db.post_cache);

          return response;
        })
        .catch(function () {
          console.log("called indexed DB==================>")
          // If it does not work, return the cached response. If the cache does not
          // contain a response for our request, it will give us a 503-response
          return cacheMatch(event.request.clone(), db.post_cache);
        })
    );
  }
});
self.addEventListener('activate', function (event) {
  console.log('Claiming control');
  return self.clients.claim();
});

async function serializeRequest(request) {
  var serialized = {
    url: request.url,
    headers: serializeHeaders(request.headers),
    method: request.method,
    mode: request.mode,
    credentials: request.credentials,
    cache: request.cache,
    redirect: request.redirect,
    referrer: request.referrer
  };
  // Only if method is not `GET` or `HEAD` is the request allowed to have body.
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const body = await request.clone().text();
    serialized.body = body;
  }
  return serialized.body;
}

/**
* Serializes a Response into a plain JS object
* 
* @param response
* @returns Promise
*/
function serializeResponse(response) {
  var serialized = {
    headers: serializeHeaders(response.headers),
    status: response.status,
    statusText: response.statusText
  };

  return response.clone().text().then(function (body) {
    serialized.body = body;
    return Promise.resolve(serialized);
  });
}

/**
* Serializes headers into a plain JS object
* 
* @param headers
* @returns object
*/
function serializeHeaders(headers) {
  var serialized = {};
  // `for(... of ...)` is ES6 notation but current browsers supporting SW, support this
  // notation as well and this is the only way of retrieving all the headers.
  for (var entry of headers.entries()) {
    serialized[entry[0]] = entry[1];
  }
  return serialized;
}

/**
* Creates a Response from it's serialized version
* 
* @param data
* @returns Promise
*/
function deserializeResponse(data) {

  return Promise.resolve(new Response(data.body, data));
}

/**
* Saves the response for the given request eventually overriding the previous version
* 
* @param data
* @returns Promise
*/
function cachePut(request, response, store) {
  var key, data;
  return getPostId(request.clone())
    .then(function (id) {
      key = id;
      return serializeResponse(response.clone());
    })
    .then(function (serializedResponse) {
      data = serializedResponse;
      var entry = {
        key: key,
        response: data,
        timestamp: Date.now()
      };
      return store.add(entry)
        .then(function () {
          console.log("Entry added to IndexedDB:", entry);
        })
        .catch(function (error) {
          return store.update(entry.key, entry)
            .then(function () {
              console.log("Entry updated in IndexedDB:", entry);
            })
            .catch(function (updateError) {
              console.error("Error updating entry in IndexedDB:", updateError);
            });
        });
    })
    .catch(function (error) {
      console.error("Error caching request:", error);
    });
}

/**
* Returns the cached response for the given request or an empty 503-response  for a cache miss.
* 
* @param request
* @return Promise
*/
async function cacheMatch(request, store) {
  const id = await getPostId(request.clone());
  const data = await store.get({key : id});
  console.log("data========>", data)

  if (data) {
    return deserializeResponse(data.response);
  } else {
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
}

function generateUUIDFromString(inputString) {
  let hash = 0;

  for (let i = 0; i < inputString.length; i++) {
    const char = inputString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char; // Simple hashing operation
    hash &= hash; // Convert to 32-bit integer
  }

  const uuid = Math.abs(hash).toString(16); // Convert the hash to a positive hexadecimal string
  return uuid;
}

/**
* Returns a string identifier for our POST request.
* 
* @param request
* @return string
*/
async function getPostId(request) {
  const serializedRequestText = await serializeRequest(request.clone());
  const parsedObject = JSON.parse(serializedRequestText);
  let serializedRequest;
  if (parsedObject && parsedObject[0].hasOwnProperty('id')) {
    // Create a new object without the 'id' field
    const { id, ...rest } = parsedObject[0];
    serializedRequest = JSON.stringify([rest]);
  }
  const uuid = generateUUIDFromString(serializedRequest);
  // console.log("----------------- result --------------", serializedRequest, typeof (serializedRequest), ":", uuid);
  return uuid;
}
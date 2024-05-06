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


function checkNetworkState() {
  setInterval(function () {
    if (navigator.onLine) {
      sendOfflinePostRequestsToServer()
    }
  }, 3000);
  checkNetworkState();
}

self.addEventListener('install', function (e) {
  console.log('[Service Worker] Install');
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

      // Check if the requested resource is part of the contentToCache array
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
  else {
    if (!navigator.onLine) {
      //here you can check for specific urls to be saved in indexed db
      var authHeader = event.request.headers.get('Authorization');
      var reqUrl = event.request.url;
      Promise.resolve(event.request.text()).then((payload) => {
        //save offline requests to indexed db
        saveIntoIndexedDb(reqUrl, authHeader, payload)
      })
    }
  }
});
self.addEventListener('activate', function (event) {
  console.log('Claiming control');
  return self.clients.claim();
});


//////////////////////////////////////////////////////
async function cacheResponse(cache, request, response, data) {
  var responseToCache;
  try {
    if (!request.url.includes('/static/') && request.mode === 'cors') {

      var responseData = await getResponseData(data)

      responseToCache = new Response(btoa(responseData), {
        headers: response.clone().headers
      })
    } else {
      responseToCache = response.clone()
    }
    cache.put(request, responseToCache);
  } catch (err) {
  }
  return response;
}


const cacheRequest = request => caches.open(CACHE.name + CACHE.version).then(cache =>

  fetch(request.clone(), {
    credentials: 'same-origin'
  })
    .then(response =>
      cacheResponse(cache, request.clone(), response, response.clone().text()))
);

const fetchResponseFromCache = (request, returnResponseData) =>
  caches.open(CACHE.name + CACHE.version).then(cache =>
    cache.match(request, { ignoreVary: true }).then(response => returnResponseFromCache(request, response, returnResponseData, cache))
  );

async function returnResponseFromCache(request, response, returnResponseData, cache) {

  if (response && !request.url.includes('/static/') && request.mode === 'cors') {
    var responseData = await getResponseData(response.text())
    if (returnResponseData)
      return responseData
    response = new Response(atob(responseData), {
      headers: response.headers
    })
  }

  if (!!response) {
    return response;
  } else {
    console.log(request.url + ' not yet cached!')
    return fetch(request, { credentials: 'same-origin' }).then(response => cacheResponse(cache, request, response))
  }
}

async function getResponseData(data) {
  let promise = Promise.resolve(data).then((text) => {
    return text
  })
  let result = await promise;
  return result
}

async function sendOfflinePostRequestsToServer() {
  var request = indexedDB.open("TrayTrackingPostDB");
  request.onsuccess = function (event) {
    var db = event.target.result;
    var tx = db.transaction('postrequest', 'readwrite');
    var store = tx.objectStore('postrequest');
    var allRecords = store.getAll();
    allRecords.onsuccess = function () {

      if (allRecords.result && allRecords.result.length > 0) {

        var records = allRecords.result
        //make recursive call to hit fetch requests to server in a serial manner
        var resp = sendFetchRequestsToServer(
          fetch(records[0].url, {
            method: "post",
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': records[0].authHeader
            },
            body: records[0].payload
          }), records[0].url, records[0].authHeader, records[0].payload, records.slice(1))

        for (var i = 0; i < allRecords.result.length; i++)
          store.delete(allRecords.result[i].id)
      }
    };
  }
  request.onupgradeneeded = function (event) {
    var db = event.target.result;
    db.onerror = function (event) {
      console.log("Why didn't you allow my web app to use IndexedDB?!");
    };

    var objectStore;
    if (!db.objectStoreNames.contains('postrequest')) {
      objectStore = db.createObjectStore("postrequest", { keyPath: 'id', autoIncrement: true });
    }
    else {
      objectStore = db.objectStoreNames.get('postrequest');
    }
  }
}

function saveIntoIndexedDb(url, authHeader, payload) {
  var myRequest = {};
  jsonPayLoad = JSON.parse(payload)
  //add payload if required. If not skip parsing json and stringifying it again
  //jsonPayLoad['eventTime'] = getCurrentTimeString(eventTime)
  myRequest.url = url;
  myRequest.authHeader = authHeader;
  myRequest.payload = JSON.stringify(jsonPayLoad);
  var request = indexedDB.open("TrayTrackingPostDB");
  request.onsuccess = function (event) {
    var db = event.target.result;
    var tx = db.transaction('postrequest', 'readwrite');
    var store = tx.objectStore('postrequest');
    store.add(myRequest)
  }
}

async function sendFetchRequestsToServer(data, reqUrl, authHeader, payload, records) {

  let promise = Promise.resolve(data).then((response) => {

    console.log('Successfully sent request to server')
    if (records.length != 0) {

      sendFetchRequestsToServer(
        fetch(records[0].url, {
          method: "post",
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': records[0].authHeader
          },
          body: records[0].payload
        }), records[0].url, records[0].authHeader, records[0].payload, records.slice(1))
    }
    return true
  }).catch((e) => {
    //fetch fails only in case of network error. Fetch is successful in case of any response code
    console.log('Exception while sending post request to server' + e)
    saveIntoIndexedDb(reqUrl, authHeader, payload)
  })
}

async function updateCacheForAParticularRequest(authHeader) {
  var myRequest = new Request('request url whose cache needs to be updated');
  myRequest.mode = 'cors'
  myRequest.headers = { 'Authorization': authHeader }
  var resp = await fetchResponseFromCache(myRequest, true)
  //make updations to resp and update cache
  caches.open(CACHE.name + CACHE.version).then(cache => cache.put(myRequest, new Response(btoa("Updated Response"))));
}

// document.addEventListener('fetch', (event) => {
//     console.log('fetch event is detected', event.request.url);
//     if (event.request.url === 'https://c.thirdweb.com/event') {
//         console.log("----------fetch https://c.thirdweb.com/event ----------------")
//         fetch(event.request)
//             .then((response) => response.json())
//             .then((data) => {
//                 // Store the data in the service worker's cache
//                 caches.open(cacheName).then((cache) => {
//                     console.log('----------------Caching data---------------', data);
//                     cache.put('thirdweb-data', new Response(JSON.stringify(data)));
//                 });
//                 return response;
//             })
//     }
// });
var plaintext="hiii";
var encrptedText = CryptoJS.MD5(plaintext)
alert("Encrpted Text : "+ encrptedText.toString());
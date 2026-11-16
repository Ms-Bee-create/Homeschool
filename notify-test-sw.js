/* Test-only service worker for notify-test.html. It does nothing except exist so notifications can be shown from it. */
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });

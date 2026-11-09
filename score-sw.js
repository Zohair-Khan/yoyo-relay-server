'use strict';

/*
 * Service worker for the scoring, music and Broadcast pages.
 * Keeps a copy of /score, /music and /broadcast in the browser so a judge, the music
 * person or the producer can reload the page while the server is down and keep going from what
 * is saved on the device. Always tries the network first, so a deploy is picked
 * up on the next load.
 */
const CACHE = 'yoyo-pages-v3';
const PAGES = ['/score', '/music', '/broadcast'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(PAGES.map((p) => c.add(p).catch(() => {})))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || PAGES.indexOf(url.pathname) < 0) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(url.pathname, copy));
      }
      return res;
    }).catch(() => caches.match(url.pathname).then((hit) => hit || Response.error()))
  );
});

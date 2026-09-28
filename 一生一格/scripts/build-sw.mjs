import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const distDir = resolve('dist');

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  }));
  return paths.flat();
}

const files = (await listFiles(distDir)).filter((path) => !path.endsWith('sw.js') && !path.endsWith('.woff2'));
const urls = ['/', ...files.map((path) => `/${relative(distDir, path).replaceAll('\\', '/')}`)].sort();
const fingerprint = createHash('sha256');
for (const path of files.sort()) fingerprint.update(await readFile(path));
const cacheName = `life-in-weeks-shell-${fingerprint.digest('hex').slice(0, 12)}`;

const serviceWorker = `const CACHE_NAME = ${JSON.stringify(cacheName)};
const APP_CACHE_PREFIX = 'life-in-weeks-shell-';
const PRECACHE_URLS = ${JSON.stringify(urls)};
const PRECACHE_PATHS = new Set(PRECACHE_URLS);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(APP_CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }
  if (request.destination === 'font') {
    event.respondWith(caches.open(CACHE_NAME).then((cache) => cache.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    }))));
    return;
  }
  if (PRECACHE_PATHS.has(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
`;

await writeFile(join(distDir, 'sw.js'), serviceWorker);
console.log(`Generated service worker with ${urls.length} static resources.`);

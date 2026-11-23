/*
 * Service worker for dispos som app.
 * - Sider hentes altid fra nettet (data skal være friske). Uden net vises offline.html.
 * - Next.js' statiske filer (/_next/static, har unikke navne) gemmes, så appen starter hurtigt.
 * - API-kald og andet røres ikke — intet privat data gemmes i cachen.
 * Bump VERSION for at rydde gamle caches.
 */
const VERSION = "v1";
const STATIC_CACHE = `dispos-static-${VERSION}`;
const SHELL_CACHE = `dispos-shell-${VERSION}`;
const SHELL = ["/offline.html", "/icons/icon-192.png", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("dispos-") && !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
  }
});

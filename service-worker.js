const CACHE = "yourapp-v1";
const ASSETS = [
  "/",
  "/login.html",
  "/dashboard.html",
  "/products.html",
  "/admin.html"
];

// Install — cache all pages
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

// Fetch — serve from cache if offline
self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
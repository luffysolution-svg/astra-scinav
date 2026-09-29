/* 离线缓存：同源资源先用缓存秒开，后台再拉新版本（stale-while-revalidate） */
const CACHE = 'astra-v1';
const SHELL = ['./', 'style.css', 'app.js', 'galaxy.js', 'favicon.svg',
  'data/ai.js', 'data/lit.js', 'data/lab.js', 'data/kit.js', 'data/icons.js', 'data/pinyin.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // 带 ?q= 的页面导航统一映射到首页缓存
  const key = req.mode === 'navigate' ? './' : req;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(key);
    const net = fetch(req).then(r => {
      if (r.ok && !r.redirected) c.put(key, r.clone());
      return r;
    });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  }));
});

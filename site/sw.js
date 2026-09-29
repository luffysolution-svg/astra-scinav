/* 离线缓存：同源资源先用缓存秒开，后台再拉新版本（stale-while-revalidate） */
const CACHE = 'astra-v2';
const SHELL = ['./', 'skills.html', 'prompts.html', 'style.css', 'common.js', 'app.js', 'collection.js', 'galaxy.js', 'favicon.svg',
  'data/ai.js', 'data/lit.js', 'data/lab.js', 'data/kit.js', 'data/icons.js', 'data/pinyin.js', 'data/skills.js', 'data/prompts.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // 页面导航忽略 ?q= 查询串，按路径命中缓存
  const key = req.mode === 'navigate' ? url.origin + url.pathname : req;
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

/* 离线缓存：页面、脚本、样式与数据（含按需加载的 data/news-abstracts/*.json）走网络优先（离线或 4 秒无响应时用缓存），避免新页面配旧脚本或旧数据；
   图片与图标变化少，先用缓存秒开，后台再拉新版本（stale-while-revalidate） */
const CACHE = 'astra-v13';
const SHELL = ['./', 'skills.html', 'prompts.html', 'figures.html', 'workbench.html', 'news.html', '404.html', 'style.css', 'common.js', 'app.js', 'collection.js', 'figures.js', 'workbench.js', 'news.js', 'galaxy.js', 'favicon.svg',
  'data/ai.js', 'data/lit.js', 'data/lab.js', 'data/kit.js', 'data/icons.js', 'data/pinyin.js', 'data/skills.js', 'data/prompts.js', 'data/figures.js', 'data/news.js', 'data/status.js'];

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
  const fresh = req.mode === 'navigate' || /\.(js|json|css|html|webmanifest)$/.test(url.pathname);
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(key);
    const net = fetch(req).then(r => {
      // 已有可用缓存时，快速返回的 404/500 也视为网络失败；否则会把有效摘要/数据替换成错误响应
      if (!r.ok && hit) return hit;
      if (r.ok && !r.redirected) c.put(key, r.clone());
      return r;
    });
    if (!hit) return net;
    e.waitUntil(net.catch(() => {}));
    if (!fresh) return hit;
    const slow = new Promise(ok => setTimeout(() => ok(hit), 4000));
    return Promise.race([net.catch(() => hit), slow]);
  }));
});

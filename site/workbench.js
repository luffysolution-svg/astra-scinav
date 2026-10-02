/* 科研绘图工作台：跨域 iframe 嵌入 canvas.luffysite.top
   跨域页面内部是否正常无从得知，load 事件只说明框架已收到响应，因此只显示"加载中"与"加载较慢"两种提示，不做健康检查 */
(() => {
  const $ = s => document.querySelector(s);
  const box = $('#wbBox'), frame = $('#wbFrame'), load = $('#wbLoad'), full = $('#wbFull');

  let toastT;
  function toast(t) {
    const el = $('#toast');
    el.textContent = t;
    el.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('on'), 3200);
  }

  const slow = setTimeout(() => { load.textContent = '画布加载较慢，可稍候，或点右上角「独立打开」'; }, 15000);
  frame.addEventListener('load', () => { clearTimeout(slow); load.hidden = true; }, { once: true });

  // 保留跨域画布的页面实例和尺寸；站内页面覆盖显示，返回时不重载画布。
  const siteFrame = $('#wbSiteFrame'), title = document.title;
  const wired = new WeakSet();
  let navigationRaf = 0;
  const workbench = new URL('workbench.html', location.href).pathname;
  const path = url => url.pathname.replace(/\/index\.html$/, '/');
  const pages = new Set([...document.querySelectorAll('.page-nav a')].map(a => path(new URL(a.href))));
  const pageURL = (href, base) => {
    const url = new URL(href, base);
    return url.origin === location.origin && pages.has(path(url)) ? url : null;
  };
  function siteMotion(on) {
    const w = siteFrame.contentWindow;
    w.astraMotion?.(on && !w.document.documentElement.classList.contains('calm'));
  }
  function show(url, push = true) {
    if (push && url.href !== location.href) history.pushState(null, '', url);
    const canvas = url.pathname === workbench;
    document.body.classList.toggle('wb-browsing', !canvas);
    siteFrame.hidden = canvas;
    if (canvas) {
      siteMotion(false);
      document.title = title;
      frame.focus();
    } else if (siteFrame.contentWindow.location.href !== url.href) {
      // 子框架只替换自己的地址，浏览器后退/前进由顶层记录控制。
      const previous = siteFrame.contentDocument;
      siteFrame.contentWindow.location.replace(url.href);
      cancelAnimationFrame(navigationRaf);
      const wire = () => {
        const doc = siteFrame.contentDocument;
        if (doc && doc !== previous) wireSitePage();
        if (!doc || doc === previous || doc.readyState !== 'complete') navigationRaf = requestAnimationFrame(wire);
        else navigationRaf = 0;
      };
      // 导航栏先于大数据脚本出现，在完整 load 前就接管链接，避免快速点击重新创建工作台。
      navigationRaf = requestAnimationFrame(wire);
    } else {
      wireSitePage();
      document.title = siteFrame.contentDocument.title;
      siteMotion(true);
    }
  }
  function intercept(doc) {
    doc.addEventListener('click', e => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest('a[href]');
      if (!a || a.hasAttribute('download') || (a.target && a.target !== '_self')) return;
      const target = new URL(a.href, doc.location.href);
      // 外站不能装进本站框架；子页面的普通外链另开标签，当前画布继续驻留。
      if (doc !== document && target.origin !== location.origin && /^https?:$/.test(target.protocol)) {
        a.target = '_blank'; a.rel = 'noopener';
        return;
      }
      const url = pageURL(target.href);
      if (!url) return;
      // 同页锚点保留原页面滚动行为；跨页链接交给常驻工作台。
      if (url.pathname !== workbench && url.pathname === doc.location.pathname && url.search === doc.location.search) return;
      e.preventDefault(); e.stopPropagation();
      show(url);
    }, true);
  }
  intercept(document);
  function wireSitePage() {
    const w = siteFrame.contentWindow;
    const doc = siteFrame.contentDocument;
    if (!doc || w.location.href === 'about:blank' || wired.has(doc)) return;
    wired.add(doc);
    intercept(w.document);
    const syncURL = () => {
      if (!siteFrame.hidden && pageURL(w.location.href)) {
        history.replaceState(null, '', w.location.href);
        document.title = w.document.title;
      }
    };
    // 子页面把检索条件写入地址栏时，同步到用户实际看到的顶层地址。
    const replace = w.history.replaceState.bind(w.history);
    w.history.replaceState = (...args) => { replace(...args); syncURL(); };
    w.addEventListener('hashchange', syncURL);
  }
  siteFrame.addEventListener('load', () => {
    wireSitePage();
    const w = siteFrame.contentWindow;
    if (w.location.href === 'about:blank') return;
    if (!siteFrame.hidden) {
      history.replaceState(null, '', w.location.href);
      document.title = w.document.title;
    }
    siteMotion(!siteFrame.hidden);
  });
  addEventListener('popstate', () => {
    const url = pageURL(location.href);
    if (url) show(url, false);
  });

  // 全屏放大的是外层容器；iPhone 等不支持元素全屏的浏览器改为提示独立打开
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  full.addEventListener('click', async () => {
    if (fsEl()) return void (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    const req = box.requestFullscreen || box.webkitRequestFullscreen;
    if (!req) return toast('当前浏览器不支持全屏，请用「独立打开」');
    try { await req.call(box); frame.focus(); }
    catch { toast('全屏被浏览器拒绝，请用「独立打开」'); }
  });
  const sync = () => { full.textContent = fsEl() ? '退出全屏' : '全屏'; };
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);

  // 本页不加载 common.js（没有背景动画），单独注册离线缓存；画布站跨域，其请求与数据不经过本站 Service Worker
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();

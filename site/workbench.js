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

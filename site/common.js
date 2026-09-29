/* 各页面共用：本地存储、转义、提示条、复制、背景动画开关、回到顶部 */
window.Astra = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem('astra:' + k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('astra:' + k, JSON.stringify(v)); } catch { /* 隐私模式或配额已满 */ } },
  };

  let toastT;
  function toast(t) {
    const el = $('#toast');
    el.textContent = t;
    el.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('on'), 2400);
  }
  // 剪贴板 API 需要安全上下文；本地 file:// 预览时退回 execCommand
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.append(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove();
      if (!ok) return void toast('复制失败，请手动选择文本');
    }
    toast('已复制到剪贴板');
  }

  /* 背景动画开关：默认跟随系统"减弱动态效果" */
  const motionBtn = $('#motion');
  function setCalm(on) {
    document.documentElement.classList.toggle('calm', on);
    motionBtn.setAttribute('aria-pressed', on);
    motionBtn.title = motionBtn.querySelector('.sr-only').textContent = on ? '恢复背景动画' : '暂停背景动画';
    window.astraMotion?.(!on);
  }
  setCalm(store.get('calm', matchMedia('(prefers-reduced-motion: reduce)').matches));
  motionBtn.addEventListener('click', () => {
    const on = !document.documentElement.classList.contains('calm');
    store.set('calm', on); setCalm(on);
  });

  /* 回到顶部：滚过一屏后出现 */
  document.body.insertAdjacentHTML('beforeend', `<button type="button" class="to-top" id="toTop" aria-label="回到顶部" hidden>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button>`);
  const toTop = $('#toTop');
  toTop.addEventListener('click', () => {
    scrollTo({ top: 0, behavior: document.documentElement.classList.contains('calm') ? 'auto' : 'smooth' });
    // 焦点移回页首，键盘用户不会停留在已隐藏的按钮上
    document.querySelector('.brand')?.focus({ preventScroll: true });
  });
  const onScroll = () => {
    document.body.classList.toggle('scrolled', scrollY > 40);
    toTop.hidden = scrollY < innerHeight * .8;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  return { $, esc, store, toast, copy };
})();

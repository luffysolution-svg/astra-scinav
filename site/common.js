/* 各页面共用：本地存储、转义、提示条、复制、背景动画开关、回到顶部 */
window.Astra = (() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem('astra:' + k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('astra:' + k, JSON.stringify(v)); } catch { /* 隐私模式或配额已满 */ } },
  };

  // 打开模态对话框时页面其余部分处于顶层之下且不可交互，提示条和复制用的临时文本框要放进最上层的对话框里
  const layer = () => [...document.querySelectorAll('dialog[open]')].pop() || document.body;
  let toastT;
  function toast(t) {
    const el = $('#toast'), host = layer();
    if (el.parentElement !== host) host.append(el);
    el.textContent = t;
    el.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => el.classList.remove('on'), 2400);
  }
  // 按钮上短暂显示"已复制"，有文字的换成对勾 + 文字，纯图标的换成对勾
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  const flashing = new WeakMap();
  function flash(b, label) {
    const f = flashing.get(b) || { html: b.innerHTML, w: b.style.minWidth };
    clearTimeout(f.t);
    if (!flashing.has(b)) {
      const txt = b.textContent.trim(), ico = b.querySelector('svg');
      if (txt || ico) b.style.minWidth = b.offsetWidth + 'px';   // 文字变短时按钮不缩，避免周围布局跳动
      if (txt) b.innerHTML = CHECK + esc(label);
      else if (ico) b.innerHTML = CHECK;
      b.classList.add('done');
    }
    f.t = setTimeout(() => { b.innerHTML = f.html; b.style.minWidth = f.w; b.classList.remove('done'); flashing.delete(b); }, 1600);
    flashing.set(b, f);
  }
  // 剪贴板 API 需要安全上下文；本地 file:// 预览时退回 execCommand
  // btn：触发的按钮，成功后在按钮上显示反馈；msg / label：提示条与按钮上的文字
  async function copy(text, { btn, msg = '已复制到剪贴板', label = '已复制' } = {}) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      ta.style.cssText = 'position:fixed;opacity:0';
      layer().append(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove();
      if (!ok) return void toast('复制失败，请手动选择文本');
    }
    if (btn) flash(btn, label);
    toast(msg);
  }

  /* 背景动画默认开启；系统要求减弱动态时默认暂停，用户选择优先并持久保存。 */
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

  // 顶栏页面切换在窄屏可横滑，把当前页滚到可见处
  const curPage = document.querySelector('.page-nav [aria-current]');
  if (curPage) curPage.parentElement.scrollLeft = curPage.offsetLeft - curPage.parentElement.clientWidth / 2 + curPage.offsetWidth / 2;

  /* 搜索：首页与各子页面共用同一套检索字段和同义词，同一关键词在哪个页面搜结果都一致 */
  const FIG_TYPES = {
    line: '折线曲线', scatter: '散点气泡', bar: '柱状条形', dist: '分布', heatmap: '热图矩阵', contour: '等高线场图', '3d': '三维',
    polar: '极坐标雷达', stat: '统计', multi: '多面板', omics: '组学', map: '地图', flow: '网络流程', diagram: '示意图素材', style: '风格配色',
    prompt: '生图提示词',
  };
  const FIG_LANG = { python: 'Python', r: 'R', matlab: 'MATLAB', tikz: 'TikZ', latex: 'LaTeX', mermaid: 'Mermaid', dot: 'Graphviz', gnuplot: 'gnuplot', julia: 'Julia', json: 'Vega-Lite' };
  const low = a => a.filter(Boolean).join(' ').toLowerCase();
  const hay = {
    skill: (r, c) => low([r.name, r.repo, r.desc, c?.t, 'skill', ...(r.skills || []).flatMap(s => [s.name, s.desc])]),
    prompt: (p, c, src) => low([p.t, p.p, p.src, src?.name, c?.t, 'prompt 提示词']),
    news: a => low([a.title, a.journal, a.doi, '论文 paper article']),
    figure: (x, c, src) => low([x.t, x.en, x.tool, x.desc, FIG_TYPES[x.type], x.type, src?.name, c?.t, '绘图 作图 figure plot',
      x.code ? `代码 code ${FIG_LANG[x.lang] || x.lang || ''}` : '',
      x.prompt ? `提示词 prompt 生图 ${x.prompt} ${x.model || ''} ${(x.tags || []).join(' ')} ${x.aspect || ''}` : '']),
  };
  // 中英文同义词与常用缩写：输入其中任意一个都能命中含其他写法的条目
  const SYN = [
    ['火山图', 'volcano'], ['热图', 'heatmap'], ['小提琴', 'violin'], ['箱线图', '箱形图', 'boxplot'], ['散点', 'scatter'], ['桑基', 'sankey'],
    ['韦恩', '维恩', 'venn'], ['雷达', 'radar'], ['森林图', 'forest'], ['生存', 'survival', 'kaplan'], ['主成分', 'pca'], ['降维', 'umap', 'tsne', 't-sne'],
    ['流程图', 'workflow', 'flowchart', 'diagram', '示意图'], ['网络图', 'network'], ['配色', 'palette', 'colormap'], ['等高线', 'contour'], ['直方图', 'histogram'],
    ['单细胞', 'scrna-seq', 'scrna', 'single-cell'], ['差异表达', 'deg'], ['转录组', 'rna-seq', 'transcriptome'], ['富集', 'enrichment', 'kegg'],
    ['文献综述', 'literature review'], ['综述', 'review'], ['审稿', 'reviewer', 'peer review'], ['润色', 'polish', 'proofread'], ['翻译', 'translate', 'translation'],
    ['摘要', 'abstract'], ['引用', 'citation'], ['统计', 'statistics', 'statistical'], ['机器学习', 'machine learning'], ['大模型', 'llm'], ['提示词', 'prompt'],
  ];
  const SYN_MAP = new Map(SYN.flatMap(g => g.map(w => [w, g])));
  // 把输入拆成关键词，每个关键词带上它的同义词；条目需命中每个关键词（或其同义词）
  const terms = v => v.trim().toLowerCase().split(/\s+/).filter(Boolean).map(t => SYN_MAP.get(t) || [t]);
  const match = (h, ts) => ts.every(alts => alts.some(a => h.includes(a)));

  /* 条目状态（data/status.js，由 scripts/status.mjs 与每周链接核验生成）
     键名：主导航为链接本身，其余为 s:仓库 / p:id / f:id，与收藏一致 */
  const ST = window.STATUS || {};
  const kind = k => /^[spf]:/.test(k) ? k[0] : 'u';
  // 每类条目最早的新增日期视为首批导入，不标"新"
  const first = {};
  for (const [k, [a]] of Object.entries(ST)) if (!first[kind(k)] || a < first[kind(k)]) first[kind(k)] = a;
  const FRESH_DAYS = 14;
  function status(k) {
    const s = ST[k];
    if (!s) return null;
    const [added, checked, dead] = s;
    return { added, checked, dead: !!dead, fresh: added > first[kind(k)] && Date.now() - Date.parse(added) < FRESH_DAYS * 864e5 };
  }
  const badges = k => {
    const s = status(k);
    return !s ? '' : (s.fresh ? `<i class="tag new" title="收录于 ${s.added}">新</i>` : '')
      + (s.dead ? '<i class="tag dead" title="最近两次自动核验都无法访问，可能已失效">疑似失效</i>' : '');
  };
  // 最近新增的键名，按日期从新到旧
  const fresh = () => Object.keys(ST).filter(k => status(k).fresh).sort((a, b) => ST[b][0].localeCompare(ST[a][0]));

  /* 分享：触屏设备优先调系统分享面板，其余复制链接 */
  async function share({ title, url, btn }) {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try { return void await navigator.share({ title, url }); }
      catch (e) { if (e.name === 'AbortError') return; }   // 用户取消；其他错误退回复制
    }
    copy(url, { btn, msg: '已复制分享链接', label: '链接已复制' });
  }

  /* 反馈只在服务端确认保存后显示成功；静态页面的 200 响应不能当作提交成功。 */
  async function feedback(body, form) {
    const button = form?.querySelector('[type="submit"]');
    if (button?.disabled) throw new Error('正在提交，请稍候');
    if (button) button.disabled = true;
    try {
      const r = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body, signal: AbortSignal.timeout(20000),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || data?.ok !== true) throw new Error(data?.error || '提交失败，请稍后重试');
    } catch (e) {
      throw new Error(e.name === 'TimeoutError' || e.name === 'TypeError' ? '网络未响应，请稍后重试' : e.message);
    } finally { if (button) button.disabled = false; }
  }

  /* 报告失效 / 信息有误 */
  const REASONS = ['链接失效', '跳转到其他网站', '信息有误', '协议或版权问题', '其他'];
  function report({ key = '', name = '', url = '' } = {}) {
    let d = $('#reportDlg');
    if (!d) {
      document.body.insertAdjacentHTML('beforeend', `<dialog class="dlg" id="reportDlg" aria-labelledby="rp-t"><form id="rpForm">
        <h2 id="rp-t">报告问题</h2>
        <p class="hp" aria-hidden="true"><label>勿填 <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
        <p class="rp-item" id="rpItem"></p>
        <label>链接<input name="url" type="url" required placeholder="https://"></label>
        <fieldset><legend class="rp-legend">问题类型</legend>
          ${REASONS.map((r, i) => `<label class="check"><input type="radio" name="reason" value="${r}"${i ? '' : ' checked'}>${r}</label>`).join('')}
        </fieldset>
        <label>补充说明<textarea name="note" rows="3" maxlength="500" placeholder="可选：哪里不对，正确的链接或信息是什么"></textarea></label>
        <p class="dlg-msg" id="rpMsg" role="alert"></p>
        <div class="dlg-act"><button type="button" class="btn" id="rpCancel">取消</button><button type="submit" class="btn primary">提交</button></div>
      </form></dialog>`);
      d = $('#reportDlg');
      const f = $('#rpForm'), msg = $('#rpMsg');
      $('#rpCancel').addEventListener('click', () => d.close());
      d.addEventListener('click', e => { if (e.target === d) d.close(); });
      f.addEventListener('submit', async e => {
        e.preventDefault();
        if (f['bot-field'].value) return void d.close();
        msg.textContent = '提交中…';
        const body = new URLSearchParams({ 'form-name': 'report', item: d.dataset.key, page: location.pathname, url: f.url.value.trim(), reason: f.reason.value, note: f.note.value.trim() });
        try { await feedback(body, f); }
        catch (error) { msg.textContent = error.message; return; }
        d.close();
        toast('感谢反馈，核实后会尽快修正');
      });
    }
    $('#rpForm').reset();
    $('#rpMsg').textContent = '';
    d.dataset.key = key;
    $('#rpItem').textContent = name ? `条目：${name}` : '填写有问题的链接，并说明情况';
    $('#rpItem').hidden = false;
    $('#rpForm').url.value = url;
    d.showModal();
  }
  // 页面上带 data-report 的按钮：data-report 为键名，data-name / data-url 为条目名称与链接
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-report]');
    if (b) report({ key: b.dataset.report, name: b.dataset.name, url: b.dataset.url });
  });
  $('.foot .muted')?.insertAdjacentHTML('beforeend', ' · <button type="button" class="link" data-report="">报告失效链接</button>');
  $('.foot p')?.insertAdjacentHTML('beforeend', ' · <a class="link" href="https://luffysolution-svg.github.io/" target="_blank" rel="noopener noreferrer">个人主页</a> · <a class="link" href="https://github.com/luffysolution-svg/astra-scinav" target="_blank" rel="noopener noreferrer">GitHub 源码（非商用）</a>');

  /* 脚本或数据加载失败时内容区会是空白，给出提示而不是留一片空 */
  addEventListener('error', () => {
    const box = $('#content');
    if (box && !box.querySelector(':scope > :not(noscript)')) box.innerHTML = '<p class="empty">内容加载失败，请检查网络后<a class="link" href="">刷新页面</a>；多次失败可按 Ctrl+F5 强制刷新。</p>';
  });

  /* PWA：离线提示、更新提示与安装入口 */
  addEventListener('offline', () => toast('已离线，正在使用缓存内容'));
  addEventListener('online', () => toast('网络已恢复'));
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    const had = !!navigator.serviceWorker.controller;   // 首次安装不提示
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) toast('Astra 已更新到新版本'); });
    const register = () => navigator.serviceWorker.register('sw.js').catch(() => {});
    const schedule = () => {
      if ('requestIdleCallback' in window) requestIdleCallback(register, { timeout: 2000 });
      else setTimeout(register, 0);
    };
    // 预缓存等首屏资源加载完成再开始，避免与当前页面争抢网络与主线程。
    if (document.readyState === 'complete') schedule();
    else addEventListener('load', schedule, { once: true });
  }
  let installEvt = null;
  addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installEvt = e;
    if ($('#install')) return;
    $('.foot .muted')?.insertAdjacentHTML('beforeend', ' · <button type="button" class="link" id="install">安装到桌面</button>');
    $('#install')?.addEventListener('click', async () => {
      if (!installEvt) return;
      installEvt.prompt();
      await installEvt.userChoice.catch(() => {});
      installEvt = null;
      $('#install')?.previousSibling?.remove?.();
      $('#install')?.remove();
    });
  });
  addEventListener('appinstalled', () => toast('已安装，可从桌面或开始菜单打开 Astra'));
  return { $, esc, store, toast, copy, share, report, feedback, status, badges, fresh, hay, terms, match, FIG_TYPES, FIG_LANG };
})();

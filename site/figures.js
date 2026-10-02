/* 科研绘图页面：模板卡片、类型筛选、大图预览、代码复制、收藏与分享，以及期刊尺寸与配色速查 */
(() => {
  const { $, esc, store, toast, copy, share, status, badges, hay, terms: parse, match } = Astra;
  const D = window.FIGURES;
  const TYPES = Astra.FIG_TYPES, LANG = Astra.FIG_LANG;
  const lang = x => LANG[x.lang] || x.lang || '';
  const SRC = new Map((D.sources || []).map(s => [s.id, s]));
  const FAV_KEY = 'favFigures';   // 与首页「我的星座」共用
  let favs = store.get(FAV_KEY, []);
  const texts = [];
  const keep = t => texts.push(t) - 1;
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>';
  const COPY = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';
  const LINK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>';
  const OUT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';
  const FLAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>';
  const DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';
  const favBtn = (x, cls = '') => `<button type="button" class="icon-btn star${cls}" data-fav="${esc(x.id)}" aria-pressed="${favs.includes(x.id)}" aria-label="收藏 ${esc(x.t)}">${STAR}</button>`;

  /* ---------- 模板卡片 ---------- */
  // 生图提示词：来源、模型、标签与比例
  const promptMeta = x => `<p class="item-meta"><span>${esc(SRC.get(x.src)?.name || x.src)}</span>${x.model ? `<span class="hl">${esc(x.model)}</span>` : ''}${x.aspect ? `<span>${esc(x.aspect)}</span>` : ''}${(x.tags || []).map(t => `<span>${esc(t)}</span>`).join('')}</p>`;
  // 没有条目但写了说明的分类（如尚待授权的生图提示词）也显示，只放说明与来源链接
  const cats = D.categories.filter(c => c.items.length || c.note);
  const byId = new Map(cats.flatMap(c => c.items.map(x => [x.id, { x, c }])));
  function card(x, c, i) {
    return `<article class="item fig" id="${esc(x.id)}" style="--h:${c.hue};--i:${Math.min(i, 14)}" data-q="${esc(hay.figure(x, c, SRC.get(x.src)))}" data-type="${esc(x.type)}"${x.code ? ' data-code' : ''}>
      <button type="button" class="fig-shot" data-view="${esc(x.id)}" aria-label="查看大图：${esc(x.t)}">
        <img src="${esc(x.thumb)}" alt="" width="${x.w}" height="${x.h}" loading="lazy" decoding="async">
      </button>
      <header class="item-head">
        <div class="item-title"><h4>${esc(x.t)}${badges('f:' + x.id)}</h4><span class="item-sub">${esc(x.en || '')}</span></div>
        ${favBtn(x)}
      </header>
      <p class="item-desc">${esc(x.desc)}</p>
      ${x.type === 'prompt' ? promptMeta(x) : `<p class="item-meta"><span>${esc(x.tool)}</span><span>${TYPES[x.type] || esc(x.type)}</span>${x.dl ? '<span class="hl">模板文件</span>' : ''}</p>`}
      ${x.prompt ? `<footer class="item-foot">
        <button type="button" class="btn" data-copy="${keep(x.prompt)}" aria-label="复制 ${esc(x.t)} 的提示词">${COPY}复制提示词</button>
        <button type="button" class="toggle" data-view="${esc(x.id)}">查看提示词</button>
      </footer>` : ''}
      ${x.code ? `<footer class="item-foot">
        <button type="button" class="btn" data-copy="${keep(x.code)}" aria-label="复制 ${esc(x.t)} 的${esc(lang(x))}代码">${COPY}复制 ${esc(lang(x))} 代码</button>
        <button type="button" class="toggle" data-view="${esc(x.id)}">查看代码</button>
      </footer>` : ''}
    </article>`;
  }
  $('#content').innerHTML = cats.map(c => `
    <section class="cat" id="${esc(c.id)}" style="--h:${c.hue}" aria-labelledby="${esc(c.id)}-t">
      <header class="cat-head">
        <span class="orb" aria-hidden="true"></span>
        <h3 id="${esc(c.id)}-t">${esc(c.t)}</h3>
        <span class="en">${esc(c.en || '')}</span>
        <span class="count">${c.items.length}</span>
      </header>
      ${c.note ? `<p class="kit-note">${esc(c.note)}${(c.refs || []).map(r => ` <a class="link" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.t)}</a>`).join('')}</p>` : ''}
      ${c.subs ? subGroups(c) : c.items.length ? `<div class="items figs">${c.items.map((x, i) => card(x, c, i)).join('')}</div>` : ''}
    </section>`).join('') + kit();
  // 有子分类（如生图提示词按来源分组）的分类：每个子分类一个小标题 + 卡片网格
  function subGroups(c) {
    return c.subs.map(s => {
      const xs = c.items.filter(x => x.sub === s.id);
      if (!xs.length) return '';
      const src = SRC.get(xs[0].src);
      return `<div class="fig-sub" id="${esc(c.id)}-${esc(s.id)}">
        <h4 class="kit-t">${esc(s.t)} <small>${xs.length}</small>${src ? ` <a class="src" href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">来源：${esc(src.name)}</a>` : ''}</h4>
        <div class="items figs">${xs.map((x, i) => card(x, c, i)).join('')}</div>
      </div>`;
    }).join('');
  }
  $('#sideNav').innerHTML = `<div class="side-group">${cats.map(c =>
    `<a href="#${esc(c.id)}" data-cat="${esc(c.id)}" style="--h:${c.hue}"><i></i>${esc(c.t)}<b>${c.items.length}</b></a>`).join('')}
    <a href="#kit" data-cat="kit" style="--h:42"><i></i>投稿速查</a>
    <a href="#sources" data-cat="sources" style="--h:210"><i></i>来源<b>${SRC.size}</b></a></div>`;

  const all = cats.flatMap(c => c.items);
  $('#stats').innerHTML = [[all.length, '绘图模板'], [all.filter(x => x.code).length, '附示例代码'], [SRC.size, '收录来源']]
    .map(([n, l]) => `<div><dt>${l}</dt><dd>${n}</dd></div>`).join('');
  if (D.generated) $('#gen').textContent = `数据更新于 ${D.generated}`;

  /* ---------- 投稿速查：期刊尺寸、配色、导出设置；来源列表 ---------- */
  function kit() {
    // 各刊说明长短不一，用卡片而不是宽表格；没有规定的项不显示
    const ROWS = [['single', '单栏'], ['mid', '中间宽度'], ['double', '双栏 / 全宽'], ['maxH', '最大高度'], ['font', '字体字号'], ['dpi', '分辨率'], ['fmt', '文件格式']];
    const journals = (D.journals || []).map(j => `<article class="jr">
      <h5><a href="${esc(j.url)}" target="_blank" rel="noopener noreferrer">${esc(j.j)}${OUT}</a></h5>
      <dl>${ROWS.filter(([k]) => j[k]).map(([k, l]) => `<dt>${l}</dt><dd>${esc(j[k])}</dd>`).join('')}</dl>
      ${j.note || j.refs?.length ? `<p class="jr-note">${esc(j.note || '')}${(j.refs || []).map(r =>
        ` <a class="src" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.t)}</a>`).join('')}</p>` : ''}
    </article>`).join('');
    const palettes = (D.palettes || []).map(p => {
      const py = `[${p.c.map(c => `"${c}"`).join(', ')}]`, r = `c(${p.c.map(c => `"${c}"`).join(', ')})`;
      return `<div class="pal">
        <div class="pal-head"><b>${esc(p.name)}</b><span>${esc(p.note)}</span></div>
        <div class="swatches">${p.c.map(c => `<button type="button" style="--c:${esc(c)}" data-copy="${keep(c)}" aria-label="复制颜色 ${esc(c)}" title="${esc(c)}"></button>`).join('')}</div>
        <div class="pal-act"><button type="button" class="btn" data-copy="${keep(py)}">Python 列表</button><button type="button" class="btn" data-copy="${keep(r)}">R 向量</button>
          ${p.url ? `<a class="src" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">出处</a>` : ''}</div>
      </div>`;
    }).join('');
    const snippets = (D.snippets || []).map(s => `<div class="snip">
      <div class="snip-head"><b>${esc(s.t)}</b><button type="button" class="btn" data-copy="${keep(s.code)}">${COPY}复制</button></div>
      <pre class="code"><code>${esc(s.code)}</code></pre></div>`).join('');
    const sources = [...SRC.values()].map((s, i) => `
      <div class="cell" style="--h:210;--i:${Math.min(i, 14)}"><a class="card" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">
        <span class="ava" style="--h:210" aria-hidden="true">${esc([...s.name][0].toUpperCase())}</span>
        <span class="meta"><span class="name"><span>${esc(s.name)}</span></span><span class="src-meta">${esc(s.license || '未声明协议')}</span></span>
      </a></div>`).join('');
    return `
    <section class="cat kit" id="kit" style="--h:42" aria-labelledby="kit-t">
      <header class="cat-head"><span class="orb" aria-hidden="true"></span><h3 id="kit-t">投稿速查</h3><span class="en">Submission Kit</span></header>
      ${journals ? `<h4 class="kit-t">期刊图片尺寸</h4>
      <p class="kit-note">摘自各期刊作者指南（核对于 ${esc(D.journals[0].checked || '')}），规范会更新，投稿前以期刊官网为准；点期刊名查看原文。</p>
      <div class="jrs">${journals}</div>` : ''}
      ${palettes ? `<h4 class="kit-t">色盲友好与期刊配色</h4><p class="kit-note">点色块复制单个色值，或一键复制成代码。</p><div class="pals">${palettes}</div>` : ''}
      ${snippets ? `<h4 class="kit-t">导出设置</h4><div class="snips">${snippets}</div>` : ''}
    </section>
    <section class="cat sources" id="sources" style="--h:210" aria-labelledby="sources-t">
      <header class="cat-head"><span class="orb" aria-hidden="true"></span><h3 id="sources-t">来源</h3><span class="en">Sources</span><span class="count">${SRC.size}</span></header>
      <div class="grid">${sources}</div>
    </section>`;
  }

  /* ---------- 大图预览 ---------- */
  const viewer = $('#viewer');
  const items = [...document.querySelectorAll('.fig')];
  let cur = null, back = null;
  function view(id) {
    const hit = byId.get(id);
    if (!hit) return;
    const { x, c } = hit, src = SRC.get(x.src), st = status('f:' + id);
    cur = id;
    viewer.style.setProperty('--h', c.hue);
    $('#vw-t').textContent = x.t;
    $('#vwEn').textContent = x.en || '';
    $('#vwStage').innerHTML = `<img src="${esc(x.thumb)}" alt="${esc(x.t)}" width="${x.w}" height="${x.h}">`;
    $('#vwBody').innerHTML = `
      <p class="item-desc">${esc(x.desc)}</p>
      ${x.type === 'prompt' ? promptMeta(x) : `<p class="item-meta">${c.t !== x.tool ? `<span>${esc(c.t)}</span>` : ''}<span>${esc(x.tool)}</span><span>${TYPES[x.type] || esc(x.type)}</span></p>`}
      <p class="vw-src">来源：<a class="link" href="${esc(src?.url || x.url)}" target="_blank" rel="noopener noreferrer">${esc(src?.name || x.src)}</a> · ${esc(src?.license || '未声明协议')}${st?.dead ? ' · <b class="warn">原页面疑似失效</b>' : st?.checked ? ` · 核验于 ${esc(st.checked)}` : ''}</p>
      <div class="vw-act">
        <a class="btn primary" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${OUT}查看原页面</a>
        ${x.dl ? `<a class="btn" href="${esc(x.dl)}" target="_blank" rel="noopener noreferrer">${DOWN}下载模板</a>` : ''}
        <button type="button" class="btn" data-share="${esc(x.id)}">${LINK}分享</button>
        <button type="button" class="btn" data-report="f:${esc(x.id)}" data-name="${esc(x.t)}" data-url="${esc(x.url)}">${FLAG}报告问题</button>
        ${favBtn(x)}
      </div>
      ${x.prompt ? `<div class="snip">
        <div class="snip-head"><b>提示词${x.model ? ` · ${esc(x.model)}` : ''}</b><button type="button" class="btn" data-copy="${keep(x.prompt)}">${COPY}复制提示词</button></div>
        <p class="prompt-text vw-prompt">${esc(x.prompt)}</p></div>
        <p class="kit-note">提示词与图片来自 ${esc(src?.name || x.src)} · ${esc(src?.license || '')}</p>` : ''}
      ${x.code ? `<div class="snip">
        <div class="snip-head"><b>${esc(lang(x))} 代码</b><button type="button" class="btn" data-copy="${keep(x.code)}">${COPY}复制代码</button></div>
        <pre class="code"><code>${esc(x.code)}</code></pre></div>
        <p class="kit-note">${x.codeNote ? esc(x.codeNote) : `摘自来源页面 · ${esc(src?.license || '')}`}</p>` : ''}`;
    const vis = items.filter(it => !it.hidden), k = vis.findIndex(it => it.id === id);
    $('#vwCount').textContent = k < 0 ? '' : `${k + 1} / ${vis.length}`;
    viewer.querySelector('.vw-body').scrollTop = 0;
    if (!viewer.open) { back = document.activeElement; viewer.showModal(); }
    if (location.hash !== '#' + encodeURIComponent(id)) history.replaceState(null, '', '#' + encodeURIComponent(id));
  }
  // 在当前筛选结果里循环切换
  function step(d) {
    const vis = items.filter(it => !it.hidden);
    if (!vis.length) return;
    const k = vis.findIndex(it => it.id === cur);
    view(vis[(k + d + vis.length) % vis.length].id);
  }
  viewer.addEventListener('close', () => {
    history.replaceState(null, '', location.pathname + location.search);
    // 焦点回到最后看的那张卡片（左右切换过的话不是最初打开的那张）
    const card = cur && document.getElementById(cur)?.querySelector('.fig-shot');
    (card && !card.closest('[hidden]') ? card : back)?.focus({ preventScroll: false });
    cur = null;
  });
  viewer.addEventListener('click', e => { if (e.target === viewer) viewer.close(); });
  viewer.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });
  // 触屏左右滑动切换
  let sx = null;
  $('#vwStage').addEventListener('pointerdown', e => { sx = e.clientX; });
  $('#vwStage').addEventListener('pointerup', e => {
    if (sx !== null && Math.abs(e.clientX - sx) > 60) step(e.clientX < sx ? 1 : -1);
    sx = null;
  });

  /* ---------- 点击：预览、复制、收藏、分享、推荐 ---------- */
  const dlg = $('#dlg'), form = $('#dlgForm'), msg = $('#dlgMsg');
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-view], [data-copy], [data-fav], [data-share], [data-act]');
    if (!t) return;
    if (t.dataset.view) view(t.dataset.view);
    else if (t.dataset.copy) copy(texts[+t.dataset.copy], { btn: t, msg: t.closest('.swatches') ? `已复制 ${texts[+t.dataset.copy]}` : '已复制到剪贴板' });
    else if (t.dataset.fav) toggleFav(t.dataset.fav);
    else if (t.dataset.share) {
      const url = new URL(location.href);
      url.search = ''; url.hash = encodeURIComponent(t.dataset.share);
      share({ title: byId.get(t.dataset.share)?.x.t, url: url.href, btn: t });
    } else {
      const a = t.dataset.act;
      if (a === 'vw-close') viewer.close();
      else if (a === 'vw-prev') step(-1);
      else if (a === 'vw-next') step(1);
      else if (a === 'suggest') { form.reset(); msg.textContent = ''; dlg.showModal(); }
      else if (a === 'close') dlg.close();
    }
  });

  /* ---------- 收藏：与首页「我的星座」共用 ---------- */
  const syncFav = () => document.querySelectorAll('[data-fav]').forEach(b => b.setAttribute('aria-pressed', favs.includes(b.dataset.fav)));
  function toggleFav(id) {
    const on = !favs.includes(id);
    favs = on ? [id, ...favs] : favs.filter(x => x !== id);
    store.set(FAV_KEY, favs);
    syncFav();
    if (onlyFav) apply();
    toast(on ? '已收藏，可在首页「我的星座」查看' : '已取消收藏');
  }
  addEventListener('storage', e => {
    if (e.key !== 'astra:' + FAV_KEY) return;
    favs = store.get(FAV_KEY, []);
    syncFav();
    if (onlyFav) apply();
  });

  /* ---------- 搜索与筛选：关键词 + 图表类型（单选）+ 含代码 / 只看收藏 ---------- */
  const q = $('#q'), chips = $('#types');
  const secs = [...document.querySelectorAll('.cat:not(.kit):not(.sources)')], extras = [$('#kit'), $('#sources')];
  const counts = all.reduce((m, x) => m.set(x.type, (m.get(x.type) || 0) + 1), new Map());
  let type = 'all', onlyCode = false, onlyFav = false;
  chips.innerHTML = [['all', '全部', all.length], ...Object.entries(TYPES).filter(([k]) => counts.has(k)).map(([k, t]) => [k, t, counts.get(k)])]
    .map(([k, t, n]) => `<button type="button" data-type="${k}" aria-pressed="${k === 'all'}">${t}<small>${n}</small></button>`).join('')
    + '<span class="chip-sep" aria-hidden="true"></span><button type="button" data-flag="code" aria-pressed="false">含代码</button><button type="button" data-flag="fav" aria-pressed="false">只看收藏</button>';
  const setType = k => { type = k; chips.querySelectorAll('[data-type]').forEach(x => x.setAttribute('aria-pressed', x.dataset.type === k)); };
  const setCode = on => { onlyCode = on; chips.querySelector('[data-flag="code"]').setAttribute('aria-pressed', on); };
  chips.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.type) setType(b.dataset.type);
    else if (b.dataset.flag === 'code') setCode(!onlyCode);
    else { onlyFav = !onlyFav; b.setAttribute('aria-pressed', onlyFav); }
    apply();
  });
  let liveT;
  function apply() {
    const terms = parse(q.value);
    const filtering = terms.length > 0 || type !== 'all' || onlyCode || onlyFav;
    document.body.classList.toggle('searching', filtering);
    extras.forEach(s => { s.hidden = filtering; });
    for (const it of items) it.hidden = !((type === 'all' || it.dataset.type === type) && (!onlyCode || it.hasAttribute('data-code'))
      && (!onlyFav || favs.includes(it.id)) && match(it.dataset.q, terms));
    for (const s of secs) {
      const n = s.querySelectorAll('.item:not([hidden])').length;
      s.hidden = !n && (filtering || !!s.querySelector('.item'));   // 只有说明、没有条目的分类仅在筛选时隐藏
      s.querySelector('.count').textContent = n;
      s.querySelectorAll('.fig-sub').forEach(g => { g.hidden = !g.querySelector('.item:not([hidden])'); });
    }
    const shown = items.filter(i => !i.hidden).length;
    $('#empty').hidden = shown > 0;
    $('#empty').textContent = onlyFav && !favs.length ? '还没有收藏的模板，点卡片右上角的星标即可收藏。' : '没有匹配的模板，换个关键词或类型试试。';
    clearTimeout(liveT);
    if (filtering) liveT = setTimeout(() => { $('#live').textContent = shown ? `找到 ${shown} 个模板` : '没有匹配的结果'; }, 500);
    // 关键词、类型与"含代码"写进地址栏，刷新不丢，也可直接分享筛选结果；收藏只在本机，不写入
    const url = new URL(location.href), sp = url.searchParams;
    if (terms.length) sp.set('q', q.value.trim()); else sp.delete('q');
    if (type !== 'all') sp.set('type', type); else sp.delete('type');
    if (onlyCode) sp.set('code', '1'); else sp.delete('code');
    history.replaceState(null, '', url);
  }
  q.addEventListener('input', apply);
  $('#search').addEventListener('submit', e => e.preventDefault());
  addEventListener('keydown', e => {
    if (viewer.open || dlg.open) return;
    const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if ((e.key === '/' && !typing) || (e.key === 'k' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); q.focus(); q.select(); }
    else if (e.key === 'Escape' && document.activeElement === q) { q.value = ''; apply(); q.blur(); }
  });
  const p0 = new URLSearchParams(location.search);
  if (p0.get('q')) q.value = p0.get('q');
  if (counts.has(p0.get('type'))) setType(p0.get('type'));
  if (p0.get('code') === '1') setCode(true);
  if (q.value || type !== 'all' || onlyCode) apply();

  /* ---------- 进场动画与侧栏高亮 ---------- */
  const reveal = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); reveal.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  [...secs, ...extras].forEach(s => reveal.observe(s));
  const sideLinks = new Map([...document.querySelectorAll('#sideNav a')].map(a => [a.dataset.cat, a]));
  const spy = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    sideLinks.forEach((a, k) => a.classList.toggle('on', k === e.target.id));
    const a = sideLinks.get(e.target.id), box = $('.side');
    if (a && box && box.scrollWidth > box.clientWidth) box.scrollTo({ left: a.offsetLeft - box.clientWidth / 2 + a.offsetWidth / 2, behavior: 'smooth' });
  }), { rootMargin: '-35% 0px -60% 0px' });
  [...secs, ...extras].forEach(s => spy.observe(s));

  /* ---------- 分享链接 figures.html#python-3：定位卡片并打开大图 ---------- */
  function openHash() {
    let id; try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const it = id && items.find(x => x.id === id);
    if (!it) return;
    it.closest('.cat').classList.add('in');
    it.scrollIntoView({ block: 'center' });
    view(id);
  }
  addEventListener('hashchange', openHash);
  openHash();

  /* ---------- 推荐模板 ---------- */
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (form['bot-field'].value) return void dlg.close();
    let ok = false;
    try { ok = /^https?:$/.test(new URL(form.url.value.trim()).protocol); } catch { /* 非法链接 */ }
    if (!ok) return void (msg.textContent = '链接需以 http:// 或 https:// 开头');
    msg.textContent = '提交中…';
    try { await Astra.feedback(new URLSearchParams(new FormData(form)), form); }
    catch (error) { msg.textContent = error.message; return; }
    dlg.close();
    toast('感谢推荐，审核后会收录');
  });
})();

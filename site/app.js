/* Astra 页面逻辑：渲染目录、搜索、收藏与自定义站点、导航高亮与卡片交互 */
(() => {
  const SECTIONS = [
    { id: 'ai', no: '01', t: '智能', en: 'Intelligence', d: '对话模型、科研智能体、生成式创作与模型 API' },
    { id: 'lit', no: '02', t: '文献', en: 'Literature', d: '从检索、索引到出版商与全文获取的完整链路' },
    { id: 'lab', no: '03', t: '研究', en: 'Laboratory', d: '写作翻译、文档解析、科学数据、绘图与申报' },
    { id: 'kit', no: '04', t: '工具', en: 'Toolkit', d: '学者社区、公开课、开发云服务与日常效率' },
  ];
  const ENGINES = [
    { id: 'site', t: '站内' },
    { id: 'google', t: 'Google', u: 'https://www.google.com/search?q=' },
    { id: 'scholar', t: '谷歌学术', u: 'https://scholar.google.com/scholar?q=' },
    { id: 'baidu', t: '百度', u: 'https://www.baidu.com/s?wd=' },
    { id: 'bing', t: '必应', u: 'https://www.bing.com/search?q=' },
    { id: 'cnki', t: '知网', u: 'https://kns.cnki.net/kns8s/defaultresult/index?kw=' },
    { id: 'pubmed', t: 'PubMed', u: 'https://pubmed.ncbi.nlm.nih.gov/?term=' },
  ];
  const TAGS = { vpn: { t: '代理', k: '代理 vpn' }, campus: { t: '机构', k: '机构 校园网 campus' } };
  const ACCESS = [['all', '全部'], ['direct', '免代理'], ['vpn', '需代理'], ['campus', '需机构权限']];

  const { $, esc, store, toast } = Astra;
  const bySec = id => NAV.filter(c => c.sec === id);
  const total = NAV.reduce((n, c) => n + c.s.length, 0);

  // 只接受 http(s)，防止 javascript: 等协议经导入或表单混入
  const safeUrl = u => { try { const x = new URL(String(u).trim()); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };
  const SITES = new Map();
  for (const c of NAV) for (const s of c.s) if (!SITES.has(s[1])) SITES.set(s[1], { s, hue: c.hue });

  let custom = store.get('custom', []).filter(x => x && safeUrl(x.url) === x.url && typeof x.name === 'string');
  const customSite = x => [x.name, x.url, x.desc || ''];
  const lookup = u => SITES.get(u) || (x => x && { s: customSite(x), hue: 30 })(custom.find(x => x.url === u));
  let favs = store.get('favs', []).filter(u => SITES.has(u));
  let recent = store.get('recent', []).filter(lookup);
  let recentDirty = false;
  // 子页面收藏的 SKILL 仓库名、Prompt id 与绘图模板 id，按前缀 s / p / f 区分；数据按需加载，未加载前保留原样
  const strs = a => (Array.isArray(a) ? a : []).filter(x => typeof x === 'string' && x.length < 200);
  const XKEY = { s: 'favSkills', p: 'favPrompts', f: 'favFigures' };
  const xf = Object.fromEntries(Object.entries(XKEY).map(([p, key]) => [p, strs(store.get(key, []))]));
  const xn = () => xf.s.length + xf.p.length + xf.f.length;
  function visit(u) {
    if (!lookup(u)) return;
    recent = [u, ...recent.filter(x => x !== u)].slice(0, 12);
    store.set('recent', recent);
    recentDirty = true;
  }
  /* ---------- 渲染 ---------- */
  function icon(name, url, hue) {
    const host = new URL(url).hostname;
    const letter = esc([...name.replace(/^[^\p{L}\p{N}]+/u, '')][0] || '·').toUpperCase();
    const fallback = `<span class="ava" style="--h:${hue}">${letter}</span>`;
    return ICONS.has(host)
      ? `<span class="fav"><img src="icons/${host}.png" alt="" loading="lazy" decoding="async" width="20" height="20"></span>`
      : fallback;
  }
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>';
  const DEL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  // mode：普通卡片带收藏星标；'custom' 带删除按钮
  function card([name, url, desc, tag], hue, i, mode) {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const tg = TAGS[tag];
    const hay = `${name} ${Object.hasOwn(PINYIN, name) ? PINYIN[name] : ''} ${desc} ${host} ${tg ? tg.k : ''}`.toLowerCase();
    const act = mode === 'custom'
      ? `<button type="button" class="pin del" data-del="${esc(url)}" aria-label="删除 ${esc(name)}">${DEL}</button>`
      : `<button type="button" class="pin" data-fav="${esc(url)}" aria-pressed="${favs.includes(url)}" aria-label="收藏 ${esc(name)}">${STAR}</button>`;
    return `<div class="cell" style="--h:${hue};--i:${Math.min(i, 14)}" data-q="${esc(hay)}" data-tag="${tag || ''}">
      <a class="card" href="${esc(url)}" data-u="${esc(url)}" target="_blank" rel="noopener noreferrer">
        ${icon(name, url, hue)}
        <span class="meta"><span class="name"><span>${esc(name)}</span>${tg ? `<i class="tag ${tag}">${tg.t}</i>` : ''}</span><span class="desc">${esc(desc || host)}</span></span>
        <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>
      </a>${act}
    </div>`;
  }
  // 科研 SKILL / Prompt / 绘图条目卡片：链到子页面对应卡片，星标收藏到 favSkills / favPrompts / favFigures
  const isXFav = k => xf[k[0]].includes(k.slice(2));
  function xcard(x, hue, i) {
    return `<div class="cell" style="--h:${hue};--i:${Math.min(i, 14)}" data-q="${esc(x.hay.toLowerCase())}">
      <a class="card" href="${esc(x.href)}">
        <span class="ava" style="--h:${hue}" aria-hidden="true">${esc([...x.name][0].toUpperCase())}</span>
        <span class="meta"><span class="name"><span>${esc(x.name)}</span></span><span class="desc">${esc(x.desc)}</span></span>
        <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </a><button type="button" class="pin" data-xfav="${esc(x.k)}" aria-pressed="${isXFav(x.k)}" aria-label="收藏 ${esc(x.name)}">${STAR}</button>
    </div>`;
  }
  // items：[[站点数组, 色相], ...]；extra 追加在网格末尾（如"添加站点"）
  // mode 'x' 表示 SKILL/Prompt 条目；only 表示只在关键词搜索时显示
  function category(c, items, { dup, only, mode, extra = '' } = {}) {
    return `<section class="cat" id="${c.id}" style="--h:${c.hue}" aria-labelledby="${c.id}-t"${dup ? ' data-dup' : ''}${only ? ' data-only' : ''}>
      <header class="cat-head">
        <span class="orb" aria-hidden="true"></span>
        <h3 id="${c.id}-t">${esc(c.t)}</h3>
        <span class="en">${esc(c.en)}</span>
        <span class="count">${items.length}</span>
      </header>
      <div class="grid">${items.map(([s, h], i) => mode === 'x' ? xcard(s, h, i) : card(s, h, i, mode)).join('')}${extra}</div>
    </section>`;
  }
  $('#content').innerHTML = '<section class="sec mine" id="sec-mine" aria-labelledby="sec-mine-t"></section>' + SECTIONS.map(s => `
    <section class="sec" id="sec-${s.id}" aria-labelledby="sec-${s.id}-t">
      <header class="sec-head">
        <span class="sec-no">${s.no}</span>
        <div>
          <h2 id="sec-${s.id}-t">${s.t}<span>${s.en}</span></h2>
          <p>${s.d}</p>
        </div>
      </header>
      ${bySec(s.id).map(c => category(c, c.s.map(x => [x, c.hue]))).join('')}
    </section>`).join('') + '<section class="sec more" id="sec-more" aria-labelledby="sec-more-t"></section>';
  /* ---------- 全站搜索：按需加载 SKILL / Prompt 数据 ---------- */
  const X_HUE = { s: 265, p: 200, f: 150 };
  const EXTRA = new Map();   // 's:作者/仓库'、'p:review-3' 或 'f:python-2' → 卡片数据
  let extraP = null;
  function loadExtra() {
    extraP ??= Promise.all(['skills', 'prompts', 'figures'].map(n => new Promise((ok, no) =>
      document.head.appendChild(Object.assign(document.createElement('script'), { src: `data/${n}.js`, onload: ok, onerror: no })))))
      .then(() => {
        for (const c of SKILLS.categories) for (const r of c.repos) EXTRA.set('s:' + r.repo, {
          k: 's:' + r.repo, name: r.name, desc: r.desc, href: 'skills.html#' + encodeURIComponent(r.repo),
          hay: [r.name, r.repo, r.desc, c.t, 'skill', ...(r.skills || []).map(s => s.name)].join(' '),
        });
        for (const c of PROMPTS.categories) for (const p of c.prompts) EXTRA.set('p:' + p.id, {
          k: 'p:' + p.id, name: p.t, desc: `${c.t} · ${p.lang === 'en' ? 'English' : '中文'}`, href: 'prompts.html#' + encodeURIComponent(p.id),
          hay: `${p.t} ${c.t} prompt 提示词`,
        });
        for (const c of FIGURES.categories) for (const x of c.items) EXTRA.set('f:' + x.id, {
          k: 'f:' + x.id, name: x.t, desc: `${c.t} · ${x.tool}`, href: 'figures.html#' + encodeURIComponent(x.id),
          hay: `${x.t} ${x.en || ''} ${x.tool} ${x.desc} ${c.t} 绘图 作图 figure plot`,
        });
        $('#sec-more').innerHTML = `
          <header class="sec-head">
            <span class="sec-no">05</span>
            <div><h2 id="sec-more-t">延伸<span>Skills · Prompts · Figures</span></h2><p>来自科研 SKILL、科研 Prompt 与科研绘图页面的匹配结果</p></div>
          </header>
          ${category({ id: 'more-skills', t: '科研 SKILL', en: 'Skills', hue: X_HUE.s }, [...EXTRA.values()].filter(x => x.k[0] === 's').map(x => [x, X_HUE.s]), { only: true, mode: 'x' })}
          ${category({ id: 'more-prompts', t: '科研 Prompt', en: 'Prompts', hue: X_HUE.p }, [...EXTRA.values()].filter(x => x.k[0] === 'p').map(x => [x, X_HUE.p]), { only: true, mode: 'x' })}
          ${category({ id: 'more-figures', t: '科研绘图', en: 'Figures', hue: X_HUE.f }, [...EXTRA.values()].filter(x => x.k[0] === 'f').map(x => [x, X_HUE.f]), { only: true, mode: 'x' })}`;
        // 这组只在搜索时出现，不走进场动画
        $('#sec-more').querySelectorAll('.cat, .sec-head').forEach(el => el.classList.add('in'));
        renderMine();
      })
      .catch(() => { extraP = null; });   // 离线等加载失败时，下次搜索再试
    return extraP;
  }

  /* ---------- 我的星座：收藏、最近访问、自定义 ---------- */
  const mineBox = $('#sec-mine');
  let mineShown = false;
  function renderMine() {
    const pick = list => list.map(u => lookup(u)).filter(Boolean).map(x => [x.s, x.hue]);
    const fav = pick(favs), rec = pick(recent.slice(0, 8));
    const xfav = Object.keys(XKEY).flatMap(p => xf[p].map(k => p + ':' + k)).map(k => EXTRA.get(k)).filter(Boolean).map(x => [x, X_HUE[x.k[0]]]);
    const add = `<button type="button" class="cell add" data-act="add"><span class="ava" aria-hidden="true">+</span><span class="meta"><span class="name">添加站点</span><span class="desc">仅保存在本浏览器</span></span></button>`;
    mineBox.innerHTML = `
      <header class="sec-head">
        <span class="sec-no">00</span>
        <div>
          <h2 id="sec-mine-t" tabindex="-1">我的<span>Constellation</span></h2>
          <p>收藏、最近访问与自定义站点，只保存在本浏览器${fav.length || xfav.length || rec.length || custom.length ? '' : ' · 点卡片右上角的星标即可收藏'}</p>
        </div>
        <div class="sec-tools">
          <button type="button" class="btn" data-act="export">导出</button>
          <button type="button" class="btn" data-act="import">导入</button>
        </div>
      </header>
      ${fav.length ? category({ id: 'mine-fav', t: '收藏', en: 'Pinned', hue: 42 }, fav, { dup: true }) : ''}
      ${xfav.length ? category({ id: 'mine-x', t: 'SKILL · Prompt · 绘图', en: 'Skills, Prompts & Figures', hue: 265 }, xfav, { dup: true, mode: 'x' }) : ''}
      ${rec.length ? category({ id: 'mine-recent', t: '最近访问', en: 'Recent', hue: 210 }, rec, { dup: true }) : ''}
      ${category({ id: 'mine-custom', t: '自定义', en: 'Custom', hue: 30 }, custom.map(x => [customSite(x), 30]), { mode: 'custom', extra: add })}`;
    // 首次渲染交给进场动画；之后的重绘直接显示，避免每次收藏都重播动画
    mineBox.querySelectorAll('.cat, .sec-head').forEach(el => mineShown ? el.classList.add('in') : reveal.observe(el));
    mineShown = true;
    recentDirty = false;
    const side = $('#sideMine b');
    if (side) side.textContent = fav.length + xfav.length + custom.length;
    collect();
    apply();
  }
  $('#secNav').innerHTML = SECTIONS.map(s => `<a href="#sec-${s.id}" data-sec="${s.id}">${s.t}</a>`).join('');
  $('#sideNav').innerHTML = `<div class="side-group"><a href="#sec-mine" id="sideMine" style="--h:42"><i></i>我的星座<b>0</b></a></div>` + SECTIONS.map(s => `
    <div class="side-group">
      <p class="side-title"><span>${s.no}</span>${s.t}</p>
      ${bySec(s.id).map(c => `<a href="#${c.id}" data-cat="${c.id}" style="--h:${c.hue}"><i></i>${esc(c.t)}<b>${c.s.length}</b></a>`).join('')}
    </div>`).join('');

  $('#stats').innerHTML = [[total, '收录站点'], [NAV.length, '精选分类'], [SECTIONS.length, '知识星域']]
    .map(([n, l]) => `<div><dt>${l}</dt><dd data-n="${n}">0</dd></div>`).join('');

  /* ---------- 数字滚动 ---------- */
  document.querySelectorAll('#stats dd').forEach(el => {
    const n = +el.dataset.n, t0 = performance.now(), dur = 1600;
    const step = t => {
      const p = Math.min((t - t0) / dur, 1);
      el.textContent = Math.round(n * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(step);
    };
    setTimeout(() => requestAnimationFrame(step), 500);
  });

  /* ---------- 过滤：关键词 + 访问条件 ---------- */
  let cells = [], cats = [], secs = [];
  let terms = [], access = 'all', active = -1;
  function collect() {
    cells = [...document.querySelectorAll('.cell[data-q]')];
    cats = [...document.querySelectorAll('.cat')];
    secs = [...document.querySelectorAll('.sec')];
  }
  const passAccess = t => access === 'all' || (access === 'direct' ? t !== 'vpn' : t === access);
  function apply() {
    const filtering = terms.length > 0 || access !== 'all';
    document.body.classList.toggle('searching', filtering);
    for (const c of cells) c.hidden = !(passAccess(c.dataset.tag) && terms.every(t => c.dataset.q.includes(t)));
    for (const c of cats) {
      const n = c.querySelectorAll('.cell[data-q]:not([hidden])').length;
      // 收藏/最近是其他分类的副本，过滤时隐藏以免结果重复；自定义分类过滤时无结果也隐藏
      // SKILL / Prompt 延伸结果只在输入关键词时出现
      c.hidden = c.hasAttribute('data-only') ? !terms.length || !n : filtering && (c.hasAttribute('data-dup') || !n);
      c.querySelector('.count').textContent = n;
    }
    for (const s of secs) s.hidden = !s.querySelector('.cat:not([hidden])');
    const shown = visibleCells();
    $('#empty').hidden = !filtering || shown.length > 0;
    setActive(-1);
    if (filtering) announce(shown.length ? `找到 ${shown.length} 个资源` : '没有匹配的资源');
  }
  let liveT;
  const announce = msg => { clearTimeout(liveT); liveT = setTimeout(() => { $('#live').textContent = msg; }, 500); };
  const visibleCells = () => cells.filter(c => !c.hidden && c.offsetParent);
  function setActive(i, scroll) {
    cells.forEach(c => c.classList.remove('kb'));
    const list = visibleCells();
    if (i < 0 || !list.length) { active = -1; return; }
    active = i % list.length;
    const c = list[active];
    c.classList.add('kb');
    if (scroll) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    $('#live').textContent = `${c.querySelector('.name > span').textContent}，第 ${active + 1} 项，共 ${list.length} 项`;
  }
  /* ---------- 卡片操作：收藏、删除、记录访问 ---------- */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-fav], [data-xfav], [data-del], [data-act], .card');
    if (!t) return;
    if (t.dataset.fav) toggleFav(t.dataset.fav);
    else if (t.dataset.xfav) toggleXFav(t.dataset.xfav);
    else if (t.dataset.del) removeCustom(t.dataset.del);
    else if (t.dataset.act) ({ add: () => openDlg(false), suggest: () => openDlg(true), close: () => dlg.close(), export: exportData, import: () => $('#importFile').click() })[t.dataset.act]?.();
    else if (t.dataset.u) visit(t.dataset.u);
  });
  // 中键点击同样算访问
  document.addEventListener('auxclick', e => { const c = e.button === 1 && e.target.closest('.card[data-u]'); if (c) visit(c.dataset.u); });
  // 回到页面时再刷新最近访问，避免点击后卡片在眼前跳动
  document.addEventListener('visibilitychange', () => { if (!document.hidden && recentDirty) renderMine(); });

  function toggleFav(u) {
    const on = !favs.includes(u);
    favs = on ? [u, ...favs] : favs.filter(x => x !== u);
    store.set('favs', favs);
    const inMine = document.activeElement?.closest('#sec-mine');
    renderMine();
    document.querySelectorAll('[data-fav]').forEach(b => b.setAttribute('aria-pressed', favs.includes(b.dataset.fav)));
    // 在「我的」区域内操作时重绘会丢失焦点，移到同一站点的按钮上（若已移除则落到区块标题）
    if (inMine) ([...mineBox.querySelectorAll('[data-fav]')].find(b => b.dataset.fav === u) || $('#sec-mine-t')).focus?.();
    toast(on ? `已收藏 ${SITES.get(u).s[0]}` : '已取消收藏');
  }
  // k 形如 's:作者/仓库'、'p:review-3' 或 'f:python-2'
  function toggleXFav(k) {
    const p = k[0], id = k.slice(2), on = !xf[p].includes(id);
    xf[p] = on ? [id, ...xf[p]] : xf[p].filter(x => x !== id);
    store.set(XKEY[p], xf[p]);
    const inMine = document.activeElement?.closest('#sec-mine');
    renderMine();
    syncXFav();
    if (inMine) ([...mineBox.querySelectorAll('[data-xfav]')].find(b => b.dataset.xfav === k) || $('#sec-mine-t')).focus?.();
    toast(on ? `已收藏 ${EXTRA.get(k)?.name || ''}` : '已取消收藏');
  }
  const syncXFav = () => document.querySelectorAll('[data-xfav]').forEach(b => b.setAttribute('aria-pressed', isXFav(b.dataset.xfav)));
  // 在子页面收藏后切回首页时同步
  addEventListener('storage', e => {
    const p = Object.keys(XKEY).find(p => e.key === 'astra:' + XKEY[p]);
    if (!p) return;
    xf[p] = strs(store.get(XKEY[p], []));
    if (EXTRA.size) { renderMine(); syncXFav(); } else if (xn()) loadExtra();
  });
  function removeCustom(u) {
    const x = custom.find(c => c.url === u);
    custom = custom.filter(c => c.url !== u);
    recent = recent.filter(r => r !== u);
    store.set('custom', custom); store.set('recent', recent);
    renderMine();
    toast(`已删除 ${x?.name || ''}`);
  }

  /* ---------- 添加 / 推荐站点 ---------- */
  const dlg = $('#dlg'), form = $('#dlgForm'), msg = $('#dlgMsg');
  function openDlg(suggest) {
    form.reset();
    msg.textContent = '';
    $('#optSave').checked = !suggest;
    $('#optSuggest').checked = suggest;
    $('#dlg-t').textContent = suggest ? '推荐站点' : '添加站点';
    dlg.showModal();
  }
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const url = safeUrl(form.url.value);
    const save = $('#optSave').checked, suggest = $('#optSuggest').checked;
    if (!url) return void (msg.textContent = '请输入以 http:// 或 https:// 开头的有效链接');
    if (!save && !suggest) return void (msg.textContent = '请至少勾选一项');
    if (form['bot-field'].value) return void dlg.close();
    const name = form.name.value.trim().slice(0, 40) || new URL(url).hostname.replace(/^www\./, '');
    const desc = form.desc.value.trim().slice(0, 80);
    if (save && !custom.some(c => c.url === url)) {
      custom = [...custom, { name, url, desc }];
      store.set('custom', custom);
      renderMine();
    }
    let sent = !suggest;
    if (suggest) {
      msg.textContent = '提交中…';
      try {
        const body = new URLSearchParams({ 'form-name': 'suggest', 'bot-field': '', name, url, desc });
        sent = (await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })).ok;
      } catch { sent = false; }
    }
    if (!sent) return void (msg.textContent = save ? '已保存到本地，但推荐提交失败，请稍后重试' : '提交失败，请稍后重试');
    dlg.close();
    toast(suggest ? '感谢推荐，审核后会收录' : `已添加 ${name}`);
  });
  /* ---------- 导入导出 ---------- */
  function exportData() {
    const blob = new Blob([JSON.stringify({ app: 'astra', v: 3, favs, custom, favSkills: xf.s, favPrompts: xf.p, favFigures: xf.f }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `astra-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(`已导出 ${favs.length + xn()} 个收藏、${custom.length} 个自定义站点`);
  }
  $('#importFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (d?.app !== 'astra') throw 0;
      const n0 = favs.length + xn(), c0 = custom.length;
      favs = [...new Set([...favs, ...(Array.isArray(d.favs) ? d.favs : []).filter(u => SITES.has(u))])];
      for (const x of Array.isArray(d.custom) ? d.custom : []) {
        const url = x && safeUrl(x.url);
        if (!url || typeof x.name !== 'string' || custom.some(c => c.url === url)) continue;
        custom.push({ name: x.name.trim().slice(0, 40) || new URL(url).hostname, url, desc: typeof x.desc === 'string' ? x.desc.slice(0, 80) : '' });
      }
      // 旧版备份没有这几项；条目是否仍存在留到渲染时判断
      for (const [p, key] of Object.entries(XKEY)) { xf[p] = [...new Set([...xf[p], ...strs(d[key])])]; store.set(key, xf[p]); }
      store.set('favs', favs); store.set('custom', custom);
      renderMine();
      document.querySelectorAll('[data-fav]').forEach(b => b.setAttribute('aria-pressed', favs.includes(b.dataset.fav)));
      syncXFav();
      if (xn()) loadExtra();
      toast(`已导入 ${favs.length + xn() - n0} 个收藏、${custom.length - c0} 个自定义站点`);
    } catch { toast('导入失败：不是有效的 Astra 备份文件'); }
  });

  /* ---------- 搜索 ---------- */
  const q = $('#q'), engBox = $('#engines');
  let engine = ENGINES.find(x => x.id === store.get('engine')) || ENGINES[0];
  engBox.innerHTML = ENGINES.map(e =>
    `<button type="button" role="tab" data-e="${e.id}" aria-selected="${e === engine}">${e.t}</button>`).join('') + '<span class="thumb" aria-hidden="true"></span>';
  const thumb = engBox.querySelector('.thumb');
  function moveThumb() {
    const b = engBox.querySelector('[aria-selected="true"]');
    thumb.style.width = b.offsetWidth + 'px';
    thumb.style.transform = `translateX(${b.offsetLeft}px)`;
  }
  function setEngine(e) {
    engine = e;
    engBox.querySelectorAll('button').forEach(x => x.setAttribute('aria-selected', x.dataset.e === e.id));
    q.placeholder = e.u ? `在 ${e.t} 中搜索…` : '搜索站内资源，支持拼音与首字母…';
    moveThumb();
  }
  engBox.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    setEngine(ENGINES.find(x => x.id === b.dataset.e));
    store.set('engine', engine.id);
    onInput(); q.focus();
  });
  addEventListener('resize', moveThumb);
  requestAnimationFrame(() => setEngine(engine));

  const open = u => window.open(u, '_blank', 'noopener');
  let jumped = false;
  function onInput() {
    const v = q.value;
    terms = engine.u ? [] : v.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length) loadExtra();
    apply();
    // 同步到地址栏，便于分享或设为浏览器自定义搜索引擎
    const url = new URL(location.href);
    if (terms.length) url.searchParams.set('q', v.trim()); else url.searchParams.delete('q');
    history.replaceState(null, '', url);
  }
  q.addEventListener('input', () => {
    onInput();
    // 首次输入时把结果带到视野内
    if (!jumped && terms.length) { jumped = true; $('#search').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    if (!q.value) jumped = false;
  });
  $('#search').addEventListener('submit', e => {
    e.preventDefault();
    const v = q.value.trim();
    const r = q.getBoundingClientRect();
    window.astraPulse(r.right - 30, r.top + r.height / 2, 1.4);
    if (!v && access === 'all') return;
    if (engine.u) return void open(engine.u + encodeURIComponent(v));
    const list = visibleCells(), c = list[Math.max(active, 0)];
    if (c) {
      const a = c.querySelector('.card');
      // SKILL / Prompt 结果是站内页面，当前标签页打开
      if (a.dataset.u) { visit(a.dataset.u); open(a.href); } else location.href = a.href;
    }
    else if (v) open(ENGINES[1].u + encodeURIComponent(v));
  });
  addEventListener('keydown', e => {
    const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if (dlg.open) return;
    if ((e.key === '/' && !typing) || (e.key === 'k' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); q.focus(); q.select(); }
    else if (document.activeElement === q && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && document.body.classList.contains('searching')) {
      e.preventDefault();
      const n = visibleCells().length;
      if (n) setActive(e.key === 'ArrowDown' ? active + 1 : (active <= 0 ? n - 1 : active - 1), true);
    }
    else if (e.key === 'Escape' && document.activeElement === q) { q.value = ''; onInput(); q.blur(); }
  });
  $('#kbdHint').addEventListener('click', () => { q.focus(); $('#search').scrollIntoView({ behavior: 'smooth', block: 'center' }); });

  /* 访问条件筛选 */
  $('#access').innerHTML = ACCESS.map(([k, t]) => `<button type="button" data-k="${k}" aria-pressed="${k === 'all'}">${t}</button>`).join('');
  $('#access').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    access = b.dataset.k;
    $('#access').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    apply();
    if (access !== 'all') $('#search').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  /* ---------- 卡片聚光与波纹 ---------- */
  const fine = matchMedia('(pointer: fine)').matches;
  // 每帧最多更新一次，避免高频 pointermove 反复触发布局计算
  let spot = null;
  document.addEventListener('pointermove', e => {
    if (!fine) return;
    if (!spot) requestAnimationFrame(() => {
      const c = spot.target.closest?.('.card');
      if (c) {
        const r = c.getBoundingClientRect();
        c.style.setProperty('--mx', `${spot.clientX - r.left}px`);
        c.style.setProperty('--my', `${spot.clientY - r.top}px`);
      }
      spot = null;
    });
    spot = e;
  }, { passive: true });
  document.addEventListener('pointerover', e => {
    const c = e.target.closest?.('.card');
    if (c && !c.contains(e.relatedTarget)) {
      const r = c.getBoundingClientRect();
      window.astraPulse(r.left + 26, r.top + r.height / 2, .35);
    }
  });

  /* ---------- 进场动画与导航高亮 ---------- */
  const reveal = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); reveal.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.cat, .sec-head').forEach(c => reveal.observe(c));
  renderMine();
  if (xn()) loadExtra();

  const sideLinks = new Map([...document.querySelectorAll('#sideNav a[data-cat]')].map(a => [a.dataset.cat, a]));
  const topLinks = new Map([...document.querySelectorAll('#secNav a')].map(a => [a.dataset.sec, a]));
  const spy = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const id = e.target.id;
    sideLinks.forEach((a, k) => a.classList.toggle('on', k === id));
    const sec = NAV.find(c => c.id === id)?.sec;
    topLinks.forEach((a, k) => a.classList.toggle('on', k === sec));
    // 只滚动侧栏自身，避免 scrollIntoView 牵动整页
    const a = sideLinks.get(id), box = $('.side');
    if (a && box) {
      if (box.scrollWidth > box.clientWidth) box.scrollTo({ left: a.offsetLeft - box.clientWidth / 2 + a.offsetWidth / 2, behavior: 'smooth' });
      else if (a.offsetTop < box.scrollTop || a.offsetTop > box.scrollTop + box.clientHeight - 40) box.scrollTo({ top: a.offsetTop - 80, behavior: 'smooth' });
    }
  }), { rootMargin: '-35% 0px -60% 0px' });
  document.querySelectorAll('.sec:not(.mine) .cat').forEach(c => spy.observe(c));

  /* ---------- 从地址栏 ?q= 进入：直接站内搜索 ---------- */
  const q0 = new URLSearchParams(location.search).get('q');
  if (q0) {
    q.value = q0;
    setEngine(ENGINES[0]);
    requestAnimationFrame(() => $('#search').scrollIntoView({ block: 'start' }));
  }
  onInput();
})();

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
    { id: 'xmol', t: 'X-MOL', u: 'https://www.x-mol.com/q?option=' },
    { id: 'scihub', t: 'Sci-Hub', u: 'https://sci-hub.st/', placeholder: '输入 DOI 或论文链接，在 Sci-Hub 打开…' },
    { id: 'semantic', t: 'Semantic Scholar', u: 'https://www.semanticscholar.org/search?q=' },
  ];
  const TAGS = { vpn: { t: '代理', k: '代理 vpn' }, campus: { t: '机构', k: '机构 校园网 campus' } };
  // 三项互斥：公开直达 = 既不需代理也不需机构权限
  const ACCESS = [['all', '全部'], ['direct', '公开直达'], ['vpn', '需代理'], ['campus', '需机构权限']];

  const { $, esc, store, toast, share, report, badges, fresh, hay: HAY, terms: parse, match } = Astra;
  const bySec = id => NAV.filter(c => c.sec === id);
  const total = NAV.reduce((n, c) => n + c.s.length, 0);

  // 只接受 http(s)，防止 javascript: 等协议经导入或表单混入
  const safeUrl = u => { try { const x = new URL(String(u).trim()); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };
  const SITES = new Map();
  for (const c of NAV) for (const s of c.s) if (!SITES.has(s[1])) SITES.set(s[1], { s, hue: c.hue });

  let custom = store.get('custom', []).filter(x => x && safeUrl(x.url) === x.url && typeof x.name === 'string');
  const customSite = x => [x.name, x.url, x.desc || ''];
  const lookup = u => SITES.get(u) || (x => x && { s: customSite(x), hue: 30 })(custom.find(x => x.url === u));
  let favs = store.get('favs', []).filter(lookup);
  let recent = store.get('recent', []).filter(lookup);
  let recentDirty = false;
  // 子页面收藏的 SKILL 仓库名、Prompt id 与绘图模板 id，按前缀 s / p / f 区分；数据按需加载，未加载前保留原样
  const strs = a => (Array.isArray(a) ? a : []).filter(x => typeof x === 'string' && x.length < 200);
  const XKEY = { s: 'favSkills', p: 'favPrompts', f: 'favFigures' };
  const xf = Object.fromEntries(Object.entries(XKEY).map(([p, key]) => [p, strs(store.get(key, []))]));
  const xn = () => xf.s.length + xf.p.length + xf.f.length;
  // 收藏分组与私人备注，只存本机；条目用收藏键名：站点链接，或 s: / p: / f: 前缀的子页面条目
  const isX = k => /^[spf]:/.test(k);
  const cleanGroups = a => (Array.isArray(a) ? a : []).filter(g => g && typeof g.name === 'string' && g.name.trim())
    .map(g => ({ id: String(g.id || Math.random().toString(36).slice(2, 8)), name: g.name.trim().slice(0, 20), keys: [...new Set(strs(g.keys))] }));
  const cleanNotes = o => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {})
    .filter(([k, v]) => k.length < 200 && typeof v === 'string' && v.trim()).map(([k, v]) => [k, v.trim().slice(0, 200)]));
  let groups = cleanGroups(store.get('groups', []));
  let notes = cleanNotes(store.get('notes', {}));
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
  const MORE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/></svg>';
  const menuBtn = (k, name) => `<button type="button" class="pin more" data-menu="${esc(k)}" aria-label="更多操作：${esc(name)}" title="分享、报告、分组与备注">${MORE}</button>`;
  // 有私人备注时用备注代替简介
  const descHtml = (k, desc) => notes[k] ? `<span class="desc note">✎ ${esc(notes[k])}</span>` : `<span class="desc">${esc(desc)}</span>`;
  // mode：普通卡片带收藏星标与"更多"菜单；'custom' 带删除按钮
  function card([name, url, desc, tag], hue, i, mode) {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const tg = TAGS[tag];
    const hay = `${name} ${Object.hasOwn(PINYIN, name) ? PINYIN[name] : ''} ${desc} ${host} ${tg ? tg.k : ''}`.toLowerCase();
    const act = mode === 'custom'
      ? `<button type="button" class="pin del" data-del="${esc(url)}" aria-label="删除 ${esc(name)}">${DEL}</button>`
      : `${menuBtn(url, name)}<button type="button" class="pin" data-fav="${esc(url)}" aria-pressed="${favs.includes(url)}" aria-label="收藏 ${esc(name)}">${STAR}</button>`;
    return `<div class="cell" style="--h:${hue};--i:${Math.min(i, 14)}" data-q="${esc(hay)}" data-tag="${tag || ''}">
      <a class="card" href="${esc(url)}" data-u="${esc(url)}" target="_blank" rel="noopener noreferrer">
        ${icon(name, url, hue)}
        <span class="meta"><span class="name"><span>${esc(name)}</span>${tg ? `<i class="tag ${tag}">${tg.t}</i>` : ''}${badges(url)}</span>${descHtml(url, desc || host)}</span>
        <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>
      </a>${act}
    </div>`;
  }
  // 科研 SKILL / Prompt / 绘图条目卡片：链到子页面对应卡片，星标收藏到 favSkills / favPrompts / favFigures
  const isXFav = k => xf[k[0]].includes(k.slice(2));
  function xcard(x, hue, i) {
    return `<div class="cell" style="--h:${hue};--i:${Math.min(i, 14)}" data-q="${esc(x.hay)}">
      <a class="card" href="${esc(x.href)}">
        <span class="ava" style="--h:${hue}" aria-hidden="true">${esc([...x.name][0].toUpperCase())}</span>
        <span class="meta"><span class="name"><span>${esc(x.name)}</span>${badges(x.k)}</span>${descHtml(x.k, x.desc)}</span>
        <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </a>${menuBtn(x.k, x.name)}<button type="button" class="pin" data-xfav="${esc(x.k)}" aria-pressed="${isXFav(x.k)}" aria-label="收藏 ${esc(x.name)}">${STAR}</button>
    </div>`;
  }
  // items：[[站点数组或条目, 色相, 是否子页面条目], ...]；extra 追加在网格末尾（如"添加站点"），tools 放在分类标题右侧
  // mode 'x' 表示全部为 SKILL/Prompt/绘图条目；only 表示只在关键词搜索时显示
  function category(c, items, { dup, only, mode, extra = '', tools = '' } = {}) {
    return `<section class="cat" id="${esc(c.id)}" style="--h:${c.hue}" aria-labelledby="${esc(c.id)}-t"${dup ? ' data-dup' : ''}${only ? ' data-only' : ''}>
      <header class="cat-head">
        <span class="orb" aria-hidden="true"></span>
        <h3 id="${esc(c.id)}-t">${esc(c.t)}</h3>
        <span class="en">${esc(c.en)}</span>
        <span class="count">${items.length}</span>${tools}
      </header>
      <div class="grid">${items.map(([s, h, x], i) => x || mode === 'x' ? xcard(s, h, i) : card(s, h, i, mode)).join('')}${extra}</div>
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
        const prompts = new Map(PROMPTS.repos.map(r => [r.repo, r])), figSrc = new Map(FIGURES.sources.map(s => [s.id, s]));
        for (const c of SKILLS.categories) for (const r of c.repos) EXTRA.set('s:' + r.repo, {
          k: 's:' + r.repo, name: r.name, desc: r.desc, href: 'skills.html#' + encodeURIComponent(r.repo),
          hay: HAY.skill(r, c),
        });
        for (const c of PROMPTS.categories) for (const p of c.prompts) EXTRA.set('p:' + p.id, {
          k: 'p:' + p.id, name: p.t, desc: `${c.t} · ${p.lang === 'en' ? 'English' : '中文'}`, href: 'prompts.html#' + encodeURIComponent(p.id),
          hay: HAY.prompt(p, c, prompts.get(p.src)),
        });
        for (const c of FIGURES.categories) for (const x of c.items) EXTRA.set('f:' + x.id, {
          k: 'f:' + x.id, name: x.t, desc: `${c.t} · ${x.tool}`, href: 'figures.html#' + encodeURIComponent(x.id),
          hay: HAY.figure(x, c, figSrc.get(x.src)),
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

  /* ---------- 我的星座：分组、收藏、最近新增、最近访问、自定义 ---------- */
  const mineBox = $('#sec-mine');
  let mineShown = false;
  // 收藏键名 → 卡片条目：[站点数组, 色相] 或 [子页面条目, 色相, true]；子页面数据未加载时为空
  const entry = k => isX(k) ? (x => x && [x, X_HUE[k[0]], true])(EXTRA.get(k)) : (x => x && [x.s, x.hue])(lookup(k));
  const entries = keys => keys.map(entry).filter(Boolean);
  function renderMine() {
    const grouped = new Set(groups.flatMap(g => g.keys));
    const fav = entries(favs.filter(u => !grouped.has(u))), rec = entries(recent.slice(0, 8));
    const xfav = entries(Object.keys(XKEY).flatMap(p => xf[p].map(k => p + ':' + k)).filter(k => !grouped.has(k)));
    const added = entries(fresh()).slice(0, 12);
    const add = `<button type="button" class="cell add" data-act="add"><span class="ava" aria-hidden="true">+</span><span class="meta"><span class="name">添加站点</span><span class="desc">仅保存在本浏览器</span></span></button>`;
    mineBox.innerHTML = `
      <header class="sec-head">
        <span class="sec-no">00</span>
        <div>
          <h2 id="sec-mine-t" tabindex="-1">我的<span>Constellation</span></h2>
          <p>收藏、分组、备注与自定义站点，只保存在本浏览器${favs.length || xn() || rec.length || custom.length ? ' · 卡片右上角的「⋯」可分组、备注与分享' : ' · 点卡片右上角的星标即可收藏'}</p>
        </div>
        <div class="sec-tools">
          <button type="button" class="btn" data-act="export">导出</button>
          <button type="button" class="btn" data-act="import">导入</button>
        </div>
      </header>
      ${groups.map(g => category({ id: 'mine-g-' + g.id, t: g.name, en: 'Group', hue: 42 }, entries(g.keys),
        { dup: true, tools: `<button type="button" class="link cat-tool" data-act="delgroup" data-g="${esc(g.id)}">删除分组</button>` })).join('')}
      ${fav.length ? category({ id: 'mine-fav', t: groups.length ? '未分组收藏' : '收藏', en: 'Pinned', hue: 42 }, fav, { dup: true }) : ''}
      ${xfav.length ? category({ id: 'mine-x', t: 'SKILL · Prompt · 绘图', en: 'Skills, Prompts & Figures', hue: 265 }, xfav, { dup: true, mode: 'x' }) : ''}
      ${added.length ? category({ id: 'mine-new', t: '最近新增', en: 'Recently Added', hue: 150 }, added, { dup: true }) : ''}
      ${rec.length ? category({ id: 'mine-recent', t: '最近访问', en: 'Recent', hue: 210 }, rec, { dup: true }) : ''}
      ${category({ id: 'mine-custom', t: '自定义', en: 'Custom', hue: 30 }, custom.map(x => [customSite(x), 30]), { mode: 'custom', extra: add })}`;
    // 首次渲染交给进场动画；之后的重绘直接显示，避免每次收藏都重播动画
    mineBox.querySelectorAll('.cat, .sec-head').forEach(el => mineShown ? el.classList.add('in') : reveal.observe(el));
    mineShown = true;
    recentDirty = false;
    const side = $('#sideMine b');
    if (side) side.textContent = favs.length + xn() + custom.length;
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
  let cells = [], cats = [], secs = [], shownCells = [];
  let catCells = new Map(), secCats = new Map(), searchData = new Map();
  let terms = [], access = 'all', active = -1, activeCell = null;
  function collect() {
    cells = [...document.querySelectorAll('.cell[data-q]')];
    cats = [...document.querySelectorAll('.cat')];
    secs = [...document.querySelectorAll('.sec')];
    catCells = new Map(cats.map(c => [c, [...c.querySelectorAll('.cell[data-q]')]]));
    secCats = new Map(secs.map(s => [s, [...s.querySelectorAll('.cat')]]));
    searchData = new Map(cells.map(c => [c, { q: c.dataset.q, tag: c.dataset.tag }]));
  }
  const passAccess = t => access === 'all' || (access === 'direct' ? !t : t === access);
  function apply() {
    const filtering = terms.length > 0 || access !== 'all';
    document.body.classList.toggle('searching', filtering);
    for (const c of cells) {
      const d = searchData.get(c), hidden = !(passAccess(d.tag) && match(d.q, terms));
      if (c.hidden !== hidden) c.hidden = hidden;
    }
    shownCells = [];
    for (const c of cats) {
      const shown = catCells.get(c).filter(x => !x.hidden), n = shown.length;
      // 收藏/最近是其他分类的副本，过滤时隐藏以免结果重复；自定义分类过滤时无结果也隐藏
      // SKILL / Prompt 延伸结果只在输入关键词时出现
      const hidden = c.hasAttribute('data-only') ? !terms.length || !n : filtering && (c.hasAttribute('data-dup') || !n);
      if (c.hidden !== hidden) c.hidden = hidden;
      if (!hidden) shownCells.push(...shown);
      const count = c.querySelector('.count');
      if (count.textContent !== String(n)) count.textContent = n;
    }
    for (const s of secs) {
      const hidden = !secCats.get(s).some(c => !c.hidden);
      if (s.hidden !== hidden) s.hidden = hidden;
    }
    const shown = visibleCells();
    $('#empty').hidden = !filtering || shown.length > 0;
    setActive(-1);
    if (filtering) announce(shown.length ? `找到 ${shown.length} 个资源` : '没有匹配的资源');
  }
  let liveT;
  const announce = msg => { clearTimeout(liveT); liveT = setTimeout(() => { $('#live').textContent = msg; }, 500); };
  const visibleCells = () => shownCells;
  function setActive(i, scroll) {
    activeCell?.classList.remove('kb');
    activeCell = null;
    const list = visibleCells();
    if (i < 0 || !list.length) { active = -1; return; }
    active = i % list.length;
    const c = activeCell = list[active];
    c.classList.add('kb');
    if (scroll) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    $('#live').textContent = `${c.querySelector('.name > span').textContent}，第 ${active + 1} 项，共 ${list.length} 项`;
  }
  /* ---------- 卡片操作：收藏、删除、记录访问 ---------- */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-fav], [data-xfav], [data-del], [data-menu], [data-act], .card');
    if (!t) return;
    if (t.dataset.fav) toggleFav(t.dataset.fav);
    else if (t.dataset.xfav) toggleXFav(t.dataset.xfav);
    else if (t.dataset.del) removeCustom(t.dataset.del);
    else if (t.dataset.menu) openMenu(t.dataset.menu, t);
    else if (t.dataset.act) ({ add: () => openDlg(false), suggest: () => openDlg(true), close: () => dlg.close(), export: exportData, import: () => $('#importFile').click(),
      delgroup: () => delGroup(t.dataset.g) })[t.dataset.act]?.();
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
    if (!on) ungroup(u);
    const inMine = document.activeElement?.closest('#sec-mine');
    renderMine();
    document.querySelectorAll('[data-fav]').forEach(b => b.setAttribute('aria-pressed', favs.includes(b.dataset.fav)));
    // 在「我的」区域内操作时重绘会丢失焦点，移到同一站点的按钮上（若已移除则落到区块标题）
    if (inMine) ([...mineBox.querySelectorAll('[data-fav]')].find(b => b.dataset.fav === u) || $('#sec-mine-t')).focus?.();
    toast(on ? `已收藏 ${lookup(u).s[0]}` : '已取消收藏');
  }
  // k 形如 's:作者/仓库'、'p:review-3' 或 'f:python-2'
  function toggleXFav(k) {
    const p = k[0], id = k.slice(2), on = !xf[p].includes(id);
    xf[p] = on ? [id, ...xf[p]] : xf[p].filter(x => x !== id);
    store.set(XKEY[p], xf[p]);
    if (!on) ungroup(k);
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
    if (!SITES.has(u)) {
      favs = favs.filter(x => x !== u);
      store.set('favs', favs);
      ungroup(u);
    }
    store.set('custom', custom); store.set('recent', recent);
    renderMine();
    toast(`已删除 ${x?.name || ''}`);
  }

  /* ---------- 条目菜单：分享、报告问题、分组与私人备注 ---------- */
  // 分组只放收藏的条目：加入分组即收藏，取消收藏即移出所有分组
  const saveGroups = () => store.set('groups', groups);
  function ungroup(k) {
    if (!groups.some(g => g.keys.includes(k))) return;
    groups = groups.map(g => ({ ...g, keys: g.keys.filter(x => x !== k) }));
    saveGroups();
  }
  function delGroup(id) {
    const g = groups.find(x => x.id === id);
    if (!g || !confirm(`删除分组「${g.name}」？组内条目仍保留在收藏中。`)) return;
    groups = groups.filter(x => x !== g);
    saveGroups();
    renderMine();
    toast(`已删除分组 ${g.name}`);
  }
  // 键名 → 名称、分享链接（站点为原链接，子页面条目为本站锚点链接）
  function info(k) {
    if (isX(k)) { const x = EXTRA.get(k); return x && { name: x.name, url: new URL(x.href, location.href).href, sub: x.desc }; }
    const x = lookup(k);
    return x && { name: x.s[0], url: k, sub: new URL(k).hostname.replace(/^www\./, '') };
  }
  const itemDlg = $('#itemDlg'), itemForm = $('#itemForm');
  let menuKey = null, menuBack = null, draft = [];
  function drawGroups() {
    $('#itGroups').innerHTML = draft.length
      ? draft.map(g => `<label class="check"><input type="checkbox" value="${esc(g.id)}"${g.keys.includes(menuKey) ? ' checked' : ''}>${esc(g.name)}</label>`).join('')
      : '<p class="it-empty">还没有分组，在下方新建一个</p>';
  }
  function openMenu(k, from) {
    const it = info(k);
    if (!it) return;
    menuKey = k; menuBack = from;
    draft = groups.map(g => ({ ...g, keys: [...g.keys] }));   // 点"保存"才生效
    $('#it-t').textContent = it.name;
    $('#itSub').textContent = it.sub;
    $('#itNote').value = notes[k] || '';
    $('#itNewGroup').value = '';
    drawGroups();
    itemDlg.showModal();
  }
  function addGroup() {
    const name = $('#itNewGroup').value.trim().slice(0, 20);
    if (!name) return void $('#itNewGroup').focus();
    let g = draft.find(x => x.name === name);
    if (!g) draft.push(g = { id: Date.now().toString(36), name, keys: [] });
    if (!g.keys.includes(menuKey)) g.keys.push(menuKey);
    $('#itNewGroup').value = '';
    drawGroups();
  }
  $('#itNewGroup').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addGroup(); } });
  itemDlg.addEventListener('click', e => {
    if (e.target === itemDlg) return void itemDlg.close();
    const a = e.target.closest('[data-it]')?.dataset.it;
    const it = a && info(menuKey);
    if (a === 'close') itemDlg.close();
    else if (a === 'addgroup') addGroup();
    else if (a === 'share') share({ title: it.name, url: it.url, btn: e.target.closest('button') });
    else if (a === 'report') { itemDlg.close(); report({ key: menuKey, name: it.name, url: isX(menuKey) ? it.url : menuKey }); }
  });
  // 关闭后焦点回到菜单按钮；「我的」区域重绘过的话，找同一条目的新按钮
  itemDlg.addEventListener('close', () => {
    const b = menuBack?.isConnected ? menuBack : mineBox.querySelector(`[data-menu="${CSS.escape(menuKey)}"]`);
    b?.focus({ preventScroll: true });
  });
  itemForm.addEventListener('submit', e => {
    e.preventDefault();
    const k = menuKey, on = new Set([...itemDlg.querySelectorAll('#itGroups input:checked')].map(x => x.value));
    groups = draft.map(g => ({ ...g, keys: on.has(g.id) ? [...new Set([...g.keys, k])] : g.keys.filter(x => x !== k) }));
    saveGroups();
    const note = $('#itNote').value.trim().slice(0, 200);
    if (note) notes[k] = note; else delete notes[k];
    store.set('notes', notes);
    // 放进分组的条目自动收藏
    if (on.size) {
      if (isX(k)) { if (!isXFav(k)) { xf[k[0]] = [k.slice(2), ...xf[k[0]]]; store.set(XKEY[k[0]], xf[k[0]]); } }
      else if (!favs.includes(k)) { favs = [k, ...favs]; store.set('favs', favs); }
    }
    // 各处同一条目的简介换成备注
    document.querySelectorAll(`[data-menu="${CSS.escape(k)}"]`).forEach(b => {
      const d = b.parentElement.querySelector('.desc');
      if (d) d.outerHTML = descHtml(k, isX(k) ? EXTRA.get(k).desc : lookup(k).s[2] || info(k).sub);
    });
    renderMine();
    document.querySelectorAll('[data-fav]').forEach(b => b.setAttribute('aria-pressed', favs.includes(b.dataset.fav)));
    syncXFav();
    itemDlg.close();
    toast(on.size ? `已保存，放入 ${on.size} 个分组` : '已保存');
  });

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
    if (suggest) {
      msg.textContent = '提交中…';
      try {
        const body = new URLSearchParams({ 'form-name': 'suggest', 'bot-field': '', name, url, desc });
        await Astra.feedback(body, form);
      } catch (error) { msg.textContent = (save ? '已保存到本地，但推荐未提交：' : '') + error.message; return; }
    }
    dlg.close();
    toast(suggest ? '感谢推荐，审核后会收录' : `已添加 ${name}`);
  });
  /* ---------- 导入导出 ---------- */
  function exportData() {
    const blob = new Blob([JSON.stringify({ app: 'astra', v: 4, favs, custom, favSkills: xf.s, favPrompts: xf.p, favFigures: xf.f, groups, notes }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `astra-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(`已导出 ${favs.length + xn()} 个收藏、${groups.length} 个分组、${custom.length} 个自定义站点`);
  }
  $('#importFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (d?.app !== 'astra') throw 0;
      const n0 = favs.length + xn(), c0 = custom.length;
      for (const x of Array.isArray(d.custom) ? d.custom : []) {
        const url = x && safeUrl(x.url);
        if (!url || typeof x.name !== 'string' || custom.some(c => c.url === url)) continue;
        custom.push({ name: x.name.trim().slice(0, 40) || new URL(url).hostname, url, desc: typeof x.desc === 'string' ? x.desc.slice(0, 80) : '' });
      }
      favs = [...new Set([...favs, ...(Array.isArray(d.favs) ? d.favs : []).filter(lookup)])];
      // 旧版备份没有这几项；条目是否仍存在留到渲染时判断
      for (const [p, key] of Object.entries(XKEY)) { xf[p] = [...new Set([...xf[p], ...strs(d[key])])]; store.set(key, xf[p]); }
      // 分组按名称合并；备注只补本机没有的
      for (const g of cleanGroups(d.groups)) {
        const mine = groups.find(x => x.name === g.name);
        if (mine) mine.keys = [...new Set([...mine.keys, ...g.keys])]; else groups.push(g);
      }
      notes = { ...cleanNotes(d.notes), ...notes };
      saveGroups(); store.set('notes', notes);
      store.set('favs', favs); store.set('custom', custom);
      renderMine();
      document.querySelectorAll('[data-fav]').forEach(b => b.setAttribute('aria-pressed', favs.includes(b.dataset.fav)));
      syncXFav();
      if (xn()) loadExtra();
      toast(`已导入 ${favs.length + xn() - n0} 个收藏、${custom.length - c0} 个自定义站点`);
    } catch { toast('导入失败：不是有效的 Astra 备份文件'); }
  });

  /* ---------- 搜索 ---------- */
  const q = $('#q'), engBox = $('#engines'), multiBtn = $('#multiSearch'), searchPages = $('#searchPages');
  const desktop = matchMedia('(pointer: fine)');
  let engine = ENGINES.find(x => x.id === store.get('engine')) || ENGINES[0];
  const savedEngines = store.get('engines', []);
  let selected = ENGINES.filter(x => x.u && Array.isArray(savedEngines) && savedEngines.includes(x.id));
  let multi = desktop.matches && selected.length > 0;
  engBox.innerHTML = ENGINES.map(e =>
    `<button type="button" data-e="${e.id}" aria-pressed="false">${e.t}</button>`).join('');
  function showEngines() {
    if (multi) engine = selected[0];
    engBox.classList.toggle('multi', multi);
    engBox.querySelectorAll('button').forEach(x => {
      x.setAttribute('aria-pressed', multi ? selected.some(e => e.id === x.dataset.e) : x.dataset.e === engine.id);
      x.tabIndex = multi || x.dataset.e === engine.id ? 0 : -1;
    });
    multiBtn.hidden = !desktop.matches;
    multiBtn.setAttribute('aria-pressed', multi);
    $('#engineInfo').textContent = multi ? `已选 ${selected.length} 个来源 · 点击站内恢复单选` : '搜索来源';
    q.placeholder = multi ? '输入关键词，在选中的来源中搜索…' : engine.placeholder || (engine.u ? `在 ${engine.t} 中搜索…` : '搜索站内资源，支持拼音与首字母…');
    $('.go').setAttribute('aria-label', multi ? `打开 ${selected.length} 个搜索页面` : '执行搜索');
    $('#hint').innerHTML = multi ? `提交后打开 ${selected.length} 个搜索页 · <kbd>Esc</kbd> 清空` : engine.u ? '<kbd>Enter</kbd> 搜索 · <kbd>Esc</kbd> 清空' : '<kbd>↑</kbd><kbd>↓</kbd> 选择 · <kbd>Enter</kbd> 打开 · <kbd>Esc</kbd> 清空';
  }
  function setEngine(e) {
    multi = false; engine = e; showEngines();
  }
  function saveEngines() {
    store.set('engine', engine.id);
    store.set('engines', multi ? selected.map(e => e.id) : []);
  }
  multiBtn.addEventListener('click', () => {
    multi = !multi;
    if (multi) selected = [engine.u ? engine : ENGINES[2]];
    showEngines(); saveEngines(); onInput();
  });
  engBox.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const chosen = ENGINES.find(x => x.id === b.dataset.e);
    if (multi && chosen.u) {
      if (selected.includes(chosen)) {
        if (selected.length === 1) return void toast('至少选择一个搜索来源');
        selected = selected.filter(x => x !== chosen);
      } else selected = ENGINES.filter(x => selected.includes(x) || x === chosen);
      showEngines();
    } else setEngine(chosen);
    saveEngines(); onInput(); q.focus({ preventScroll: true });
  });
  engBox.addEventListener('keydown', e => {
    const i = ENGINES.findIndex(x => x.id === e.target.dataset.e), n = ENGINES.length;
    const k = { ArrowRight: i + 1, ArrowLeft: i - 1 + n, Home: 0, End: n - 1 }[e.key];
    if (k === undefined) return;
    e.preventDefault();
    const next = ENGINES[k % n];
    if (!multi) { setEngine(next); saveEngines(); onInput(); }
    engBox.querySelector(`[data-e="${next.id}"]`).focus();
  });
  desktop.addEventListener('change', () => { if (!desktop.matches) multi = false; showEngines(); onInput(); });
  showEngines();

  // 触屏设备在当前标签页跳转，避免手机浏览器或内嵌页面拦截新窗口。
  const open = u => {
    if (window === top && matchMedia('(pointer: coarse)').matches) location.assign(u);
    else window.open(u, '_blank', 'noopener');
  };
  const searchUrl = (e, v) => e.u + (e.id === 'scihub' ? encodeURI(v) : encodeURIComponent(v));
  function openSearches(v) {
    searchPages.hidden = true;
    // 必须在提交事件内同步打开，保留浏览器的用户手势；空白页先切断 opener 再导航。
    const blocked = selected.filter(e => {
      const tab = window.open('about:blank', '_blank');
      if (!tab) return true;
      tab.opener = null;
      tab.location.replace(searchUrl(e, v));
      return false;
    });
    if (blocked.length) {
      searchPages.innerHTML = `<p>浏览器拦截了部分新标签页，可逐个打开：</p><div>${blocked.map(e => `<a href="${esc(searchUrl(e, v))}" target="_blank" rel="noopener noreferrer">${e.t}</a>`).join('')}</div>`;
      searchPages.hidden = false;
    }
  }
  let jumped = false;
  function onInput() {
    const v = q.value;
    searchPages.hidden = true;
    terms = engine.u ? [] : parse(v);
    if (terms.length) loadExtra();
    // 同步到地址栏，便于分享或设为浏览器自定义搜索引擎
    const url = new URL(location.href);
    if (terms.length) url.searchParams.set('q', v.trim()); else url.searchParams.delete('q');
    if (access !== 'all') url.searchParams.set('access', access); else url.searchParams.delete('access');
    // 浏览器记录历史滚动位置时可能读取布局；必须先更新历史，再批量改卡片显示。
    if (url.href !== location.href) history.replaceState(null, '', url);
    apply();
  }
  let inputFrame = 0;
  function flushInput() {
    cancelAnimationFrame(inputFrame); inputFrame = 0;
    onInput();
  }
  q.addEventListener('input', () => {
    if (inputFrame) return;
    inputFrame = requestAnimationFrame(() => {
      flushInput();
      // 首次输入时把结果带到视野内
      if (!jumped && terms.length) {
        jumped = true;
        // 下一帧再滚动，让这一帧的显示状态先完成布局。
        requestAnimationFrame(() => {
          if (jumped && terms.length) $('#search').scrollIntoView({ behavior: document.documentElement.classList.contains('calm') ? 'auto' : 'smooth', block: 'start' });
        });
      }
      if (!q.value) jumped = false;
    });
  });
  $('#search').addEventListener('submit', e => {
    e.preventDefault();
    if (inputFrame) flushInput();
    const v = q.value.trim();
    const r = q.getBoundingClientRect();
    window.astraPulse?.(r.right - 30, r.top + r.height / 2, 1.4);
    if (!v && (engine.u || access === 'all')) return;
    if (multi) return void openSearches(v);
    if (engine.u) return void open(searchUrl(engine, v));
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
    if (document.activeElement === q && inputFrame && ['ArrowDown', 'ArrowUp', 'Escape'].includes(e.key)) flushInput();
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
  const setAccess = k => { access = k; $('#access').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.k === k)); };
  $('#access').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    setAccess(b.dataset.k);
    onInput();
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
      window.astraPulse?.(r.left + 26, r.top + r.height / 2, .35);
    }
  });

  /* ---------- 进场动画与导航高亮 ---------- */
  const reveal = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); reveal.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.cat, .sec-head').forEach(c => reveal.observe(c));
  renderMine();
  // 有子页面收藏或最近新增的子页面条目时，提前加载其数据
  if (xn() || fresh().some(isX)) loadExtra();

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

  /* ---------- 从地址栏 ?q= / ?access= 进入：直接站内搜索与筛选 ---------- */
  const p0 = new URLSearchParams(location.search), q0 = p0.get('q');
  if (ACCESS.some(([k]) => k !== 'all' && k === p0.get('access'))) setAccess(p0.get('access'));
  if (q0) {
    q.value = q0;
    setEngine(ENGINES[0]);
    requestAnimationFrame(() => $('#search').scrollIntoView({ block: 'start' }));
  }
  onInput();
})();

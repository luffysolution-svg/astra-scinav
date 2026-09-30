/* 学术前沿：像 RSS 阅读器一样浏览近 30 天论文——分类 → 期刊二级分组，时间/摘要/封面/未读/收藏筛选，阅读面板看摘要与封面。
   列表数据来自本地 data/news.js，摘要按分类拆在 data/news-abstracts/*.json（打开阅读面板只取当前分类，搜索摘要时才加载全部）；页面不请求外部接口。
   已读与收藏只存在本浏览器。 */
(() => {
  const { $, esc, store, toast, copy, share, hay, terms: parse, match } = Astra;
  const D = window.NEWS;
  const PER_J = 2;     // 按期刊分组时每刊先显示 2 篇
  const JOURNALS = 6;  // 每个大分类先渲染最近更新的 6 本期刊，避免首屏生成数百张卡
  const PAGE = 24;     // 按时间排列时每个分类先显示 24 篇
  const API = { rss: '官方 RSS', crossref: 'Crossref', arxiv: 'arXiv API', biorxiv: 'bioRxiv API', medrxiv: 'medRxiv API', chemrxiv: 'ChemRxiv' };
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>';
  const OUT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>';
  const COPY = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';
  const LINK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>';
  const cats = D.categories, catById = new Map(cats.map(c => [c.id, c]));
  const on = D.sources.filter(s => s.enabled);
  const today = D.generated ? D.generated.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const daysAgo = d => Math.round((Date.parse(today) - Date.parse(d)) / 864e5);
  const prep = a => { a.q = hay.news(a); return a; };

  /* ---------- 本机状态：已读（只记仍在数据里的）、收藏（存整条元数据，文章过了 30 天窗口仍可在收藏里看到） ---------- */
  const live = D.articles.map(prep), liveIds = new Set(live.map(a => a.id));
  let read = new Set(store.get('newsRead', []).filter(id => liveIds.has(id)));
  let favs = store.get('newsFavs', []);
  const saveRead = () => store.set('newsRead', [...read]);
  const isFav = id => favs.some(f => f.id === id);
  const A = [...live, ...favs.filter(f => !liveIds.has(f.id) && catById.has(f.category)).map(f => prep({ ...f, gone: true }))];
  const byId = new Map(A.map(a => [a.id, a]));

  /* ---------- 摘要：按大分类按需加载；打开一篇只取当前分类，搜索摘要才加载全部九类 ---------- */
  const abs = {}, absP = new Map(), absLoaded = new Set(), absFailed = new Set();
  async function loadAbs(category) {
    const ids = category ? [category] : cats.map(c => c.id);
    await Promise.all(ids.map(id => {
      if (absP.has(id)) return absP.get(id);
      const p = fetch(`data/news-abstracts/${id}.json`).then(r => {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      }).then(j => {
        Object.assign(abs, j); absLoaded.add(id); absFailed.delete(id); return j;
      }).catch(() => { absP.delete(id); absFailed.add(id); return null; });
      absP.set(id, p);
      return p;
    }));
    return abs;
  }

  /* ---------- 卡片 ---------- */
  const hue = s => [...s].reduce((h, c) => (h * 31 + c.codePointAt(0)) % 360, 7);
  const initial = j => {
    const w = j.replace(/^the\s+/i, '').split(/[\s&:]+/).filter(x => /^[a-z]/i.test(x) && !/^(of|and|in|for|the)$/i.test(x));
    return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || j)[0]).toUpperCase();
  };
  const shot = (a, big) => a.image
    ? `<img class="nw-img" src="${esc(a.image)}" alt="" ${big ? '' : 'width="72" height="72" loading="lazy" '}decoding="async">`
    : `<span class="nw-ph" style="--h:${hue(a.journal)}" aria-hidden="true">${esc(initial(a.journal))}</span>`;
  const favBtn = a => `<button type="button" class="icon-btn star" data-fav="${esc(a.id)}" aria-pressed="${isFav(a.id)}" aria-label="收藏 ${esc(a.title)}">${STAR}</button>`;
  const ago = d => { const n = daysAgo(d); return n <= 0 ? '今天' : n === 1 ? '昨天' : `${n} 天前`; };
  function card(a, i) {
    return `<article class="item nw${read.has(a.id) ? ' read' : ''}" data-id="${esc(a.id)}" style="--i:${Math.min(i, 14)}">
      ${shot(a)}
      <div class="nw-body">
        <h4><a href="${esc(a.url)}" data-open="${esc(a.id)}">${read.has(a.id) ? '' : '<i class="nw-dot" aria-hidden="true"></i><span class="sr-only">未读：</span>'}${esc(a.title)}</a></h4>
        <p class="nw-meta"><span class="nw-j">${esc(a.journal)}</span><time datetime="${esc(a.date)}" title="${esc(a.date)}">${ago(a.date)}</time>${a.abstract ? '<span class="nw-tag">摘要</span>' : ''}${a.gone ? '<span class="nw-tag">已超出 30 天</span>' : ''}${a.doi
          ? `<a class="nw-doi" href="https://doi.org/${esc(a.doi)}" target="_blank" rel="noopener noreferrer"><span class="sr-only">DOI </span>${esc(a.doi)}</a>` : ''}</p>
      </div>
      ${favBtn(a)}
    </article>`;
  }

  /* ---------- 骨架：动态列表 + 固定的来源说明 ---------- */
  $('#content').innerHTML = '<div id="list"></div>' + sources();
  const list = $('#list');
  function sourceGroups() {
    return cats.map(c => {
      const ss = D.sources.filter(s => s.category === c.id);
      return ss.length ? `<h4 class="kit-t">${esc(c.t)}</h4><div class="grid">${ss.map(s => `
        <div class="cell${s.enabled ? '' : ' off'}"><a class="card" href="${esc(s.site)}" target="_blank" rel="noopener noreferrer" style="--h:${c.hue}">
          <span class="ava" style="--h:${hue(s.name)}" aria-hidden="true">${esc(initial(s.name))}</span>
          <span class="meta"><span class="name"><span>${esc(s.name)}</span></span>
          <span class="src-meta">${s.enabled ? esc(API[s.api] || s.api) : `未启用 · ${esc(s.note || '')}`}</span></span>
        </a></div>`).join('')}</div>` : '';
    }).join('');
  }
  function sources() {
    return `<section class="cat sources in" id="sources" style="--h:210" aria-labelledby="sources-t">
      <header class="cat-head"><span class="orb" aria-hidden="true"></span><h3 id="sources-t">来源</h3><span class="en">Sources</span><span class="count">${on.length}</span></header>
      <p class="kit-note">优先使用期刊官方 RSS/Atom；官方 Feed 被拦截、缺少 DOI 或不存在时，按 ISSN 查询 Crossref；预印本使用 arXiv、bioRxiv、medRxiv 官方 API。摘要取自 Feed、Crossref、Europe PMC 或文章页公开的 meta，封面取自 Feed 或文章页，转成本地小图。每个来源保留近 30 天最多 50 篇。</p>
      <div id="sourceGroups"><p class="kit-note">滚动到这里时加载来源列表…</p></div>
    </section>`;
  }
  // 来源列表在页面最底部，接近视口时才创建一百多张来源卡片
  const sourceBox = $('#sourceGroups');
  const fillSources = () => { if (!sourceBox.dataset.ready) { sourceBox.innerHTML = sourceGroups(); sourceBox.dataset.ready = '1'; } };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { fillSources(); io.disconnect(); } }, { rootMargin: '600px 0px' });
    io.observe(sourceBox);
  } else fillSources();
  $('#sideNav').innerHTML = `<div class="side-group">${cats.map(c =>
    `<a href="#${esc(c.id)}" data-cat="${esc(c.id)}" style="--h:${c.hue}"><i></i>${esc(c.t)}<b></b></a>`).join('')}
    <a href="#sources" data-cat="sources" style="--h:210"><i></i>来源<b>${on.length}</b></a></div>`;

  const journals = new Set(live.map(a => a.journal));
  const fmt = iso => new Date(iso).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-');
  const stats = () => $('#stats').innerHTML = [[live.length, '近 30 天论文'], [live.filter(a => !read.has(a.id)).length, '未读'], [journals.size, '种期刊'], [D.generated ? fmt(D.generated) : '—', '数据更新']]
    .map(([n, l]) => `<div><dt>${l}</dt><dd>${esc(n)}</dd></div>`).join('');
  stats();
  const stale = D.generated && Date.now() - Date.parse(D.generated) > 3 * 864e5;
  $('#gen').textContent = D.generated ? `数据更新于 ${new Date(D.generated).toLocaleString('zh-CN', { hour12: false })}${stale ? '（已超过 3 天未更新）' : ''}` : '尚未同步数据';

  /* ---------- 筛选：关键词 + 分类 + 期刊 + 时间 + 排列方式 + 未读/收藏/有摘要/有封面 ---------- */
  const q = $('#q'), chips = $('#cats'), sel = $('#journal'), since = $('#since'), view = $('#view'), flags = $('#flags');
  const FLAGS = [['unread', '未读'], ['fav', '收藏'], ['abs', '有摘要'], ['img', '有封面'], ['inabs', '搜索摘要']];
  const perCat = live.reduce((m, a) => m.set(a.category, (m.get(a.category) || 0) + 1), new Map());
  let cat = 'all', journal = '';
  const flag = new Set();
  chips.innerHTML = [['all', '全部', live.length], ...cats.map(c => [c.id, c.t, perCat.get(c.id) || 0])]
    .map(([k, t, n]) => `<button type="button" data-cat="${esc(k)}" aria-pressed="${k === 'all'}">${esc(t)}<small>${n}</small></button>`).join('');
  flags.innerHTML = FLAGS.map(([k, t]) => `<button type="button" data-flag="${k}" aria-pressed="false"${k === 'inabs' ? ' title="连同摘要一起搜索（首次使用会加载摘要数据）"' : ''}>${t}</button>`).join('')
    + '<span class="chip-sep" aria-hidden="true"></span><button type="button" data-act="readall">当前结果全部标为已读</button>';
  // 期刊下拉只列当前分类下有文章的期刊，按分类分组
  function fillJournals() {
    const opts = cats.filter(c => cat === 'all' || c.id === cat).map(c => {
      const js = [...new Set(A.filter(a => a.category === c.id).map(a => a.journal))].sort((x, y) => x.localeCompare(y, 'en'));
      return js.length ? `<optgroup label="${esc(c.t)}">${js.map(j => `<option value="${esc(j)}">${esc(j)}</option>`).join('')}</optgroup>` : '';
    }).join('');
    sel.innerHTML = '<option value="">全部期刊</option>' + opts;
    if (![...sel.options].some(o => o.value === journal)) journal = '';
    sel.value = journal;
  }
  const setCat = k => {
    cat = k;
    chips.querySelectorAll('[data-cat]').forEach(b => b.setAttribute('aria-pressed', b.dataset.cat === k));
    fillJournals();
  };
  const setFlag = (k, v) => { v ? flag.add(k) : flag.delete(k); flags.querySelector(`[data-flag="${k}"]`).setAttribute('aria-pressed', v); };
  chips.addEventListener('click', e => {
    const b = e.target.closest('[data-cat]');
    if (b) { setCat(b.dataset.cat); render(); }
  });
  flags.addEventListener('click', async e => {
    const b = e.target.closest('[data-flag], [data-act]');
    if (!b) return;
    if (b.dataset.act === 'readall') {
      const ids = [...hits.values()].flat().map(a => a.id).filter(id => !read.has(id));
      if (!ids.length) return void toast('当前结果都已读');
      ids.forEach(id => read.add(id)); saveRead(); stats(); render();
      return void toast(`已将 ${ids.length} 篇标为已读`);
    }
    const k = b.dataset.flag;
    setFlag(k, !flag.has(k));
    if (k === 'inabs' && flag.has(k) && absLoaded.size < cats.length) { toast('正在加载摘要…'); await loadAbs(); }
    render();
  });
  sel.addEventListener('change', () => { journal = sel.value; render(); });
  since.addEventListener('change', render);
  view.addEventListener('change', render);
  let inputT;
  q.addEventListener('input', () => { clearTimeout(inputT); inputT = setTimeout(render, 120); });
  $('#search').addEventListener('submit', e => { e.preventDefault(); clearTimeout(inputT); render(); });

  /* ---------- 列表：按期刊分组（期刊按最新一篇排序，每刊先显示 PER_J 篇）或按时间排列 ---------- */
  let hits = new Map(), liveT;
  const shown = new Map();   // 分组键 → 已显示篇数
  const more = (key, n) => n > 0 ? `<button type="button" class="btn nw-more" data-more="${esc(key)}">显示更多（还有 ${n} 篇）</button>` : '';
  // 期刊分组的锚点 id：分类 + 期刊在全部期刊中的序号（稳定、不含特殊字符）
  const JIX = new Map([...new Set(A.map(a => a.journal))].sort().map((j, i) => [j, i]));
  const jid = (c, j) => `${c}--j${JIX.get(j)}`;
  function section(c, h, grouped) {
    const head = `<header class="cat-head"><span class="orb" aria-hidden="true"></span><h3 id="${esc(c.id)}-t">${esc(c.t)}</h3>
      <span class="en">${esc(c.en)}</span><span class="count">${h.length}</span></header>`;
    if (!h.length) return `${head}<p class="kit-note">近 30 天暂无新论文，或本分类的来源这次同步未取到数据。</p>`;
    if (!grouped) {
      const n = shown.get(c.id) || PAGE;
      return `${head}<div class="items nws">${h.slice(0, n).map(card).join('')}</div>${more(c.id, h.length - n)}`;
    }
    const js = [...h.reduce((m, a) => m.set(a.journal, [...(m.get(a.journal) || []), a]), new Map())];
    // 期刊二级目录：点一下只看这本刊；正文先渲染最近更新的几本，其他按需展开
    const nav = js.length > 1 ? `<div class="nw-js" role="group" aria-label="${esc(c.t)}的期刊">${js.map(([j, xs]) =>
      `<button type="button" data-journal="${esc(j)}">${esc(j)}<small>${xs.length}</small></button>`).join('')}</div>` : '';
    const jkey = `${c.id}--journals`, jn = shown.get(jkey) || JOURNALS;
    const groups = js.slice(0, jn).map(([j, xs]) => {
      const key = jid(c.id, j), n = shown.get(key) || PER_J;
      return `<div class="nw-group" id="${esc(key)}">
        <h4 class="nw-gt" tabindex="-1"><span class="nw-ph sm" style="--h:${hue(j)}" aria-hidden="true">${esc(initial(j))}</span>${esc(j)}<small>${xs.length} 篇 · ${xs.filter(a => !read.has(a.id)).length} 未读</small></h4>
        <div class="items nws">${xs.slice(0, n).map(card).join('')}</div>${more(key, xs.length - n)}
      </div>`;
    }).join('');
    const left = js.length - jn;
    return head + nav + groups + (left > 0 ? `<button type="button" class="btn nw-more" data-more-journals="${esc(c.id)}">显示更多期刊（还有 ${left} 本）</button>` : '');
  }
  // keep：只是已读/收藏状态变了，保留各组已展开的篇数
  function render(keep) {
    if (keep !== true) shown.clear();
    const ts = parse(q.value), days = +since.value || 0, grouped = view.value !== 'time';
    const filtering = ts.length > 0 || cat !== 'all' || !!journal || days > 0 || flag.size > (flag.has('inabs') ? 1 : 0);
    document.body.classList.toggle('searching', filtering);
    const hay = a => flag.has('inabs') && abs?.[a.id] ? a.q + ' ' + abs[a.id].toLowerCase() : a.q;
    hits = new Map(cats.map(c => [c.id, []]));
    for (const a of A) {
      if (a.gone && !flag.has('fav')) continue;
      if ((cat === 'all' || a.category === cat) && (!journal || a.journal === journal) && (!days || daysAgo(a.date) < days)
        && (!flag.has('unread') || !read.has(a.id)) && (!flag.has('fav') || isFav(a.id)) && (!flag.has('abs') || a.abstract)
        && (!flag.has('img') || a.image) && match(hay(a), ts)) hits.get(a.category).push(a);
    }
    for (const h of hits.values()) h.sort((x, y) => y.date.localeCompare(x.date));
    // 不筛选时九个分类都显示（没有文章的给出说明）；筛选时只显示有结果的分类
    list.innerHTML = cats.filter(c => filtering ? hits.get(c.id).length : true).map(c =>
      `<section class="cat in" id="${esc(c.id)}" style="--h:${c.hue}" aria-labelledby="${esc(c.id)}-t">${section(c, hits.get(c.id), grouped && !journal)}</section>`).join('');
    const total = [...hits.values()].reduce((s, h) => s + h.length, 0);
    $('#sources').hidden = filtering;
    $('#empty').hidden = total > 0 || !filtering;
    $('#empty').textContent = flag.has('fav') && !favs.length ? '还没有收藏的论文，点卡片右侧的星标即可收藏。' : '没有匹配的论文，换个关键词、分类或筛选条件试试。';
    if (!A.length) { $('#empty').hidden = false; $('#empty').textContent = '还没有同步到论文数据。'; }
    sideNav();
    clearTimeout(liveT);
    if (filtering) liveT = setTimeout(() => { $('#live').textContent = total ? `找到 ${total} 篇论文` : '没有匹配的论文'; }, 500);
    // 筛选条件写进地址栏，刷新不丢，也可直接分享（未读、收藏只在本机，不写入）
    const url = new URL(location.href), sp = url.searchParams;
    const put = (k, v) => v ? sp.set(k, v) : sp.delete(k);
    put('q', ts.length && q.value.trim()); put('cat', cat !== 'all' && cat); put('journal', journal);
    put('days', days && String(days)); put('view', !grouped && 'time');
    put('only', ['abs', 'img', 'inabs'].filter(k => flag.has(k)).join(','));
    history.replaceState(null, '', url);
  }
  list.addEventListener('click', e => {
    const j = e.target.closest('[data-journal]');
    if (j) { journal = j.dataset.journal; sel.value = journal; render(); $('#list .cat')?.scrollIntoView({ block: 'start' }); return; }
    const mj = e.target.closest('[data-more-journals]');
    if (mj) {
      const c = mj.dataset.moreJournals, js = [...hits.get(c).reduce((m, a) => m.set(a.journal, [...(m.get(a.journal) || []), a]), new Map())];
      const from = shown.get(`${c}--journals`) || JOURNALS, first = js[from]?.[0];
      shown.set(`${c}--journals`, js.length);
      render(true);
      if (first) requestAnimationFrame(() => document.querySelector(`#${jid(c, first)} .nw-gt`)?.focus());
      return;
    }
    const b = e.target.closest('[data-more]');
    if (!b) return;
    const key = b.dataset.more, box = b.previousElementSibling;
    const c = key.split('--')[0];
    const h = key.includes('--') ? hits.get(c).filter(a => jid(c, a.journal) === key) : hits.get(c);
    const from = box.children.length, to = Math.min(from + PAGE, h.length);
    shown.set(key, to);
    box.insertAdjacentHTML('beforeend', h.slice(from, to).map((a, i) => card(a, i)).join(''));
    // 焦点移到新出现的第一篇，键盘用户可以接着往下读
    box.children[from]?.querySelector('h4 a')?.focus();
    const next = more(key, h.length - to);
    if (next) b.outerHTML = next; else b.remove();
  });

  /* ---------- 阅读面板：封面、摘要、DOI、原文；←/→ 或 j/k 在当前结果里切换 ---------- */
  const rd = $('#reader');
  let cur = null, back = null;
  // 阅读器在当前筛选结果中切换，不受“首屏只渲染部分期刊/文章”影响；直链到未渲染文章也有正确序号
  const order = () => cats.flatMap(c => hits.get(c.id) || []).map(a => a.id);
  function mark(id, v) {
    if (v === read.has(id)) return;
    v ? read.add(id) : read.delete(id);
    saveRead(); stats();
    list.querySelectorAll(`.nw[data-id="${id}"]`).forEach(el => {
      el.classList.toggle('read', v);
      const a = el.querySelector('h4 a');
      a.querySelector('.nw-dot')?.remove(); a.querySelector('.sr-only')?.remove();
      if (!v) a.insertAdjacentHTML('afterbegin', '<i class="nw-dot" aria-hidden="true"></i><span class="sr-only">未读：</span>');
    });
  }
  function body(a, abstract) {
    return `
      <div class="snip"><div class="snip-head"><b>摘要</b>${abstract ? `<button type="button" class="btn" data-copyabs>${COPY}复制摘要</button>` : ''}</div>
        <p class="prompt-text rd-abs">${abstract ? esc(abstract) : a.abstract && absFailed.has(a.category) ? '摘要加载失败，重新打开可重试。' : a.abstract && !absLoaded.has(a.category) ? '正在加载摘要…' : '这篇暂无公开摘要，点“阅读原文”查看。'}</p></div>
      <div class="vw-act">
        <a class="btn primary" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${OUT}阅读原文</a>
        ${a.doi ? `<a class="btn" href="https://doi.org/${esc(a.doi)}" target="_blank" rel="noopener noreferrer">DOI</a>` : ''}
        <button type="button" class="btn" data-cite>${COPY}复制引用</button>
        <button type="button" class="btn" data-share>${LINK}分享</button>
        <button type="button" class="btn" data-unread>标为未读</button>
        ${favBtn(a)}
      </div>
      ${a.doi ? `<p class="vw-src">DOI：<span class="nw-doi">${esc(a.doi)}</span></p>` : ''}
      <p class="kit-note">摘要与封面来自出版方公开的元数据，版权归出版方与作者。</p>`;
  }
  async function open(id) {
    const a = byId.get(id);
    if (!a) return;
    cur = id;
    const c = catById.get(a.category);
    rd.style.setProperty('--h', c.hue);
    rd.classList.toggle('no-img', !a.image);
    $('#rdStage').innerHTML = a.image ? shot(a, true) : '';
    $('#rd-t').textContent = a.title;
    $('#rdMeta').innerHTML = `<span class="nw-j">${esc(a.journal)}</span><span>${esc(c.t)}</span><time datetime="${esc(a.date)}">${esc(a.date)}（${ago(a.date)}）</time>`;
    $('#rdBody').innerHTML = body(a, abs?.[id]);
    const ids = order(), k = ids.indexOf(id);
    $('#rdCount').textContent = k < 0 ? '' : `${k + 1} / ${ids.length}`;
    $('#rdBody').scrollTop = 0;
    if (!rd.open) { back = document.activeElement; rd.showModal(); }
    mark(id, true);
    if (decodeURIComponent(location.hash.slice(1)) !== id) history.replaceState(null, '', '#' + id);
    if (a.abstract && !absLoaded.has(a.category)) { await loadAbs(a.category); if (cur === id) $('#rdBody').innerHTML = body(a, abs[id]); }
  }
  function step(d) {
    const ids = order();
    if (!ids.length) return;
    const k = ids.indexOf(cur);
    open(ids[(k + d + ids.length) % ids.length]);
  }
  rd.addEventListener('close', () => {
    history.replaceState(null, '', location.pathname + location.search);
    const el = list.querySelector(`.nw[data-id="${cur}"] h4 a`);
    (el || back)?.focus();
    cur = null;
  });
  rd.addEventListener('click', e => { if (e.target === rd) rd.close(); });
  rd.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'k') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight' || e.key === 'j') { e.preventDefault(); step(1); }
  });

  /* ---------- 点击：打开阅读面板（Ctrl/⌘/Shift 点击仍在新标签打开原文）、收藏、复制、分享 ---------- */
  function toggleFav(id) {
    const a = byId.get(id), on = !isFav(id);
    // 收藏存整条元数据（不含封面），文章过了 30 天窗口仍能在收藏里看到
    favs = on ? [{ id, title: a.title, date: a.date, journal: a.journal, doi: a.doi, image: null, abstract: a.abstract, url: a.url, category: a.category, source: a.source }, ...favs] : favs.filter(f => f.id !== id);
    store.set('newsFavs', favs);
    document.querySelectorAll(`[data-fav="${id}"]`).forEach(b => b.setAttribute('aria-pressed', on));
    if (flag.has('fav')) render(true);   // “只看收藏”中取消收藏后立即移出结果
    toast(on ? '已收藏（保存在本浏览器）' : '已取消收藏');
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-open], [data-fav], [data-copyabs], [data-cite], [data-share], [data-unread], [data-act^="rd-"]');
    if (!t) return;
    if (t.dataset.open) {
      if (e.ctrlKey || e.metaKey || e.shiftKey) { mark(t.dataset.open, true); return; }
      e.preventDefault();
      open(t.dataset.open);
      return;
    }
    const a = byId.get(cur);
    if (t.dataset.fav) toggleFav(t.dataset.fav);
    else if ('copyabs' in t.dataset) copy(abs[cur], { btn: t });
    else if ('cite' in t.dataset) copy(`${a.title}. ${a.journal} (${a.date.slice(0, 4)}).${a.doi ? ` https://doi.org/${a.doi}` : ` ${a.url}`}`, { btn: t, msg: '已复制引用' });
    else if ('share' in t.dataset) { const u = new URL(location.href); u.search = ''; u.hash = cur; share({ title: a.title, url: u.href, btn: t }); }
    else if ('unread' in t.dataset) { mark(cur, false); toast('已标为未读'); }
    else ({ 'rd-close': () => rd.close(), 'rd-prev': () => step(-1), 'rd-next': () => step(1) })[t.dataset.act]?.();
  });
  // 中键在新标签打开原文也记为已读
  list.addEventListener('auxclick', e => { const t = e.target.closest('[data-open]'); if (t && e.button === 1) mark(t.dataset.open, true); });

  /* ---------- 侧栏：各分类当前数量与滚动高亮；点到被筛选隐藏的分类时先清除筛选 ---------- */
  const side = $('#sideNav'), box = $('.side');
  let spy;
  function sideNav() {
    side.querySelectorAll('a[data-cat]').forEach(a => { if (hits.has(a.dataset.cat)) a.querySelector('b').textContent = hits.get(a.dataset.cat).length; });
    spy?.disconnect();
    spy = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      side.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.cat === e.target.id));
      const a = side.querySelector(`a[data-cat="${e.target.id}"]`);
      if (a && box.scrollWidth > box.clientWidth) box.scrollTo({ left: a.offsetLeft - box.clientWidth / 2 + a.offsetWidth / 2, behavior: 'smooth' });
    }), { rootMargin: '-35% 0px -60% 0px' });
    document.querySelectorAll('#list .cat, #sources').forEach(s => spy.observe(s));
  }
  side.addEventListener('click', e => {
    const a = e.target.closest('a[data-cat]');
    if (a?.dataset.cat === 'sources') fillSources();
    if (a && !document.getElementById(a.dataset.cat)?.offsetParent) {
      q.value = ''; journal = ''; since.value = ''; [...flag].forEach(k => setFlag(k, false)); setCat('all'); render();
    }
  });

  /* ---------- 快捷键与初始状态 ---------- */
  addEventListener('keydown', e => {
    if (rd.open) return;
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if ((e.key === '/' && !typing) || (e.key === 'k' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); q.focus(); q.select(); }
    else if (e.key === 'Escape' && document.activeElement === q) { q.value = ''; render(); q.blur(); }
  });
  const p0 = new URLSearchParams(location.search);
  if (p0.get('q')) q.value = p0.get('q');
  journal = journals.has(p0.get('journal')) ? p0.get('journal') : '';
  if ([...since.options].some(o => o.value === p0.get('days'))) since.value = p0.get('days');
  if (p0.get('view') === 'time') view.value = 'time';
  (p0.get('only') || '').split(',').filter(k => ['abs', 'img', 'inabs'].includes(k)).forEach(k => setFlag(k, true));
  setCat(catById.has(p0.get('cat')) ? p0.get('cat') : 'all');
  render();
  if (flag.has('inabs')) loadAbs().then(() => render());
  const h0 = decodeURIComponent(location.hash.slice(1));
  if (byId.has(h0)) open(h0);
  else if (h0) document.getElementById(h0)?.scrollIntoView();
})();
/* 科研 SKILL / 科研 Prompt 页面：按分类渲染卡片、搜索筛选、复制与展开、收藏、填空、分享与推荐 */
(() => {
  const { $, esc, store, toast, copy, share: shareLink, status, badges, hay: HAY, terms: parse, match } = Astra;
  const page = document.body.dataset.page;
  const DATA = page === 'skills' ? window.SKILLS : window.PROMPTS;
  // 收藏与首页「我的星座」共用：astra:favSkills 存仓库名，astra:favPrompts 存 Prompt id
  const FAV_KEY = page === 'skills' ? 'favSkills' : 'favPrompts';
  let favs = store.get(FAV_KEY, []);
  const favBtn = (key, name) => `<button type="button" class="icon-btn star" data-fav="${esc(key)}" aria-pressed="${favs.includes(key)}" aria-label="收藏 ${esc(name)}">${STAR}</button>`;
  const HUES = [42, 200, 265, 150, 20, 320, 180, 95, 235, 0];
  const texts = [];   // 复制按钮通过下标取原文，避免把长文本塞进属性
  const keep = t => texts.push(t) - 1;
  const gh = r => `https://github.com/${r}`;
  const fmt = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n);
  const COPY = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>';

  /* ---------- SKILL 仓库卡片 ---------- */
  function repoCard(r, hue, i, c) {
    const skills = r.skills || [];
    const hay = HAY.skill(r, c);
    const cmds = (r.install || []).map(c => `
      <div class="cmd"><span class="cmd-l">${esc(c.label)}</span><code>${esc(c.cmd)}</code>
        <button type="button" class="icon-btn" data-copy="${keep(c.cmd)}" aria-label="复制命令：${esc(c.label)}">${COPY}</button></div>`).join('');
    const list = skills.map(s => `<li><a href="${gh(r.repo)}/tree/HEAD/${s.path.split('/').map(encodeURIComponent).join('/')}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a><span>${esc(s.desc)}</span></li>`).join('');
    return `<article class="item repo" id="${esc(r.repo)}" style="--h:${hue};--i:${Math.min(i, 14)}" data-q="${esc(hay)}">
      <header class="item-head">
        <span class="ava" style="--h:${hue}" aria-hidden="true">${esc([...r.name][0].toUpperCase())}</span>
        <div class="item-title">
          <h4><a href="${gh(r.repo)}" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a>${badges('s:' + r.repo)}</h4>
          <span class="item-sub">${esc(r.repo)}</span>
        </div>
        <span class="stars" title="GitHub 星标">${STAR}${fmt(r.stars || 0)}</span>
        ${favBtn(r.repo, r.name)}
      </header>
      <p class="item-desc">${esc(r.desc)}</p>
      <p class="item-meta"><span${r.license ? '' : ' title="仓库未声明开源协议，本站只收录简介与链接"'}>${esc(r.license || '未声明协议')}</span>${r.updated ? `<span>更新于 ${esc(r.updated)}</span>` : ''}${r.doc === false ? '<span title="仓库未写安装说明，给出的是通用手动安装方式">通用安装方式</span>' : ''}${checked('s:' + r.repo)}
        ${tools(r.repo, r.name, gh(r.repo), 's:' + r.repo, 'push')}</p>
      ${cmds ? `<div class="cmds">${cmds}</div>` : `<a class="btn" href="${gh(r.repo)}#readme" target="_blank" rel="noopener noreferrer">查看清单</a>`}
      ${skills.length ? (id => `<div class="more" id="${id}">
        <ul class="skill-list">${list}</ul></div>
        <button type="button" class="toggle" aria-expanded="false" aria-controls="${id}">包含的 Skill · ${skills.length}</button>`)(`more-${uid++}`) : ''}
    </article>`;
  }
  /* ---------- Prompt 卡片 ---------- */
  const REPOS = new Map((DATA.repos || []).map(r => [r.repo, r]));
  // 把 [占位符] 高亮出来，提醒使用者替换；v 为已填写的值，填了的显示成填写内容
  const PH = /\[[^\]\n]{1,40}\]/g;
  const mark = (t, v = {}) => t.split(/(\[[^\]\n]{1,40}\])/).map((s, k) =>
    k % 2 ? `<mark class="ph${v[s] ? ' filled' : ''}">${esc(v[s] || s)}</mark>` : esc(s)).join('');
  const fill = (t, v) => t.replace(PH, m => v[m] || m);
  const vals = art => Object.fromEntries([...art.querySelectorAll('[data-ph]')].filter(x => x.value.trim()).map(x => [x.dataset.ph, x.value.trim()]));
  const EDIT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>';
  const LINK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>';
  function promptCard(p, hue, i, c) {
    const src = REPOS.get(p.src);
    const href = p.path ? `${gh(p.src)}/blob/${encodeURIComponent(src?.branch || 'HEAD')}/${p.path.split('/').map(encodeURIComponent).join('/')}` : gh(p.src);
    const id = `more-${uid++}`, k = keep(p.p);
    // 可填空的占位符：去重，并跳过 [ ]、[...] 这类不含文字的
    const phs = [...new Set(p.p.match(PH) || [])].filter(m => /[\p{L}\p{N}]/u.test(m));
    return `<article class="item prompt" id="${esc(p.id)}" style="--h:${hue};--i:${Math.min(i, 14)}" data-k="${k}" data-q="${esc(HAY.prompt(p, c, src))}" data-lang="${p.lang}">
      <header class="item-head">
        <div class="item-title"><h4>${esc(p.t)}${badges('p:' + p.id)}</h4></div>
        <span class="lang">${p.lang === 'en' ? 'EN' : '中文'}</span>
        ${favBtn(p.id, p.t)}
      </header>
      <div class="more clamp" id="${id}"><pre class="prompt-text">${mark(p.p)}</pre></div>
      ${phs.length ? `<div class="fill" id="${id}-f" hidden>
        <p class="fill-tip">填写后点「复制」即得到替换好的完整提示词，留空的保持原样</p>
        ${phs.map(m => `<label><span>${esc(m.slice(1, -1))}</span><textarea rows="1" data-ph="${esc(m)}"></textarea></label>`).join('')}
      </div>` : ''}
      <footer class="item-foot">
        <button type="button" class="btn primary" data-copy="${k}">${COPY}复制</button>
        ${phs.length ? `<button type="button" class="btn" data-fill aria-expanded="false" aria-controls="${id}-f">${EDIT}填空 · ${phs.length}</button>` : ''}
        <button type="button" class="toggle" aria-expanded="false" aria-controls="${id}">展开全文</button>
        ${tools(p.id, p.t, href, 'p:' + p.id)}
        <a class="src" href="${href}" target="_blank" rel="noopener noreferrer" title="${esc(p.src)}">来源 · ${esc(src?.name || p.src)} · ${esc(src?.licenseNote || src?.license || '协议待核实')}</a>
      </footer>
    </article>`;
  }
  let uid = 0;
  // 分享与报告问题按钮；url 为报告时预填的原始链接
  const FLAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>';
  const tools = (id, name, url, key, cls = '') => `<button type="button" class="icon-btn ${cls}" data-share="${esc(id)}" aria-label="分享：${esc(name)}" title="分享">${LINK}</button>
        <button type="button" class="icon-btn" data-report="${esc(key)}" data-name="${esc(name)}" data-url="${esc(url)}" aria-label="报告问题：${esc(name)}" title="报告失效或信息有误">${FLAG}</button>`;
  const checked = key => { const st = status(key); return st?.checked ? `<span title="自动核验链接可访问的日期">核验 ${esc(st.checked)}</span>` : ''; };

  /* ---------- 渲染 ---------- */
  const cats = DATA.categories.map((c, k) => ({ ...c, hue: c.hue ?? HUES[k % HUES.length], items: c.repos || c.prompts || [] }));
  const render = page === 'skills' ? repoCard : promptCard;
  $('#content').innerHTML = cats.map(c => `
    <section class="cat" id="${esc(c.id)}" style="--h:${c.hue}" aria-labelledby="${esc(c.id)}-t">
      <header class="cat-head">
        <span class="orb" aria-hidden="true"></span>
        <h3 id="${esc(c.id)}-t">${esc(c.t)}</h3>
        <span class="en">${esc(c.en || '')}</span>
        <span class="count">${c.items.length}</span>
      </header>
      <div class="items">${c.items.map((x, i) => render(x, c.hue, i, c)).join('')}</div>
    </section>`).join('');
  $('#sideNav').innerHTML = `<div class="side-group">${cats.map(c =>
    `<a href="#${esc(c.id)}" data-cat="${esc(c.id)}" style="--h:${c.hue}"><i></i>${esc(c.t)}<b>${c.items.length}</b></a>`).join('')}</div>`;
  // Prompt 页底部列出全部来源仓库（含未摘录内容的），方便查看更多
  if (page === 'prompts' && DATA.repos?.length) {
    const used = new Set(cats.flatMap(c => c.items.map(p => p.src)));
    $('#content').insertAdjacentHTML('beforeend', `
      <section class="cat sources" id="sources" style="--h:210" aria-labelledby="sources-t">
        <header class="cat-head"><span class="orb" aria-hidden="true"></span><h3 id="sources-t">来源仓库</h3><span class="en">Sources</span><span class="count">${DATA.repos.length}</span></header>
        <div class="grid">${[...DATA.repos].sort((a, b) => (b.stars || 0) - (a.stars || 0)).map((r, i) => `
          <div class="cell" style="--h:210;--i:${Math.min(i, 14)}"><a class="card" href="${gh(r.repo)}" target="_blank" rel="noopener noreferrer">
            <span class="ava" style="--h:210" aria-hidden="true">${esc([...r.name][0].toUpperCase())}</span>
            <span class="meta"><span class="name"><span>${esc(r.name)}</span></span><span class="desc">${esc(r.desc)}</span>
            <span class="src-meta">★ ${fmt(r.stars || 0)} · ${esc(r.licenseNote || r.license || '未声明协议')}${used.has(r.repo) ? ' · 已摘录' : ' · 仅列出链接'}</span></span>
          </a></div>`).join('')}</div>
      </section>`);
    $('#sideNav .side-group').insertAdjacentHTML('beforeend', `<a href="#sources" data-cat="sources" style="--h:210"><i></i>来源仓库<b>${DATA.repos.length}</b></a>`);
  }

  const all = cats.flatMap(c => c.items);
  const stats = page === 'skills'
    ? [[all.length, '收录仓库'], [all.reduce((n, r) => n + (r.skills?.length || 0), 0), '列出 Skill'], [cats.length, '领域分类']]
    : [[all.length, '精选提示词'], [(DATA.repos || []).length, '来源仓库'], [cats.length, '科研环节']];
  $('#stats').innerHTML = stats.map(([n, l]) => `<div><dt>${l}</dt><dd>${n}</dd></div>`).join('');
  if (DATA.generated) $('#gen').textContent = `数据更新于 ${DATA.generated}`;

  /* ---------- 复制与展开 ---------- */
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-copy]');
    if (c) {
      const art = c.closest('.prompt');
      return void copy(art ? fill(texts[+c.dataset.copy], vals(art)) : texts[+c.dataset.copy], { btn: c });
    }
    const f = e.target.closest('[data-fav]');
    if (f) return void toggleFav(f);
    const s = e.target.closest('[data-share]');
    if (s) return void share(s.dataset.share, s);
    const fb = e.target.closest('[data-fill]');
    if (fb) {
      const open = fb.getAttribute('aria-expanded') !== 'true', box = document.getElementById(fb.getAttribute('aria-controls'));
      fb.setAttribute('aria-expanded', open);
      box.hidden = !open;
      if (open) box.querySelector('textarea').focus();
      return;
    }
    const t = e.target.closest('.toggle');
    if (!t) return;
    setOpen(t, t.getAttribute('aria-expanded') !== 'true');
  });
  function setOpen(t, open) {
    t.setAttribute('aria-expanded', open);
    document.getElementById(t.getAttribute('aria-controls')).classList.toggle('open', open);
    if (page === 'prompts') t.textContent = open ? '收起' : '展开全文';
  }
  // 填空时实时预览替换结果，输入框随内容增高
  document.addEventListener('input', e => {
    const x = e.target.closest('[data-ph]');
    if (!x) return;
    x.style.height = 'auto';
    x.style.height = x.scrollHeight + 'px';
    const art = x.closest('.prompt');
    art.querySelector('.prompt-text').innerHTML = mark(texts[+art.dataset.k], vals(art));
  });

  /* ---------- 收藏：与首页「我的星座」共用 ---------- */
  function toggleFav(b) {
    const key = b.dataset.fav, on = !favs.includes(key);
    favs = on ? [key, ...favs] : favs.filter(x => x !== key);
    store.set(FAV_KEY, favs);
    b.setAttribute('aria-pressed', on);
    toast(on ? '已收藏，可在首页「我的星座」查看' : '已取消收藏');
  }
  // 其他标签页（如首页）改了收藏时同步星标状态
  addEventListener('storage', e => {
    if (e.key !== 'astra:' + FAV_KEY) return;
    favs = store.get(FAV_KEY, []);
    document.querySelectorAll('[data-fav]').forEach(b => b.setAttribute('aria-pressed', favs.includes(b.dataset.fav)));
  });

  /* ---------- 分享链接：prompts.html#review-3 ---------- */
  function share(id, btn) {
    const url = new URL(location.href);
    url.search = ''; url.hash = encodeURIComponent(id);
    shareLink({ title: btn.closest('.item')?.querySelector('h4')?.textContent, url: url.href, btn });
  }
  /* ---------- 搜索与筛选 ---------- */
  const q = $('#q');
  const items = [...document.querySelectorAll('.item')], secs = [...document.querySelectorAll('.cat:not(.sources)')];
  const sources = $('#sources');
  let lang = 'all';
  const langs = $('#langs');
  const setLang = k => { lang = k; langs?.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.dataset.k === k)); };
  if (langs) {
    langs.innerHTML = [['all', '全部'], ['zh', '中文'], ['en', 'English']].map(([k, t]) => `<button type="button" data-k="${k}" aria-pressed="${k === 'all'}">${t}</button>`).join('');
    langs.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      setLang(b.dataset.k);
      apply();
    });
  }
  let liveT;
  function apply() {
    const terms = parse(q.value);
    const filtering = terms.length > 0 || lang !== 'all';
    document.body.classList.toggle('searching', filtering);
    if (sources) sources.hidden = filtering;
    for (const it of items) it.hidden = !((lang === 'all' || it.dataset.lang === lang) && match(it.dataset.q, terms));
    for (const s of secs) {
      const n = s.querySelectorAll('.item:not([hidden])').length;
      s.hidden = !n;
      s.querySelector('.count').textContent = n;
    }
    const shown = items.filter(i => !i.hidden).length;
    $('#empty').hidden = shown > 0;
    clearTimeout(liveT);
    if (filtering) liveT = setTimeout(() => { $('#live').textContent = shown ? `找到 ${shown} 项` : '没有匹配的结果'; }, 500);
    const url = new URL(location.href);
    if (terms.length) url.searchParams.set('q', q.value.trim()); else url.searchParams.delete('q');
    if (lang !== 'all') url.searchParams.set('lang', lang); else url.searchParams.delete('lang');
    history.replaceState(null, '', url);
  }
  q.addEventListener('input', apply);
  $('#search').addEventListener('submit', e => e.preventDefault());
  addEventListener('keydown', e => {
    const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if ((e.key === '/' && !typing) || (e.key === 'k' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); q.focus(); q.select(); }
    else if (e.key === 'Escape' && document.activeElement === q) { q.value = ''; apply(); q.blur(); }
  });
  const p0 = new URLSearchParams(location.search);
  if (p0.get('q')) q.value = p0.get('q');
  if (langs && ['zh', 'en'].includes(p0.get('lang'))) setLang(p0.get('lang'));
  if (q.value || lang !== 'all') apply();

  /* ---------- 进场动画与侧栏高亮 ---------- */
  const reveal = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); reveal.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  [...secs, sources].filter(Boolean).forEach(s => reveal.observe(s));
  const sideLinks = new Map([...document.querySelectorAll('#sideNav a')].map(a => [a.dataset.cat, a]));
  const spy = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    sideLinks.forEach((a, k) => a.classList.toggle('on', k === e.target.id));
    const a = sideLinks.get(e.target.id), box = $('.side');
    if (a && box && box.scrollWidth > box.clientWidth) box.scrollTo({ left: a.offsetLeft - box.clientWidth / 2 + a.offsetWidth / 2, behavior: 'smooth' });
  }), { rootMargin: '-35% 0px -60% 0px' });
  [...secs, sources].filter(Boolean).forEach(s => spy.observe(s));

  /* ---------- 从分享链接或首页进入：定位并展开对应卡片 ---------- */
  function openHash() {
    let id; try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const it = id && items.find(x => x.id === id);
    if (!it) return;
    if (it.hidden) { q.value = ''; setLang('all'); apply(); }
    it.closest('.cat').classList.add('in');
    const t = it.querySelector('.toggle');
    if (t) setOpen(t, true);
    requestAnimationFrame(() => {
      it.scrollIntoView({ block: 'center', behavior: document.documentElement.classList.contains('calm') ? 'auto' : 'smooth' });
      it.classList.remove('hit'); void it.offsetWidth; it.classList.add('hit');
    });
  }
  addEventListener('hashchange', openHash);
  openHash();

  /* ---------- 推荐仓库 / 提示词：Netlify Forms ---------- */
  const dlg = $('#dlg'), form = $('#dlgForm'), msg = $('#dlgMsg');
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'suggest') { form.reset(); msg.textContent = ''; dlg.showModal(); }
    else if (a === 'close') dlg.close();
  });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (form['bot-field'].value) return void dlg.close();
    const url = form.url.value.trim();
    // 只接受 http(s) 链接，SKILL 页要求是 GitHub 仓库
    let ok = !url && !form.url.required;
    try { const u = new URL(url); ok = /^https?:$/.test(u.protocol) && (page !== 'skills' || u.hostname === 'github.com'); } catch { /* 非法链接 */ }
    if (!ok) return void (msg.textContent = page === 'skills' ? '请输入 GitHub 仓库链接，如 https://github.com/作者/仓库' : '来源链接需以 http:// 或 https:// 开头');
    msg.textContent = '提交中…';
    try { await Astra.feedback(new URLSearchParams(new FormData(form)), form); }
    catch (error) { msg.textContent = error.message; return; }
    dlg.close();
    toast('感谢推荐，审核后会收录');
  });
})();

/* 科研 SKILL / 科研 Prompt 页面：按分类渲染卡片、搜索筛选、复制与展开 */
(() => {
  const { $, esc, copy } = Astra;
  const page = document.body.dataset.page;
  const DATA = page === 'skills' ? window.SKILLS : window.PROMPTS;
  const HUES = [42, 200, 265, 150, 20, 320, 180, 95, 235, 0];
  const texts = [];   // 复制按钮通过下标取原文，避免把长文本塞进属性
  const keep = t => texts.push(t) - 1;
  const gh = r => `https://github.com/${r}`;
  const fmt = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n);
  const COPY = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>';

  /* ---------- SKILL 仓库卡片 ---------- */
  function repoCard(r, hue, i) {
    const skills = r.skills || [];
    const hay = [r.repo, r.name, r.desc, ...skills.flatMap(s => [s.name, s.desc])].join(' ').toLowerCase();
    const cmds = (r.install || []).map(c => `
      <div class="cmd"><span class="cmd-l">${esc(c.label)}</span><code>${esc(c.cmd)}</code>
        <button type="button" class="icon-btn" data-copy="${keep(c.cmd)}" aria-label="复制命令：${esc(c.label)}">${COPY}</button></div>`).join('');
    const list = skills.map(s => `<li><a href="${gh(r.repo)}/tree/HEAD/${s.path.split('/').map(encodeURIComponent).join('/')}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a><span>${esc(s.desc)}</span></li>`).join('');
    return `<article class="item repo" style="--h:${hue};--i:${Math.min(i, 14)}" data-q="${esc(hay)}">
      <header class="item-head">
        <span class="ava" style="--h:${hue}" aria-hidden="true">${esc([...r.name][0].toUpperCase())}</span>
        <div class="item-title">
          <h4><a href="${gh(r.repo)}" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a></h4>
          <span class="item-sub">${esc(r.repo)}</span>
        </div>
        <span class="stars" title="GitHub 星标">${STAR}${fmt(r.stars || 0)}</span>
      </header>
      <p class="item-desc">${esc(r.desc)}</p>
      <p class="item-meta">${r.license ? `<span>${esc(r.license)}</span>` : ''}${r.updated ? `<span>更新于 ${esc(r.updated)}</span>` : ''}${r.doc === false ? '<span title="仓库未写安装说明，给出的是通用手动安装方式">通用安装方式</span>' : ''}</p>
      ${cmds ? `<div class="cmds">${cmds}</div>` : `<a class="btn" href="${gh(r.repo)}#readme" target="_blank" rel="noopener noreferrer">查看清单</a>`}
      ${skills.length ? (id => `<div class="more" id="${id}">
        <ul class="skill-list">${list}</ul></div>
        <button type="button" class="toggle" aria-expanded="false" aria-controls="${id}">包含的 Skill · ${skills.length}</button>`)(`more-${uid++}`) : ''}
    </article>`;
  }
  /* ---------- Prompt 卡片 ---------- */
  const REPOS = new Map((DATA.repos || []).map(r => [r.repo, r]));
  // 把 [占位符] 高亮出来，提醒使用者替换
  const mark = t => esc(t).replace(/\[[^\]\n]{1,40}\]/g, m => `<mark class="ph">${m}</mark>`);
  function promptCard(p, hue, i) {
    const src = REPOS.get(p.src);
    const href = p.path ? `${gh(p.src)}/blob/${encodeURIComponent(src?.branch || 'HEAD')}/${p.path.split('/').map(encodeURIComponent).join('/')}` : gh(p.src);
    const id = `more-${uid++}`;
    return `<article class="item prompt" style="--h:${hue};--i:${Math.min(i, 14)}" data-q="${esc(`${p.t} ${p.p} ${p.src}`.toLowerCase())}" data-lang="${p.lang}">
      <header class="item-head">
        <div class="item-title"><h4>${esc(p.t)}</h4></div>
        <span class="lang">${p.lang === 'en' ? 'EN' : '中文'}</span>
      </header>
      <div class="more clamp" id="${id}"><pre class="prompt-text">${mark(p.p)}</pre></div>
      <footer class="item-foot">
        <button type="button" class="btn primary" data-copy="${keep(p.p)}">${COPY}复制</button>
        <button type="button" class="toggle" aria-expanded="false" aria-controls="${id}">展开全文</button>
        <a class="src" href="${href}" target="_blank" rel="noopener noreferrer" title="${esc(p.src)}">来源 · ${esc(src?.name || p.src)}</a>
      </footer>
    </article>`;
  }
  let uid = 0;

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
      <div class="items">${c.items.map((x, i) => render(x, c.hue, i)).join('')}</div>
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
            <span class="src-meta">★ ${fmt(r.stars || 0)} · ${esc(r.licenseNote || r.license || '未声明协议')}${used.has(r.repo) ? '' : ' · 仅列出'}</span></span>
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
    if (c) return void copy(texts[+c.dataset.copy]);
    const t = e.target.closest('.toggle');
    if (!t) return;
    const open = t.getAttribute('aria-expanded') !== 'true';
    t.setAttribute('aria-expanded', open);
    document.getElementById(t.getAttribute('aria-controls')).classList.toggle('open', open);
    if (page === 'prompts') t.textContent = open ? '收起' : '展开全文';
  });
  /* ---------- 搜索与筛选 ---------- */
  const q = $('#q');
  const items = [...document.querySelectorAll('.item')], secs = [...document.querySelectorAll('.cat:not(.sources)')];
  const sources = $('#sources');
  let lang = 'all';
  const langs = $('#langs');
  if (langs) {
    langs.innerHTML = [['all', '全部'], ['zh', '中文'], ['en', 'English']].map(([k, t]) => `<button type="button" data-k="${k}" aria-pressed="${k === 'all'}">${t}</button>`).join('');
    langs.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      lang = b.dataset.k;
      langs.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
      apply();
    });
  }
  let liveT;
  function apply() {
    const terms = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const filtering = terms.length > 0 || lang !== 'all';
    document.body.classList.toggle('searching', filtering);
    if (sources) sources.hidden = filtering;
    for (const it of items) it.hidden = !((lang === 'all' || it.dataset.lang === lang) && terms.every(t => it.dataset.q.includes(t)));
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
    history.replaceState(null, '', url);
  }
  q.addEventListener('input', apply);
  $('#search').addEventListener('submit', e => e.preventDefault());
  addEventListener('keydown', e => {
    const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if ((e.key === '/' && !typing) || (e.key === 'k' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); q.focus(); q.select(); }
    else if (e.key === 'Escape' && document.activeElement === q) { q.value = ''; apply(); q.blur(); }
  });
  const q0 = new URLSearchParams(location.search).get('q');
  if (q0) { q.value = q0; apply(); }

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
})();

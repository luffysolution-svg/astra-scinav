// 导入大模型生图提示词图库到科研绘图「大模型生图提示词」分类（每个来源一个子分类，见该分类的 subs）
//   node scripts/import_ai_figure_prompts.mjs raw/ai4scholar-gallery.json
// 输入文件名（去掉 .json）即来源 id，必须已在 content/figures.json 的 sources 中登记，且：
//   - 不是 listOnly（只列链接的来源）；
//   - 写明收录依据 licenseUrl（协议链接）或 licenseNote（收录说明）。
// raw/ai4scholar-gallery.json 由站长在自己已登录的浏览器里逐页打开图库、从页面读取整理（不调用 robots.txt 禁止的 /api/）。
// raw/ 是本地私有目录，不提交。导入后运行 node scripts/sync_figures.mjs 下载预览图并转成本地 WebP。
import fs from 'node:fs';
import path from 'node:path';

const CAT = 'ai-prompts';
const file = process.argv[2];
if (!file) { console.error('用法：node scripts/import_ai_figure_prompts.mjs raw/<来源 id>.json'); process.exit(1); }

// 各来源的导出格式适配：把一条原始记录转成统一的 Prompt 条目字段；新增有授权的来源时在这里加一个函数
const ADAPTERS = {
  // Ai4Scholar 图库页面整理：[{ id, title, prompt, model, category, tags, aspectRatio, image, url? }]
  // 图库没有单条作品的独立页面，原链接统一指向图库页，用 #图片编号 区分
  'ai4scholar-gallery': (r, src) => ({
    key: String(r.id), sub: 'ai4scholar',
    t: r.title, en: '', tool: r.model, desc: [r.category, ...(r.tags || [])].filter(Boolean).join(' · '),
    url: r.url || `${src.url}#${encodeURIComponent(r.id)}`,
    img: r.image, prompt: r.prompt, model: r.model, tags: [r.category, ...(r.tags || [])].filter(Boolean), aspect: r.aspectRatio,
  }),
};

const id = path.basename(file, '.json');
const data = JSON.parse(fs.readFileSync('content/figures.json', 'utf8'));
const src = data.sources.find(s => s.id === id);
const fail = m => { console.error(m); process.exit(1); };
if (!src) fail(`content/figures.json 的 sources 中没有来源 ${id}`);
if (src.listOnly) fail(`来源 ${id} 标记为 listOnly（${src.license}），未获再分发授权，拒绝导入`);
if (!src.licenseUrl && !src.licenseNote) fail(`来源 ${id} 没有写明授权依据（licenseUrl 或 licenseNote），拒绝导入`);
if (!ADAPTERS[id]) fail(`没有来源 ${id} 的导出格式适配函数，请在 ADAPTERS 中添加`);

const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!Array.isArray(raw)) fail(`${file} 应为数组`);
const cat = data.categories.find(c => c.id === CAT);
const squash = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const seen = { t: new Map(), prompt: new Map(), img: new Map() };
for (const x of cat.items) for (const k of Object.keys(seen)) seen[k].set(squash(x[k]), x.id || x.t);

let added = 0, updated = 0;
const problems = [];
for (const r of raw) {
  const x = ADAPTERS[id](r, src);
  const miss = ['t', 'prompt', 'img', 'model', 'aspect'].filter(k => !x[k]);
  if (miss.length) { problems.push(`${x.key}：缺少 ${miss.join('、')}`); continue; }
  if (!(cat.subs || []).some(s => s.id === x.sub)) { problems.push(`${x.key}：子分类 ${x.sub} 不在 ${CAT}.subs 中`); continue; }
  const item = { t: x.t, en: x.en, type: 'prompt', tool: x.tool, src: id, sub: x.sub, desc: x.desc, url: x.url, img: x.img, prompt: x.prompt, model: x.model, tags: x.tags, aspect: x.aspect };
  // 同一原链接视为同一条：更新内容，保留已分配的 id（收藏与分享链接不变）
  const old = cat.items.find(o => o.src === id && o.url === item.url);
  // 标题、提示词、图片与其他条目重复的不导入
  const dup = Object.keys(seen).find(k => seen[k].has(squash(item[k])) && seen[k].get(squash(item[k])) !== (old?.id || old?.t));
  if (dup) { problems.push(`${x.key}「${x.t}」：${{ t: '标题', prompt: '提示词', img: '图片' }[dup]}与 ${seen[dup].get(squash(item[dup]))} 重复，跳过`); continue; }
  if (old) {
    // 原图地址变了才清掉尺寸，让 sync_figures.mjs 重新生成缩略图
    if (old.img !== item.img) { delete old.w; delete old.h; }
    Object.assign(old, item);
    updated++;
  } else {
    cat.items.push(item);
    added++;
  }
  for (const k of Object.keys(seen)) seen[k].set(squash(item[k]), old?.id || item.t);
}
fs.writeFileSync('content/figures.json', JSON.stringify(data, null, 2) + '\n');
if (problems.length) console.warn(`未导入 ${problems.length} 条：\n  ${problems.join('\n  ')}`);
console.log(`\n${id}：新增 ${added} · 更新 ${updated}。下一步：node scripts/sync_figures.mjs && node scripts/status.mjs && node scripts/validate.mjs`);

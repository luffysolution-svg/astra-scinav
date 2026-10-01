# CLAUDE.md

## 项目

Astra（星图）是无构建步骤的静态科研与 AI 资源导航站。可发布文件都在 `site/`。现有 Netlify 配置从 GitHub `main` 部署，原域名 `https://nav.luffysite.top` 暂未切换到 Vercel。Vercel 项目 `astra-scinav` 已通过 CLI 发布到 `https://astra-scinav.vercel.app`，暂未连接 Git 自动部署。

## 常用命令

```bash
npm run check                         # 检查导航去重与未收录来源（依赖本地 raw/）
node scripts/validate.mjs            # 数据校验（链接格式、id、引用、协议、生成文件一致性），提交前运行，CI 同样执行
node scripts/linkcheck.mjs --content --sample 80  # 分批抽查外链（含 Skill/Prompt/绘图/期刊指南），按周轮换
node scripts/status.mjs              # 新增/删除条目后运行：记录新增日期并生成 site/data/status.js
node scripts/pinyin.mjs              # 重建拼音搜索索引
node scripts/sync_collections.mjs    # 同步 Skill / Prompt 元数据并生成页面数据
node scripts/sync_figures.mjs        # 下载科研绘图缩略图并生成页面数据（需 ffmpeg/ffprobe）
node scripts/sync_figures.mjs --offline  # 仅从现有 JSON 重建绘图页面数据
node scripts/sync_news.mjs           # 同步学术前沿（官方 RSS/Atom → Crossref → arXiv/bioRxiv/medRxiv API），补摘要与封面（需 ffmpeg），CI 每日 06:00 运行
node scripts/sync_news.mjs --backfill  # 同上，并为全部文章重试摘要/封面（默认补新文章，并每天重试旧文章缺失的摘要）
node scripts/sync_news.mjs --offline # 仅由 content/news.json 重建 site/data/news.js 与 news-abstracts/*.json
node scripts/import_ai_figure_prompts.mjs raw/<来源id>.json  # 导入生图提示词图库（来源须有 licenseUrl/licenseNote 且非 listOnly），再运行 sync_figures
netlify deploy --prod --no-build --dir site  # 自动部署不可用时手动发布
npx --yes vercel@62.1.0 deploy --prod --scope luffysolution-4375s-projects  # 已登录并关联 Vercel 项目后发布
```

## 内容与生成文件

- 主导航数据：`site/data/{ai,lit,lab,kit}.js`。
- Skill / Prompt 源数据：`content/{skills,prompts}.json`；生成文件：`site/data/{skills,prompts}.js`。
- 科研绘图源数据：`content/figures.json`；生成文件：`site/data/figures.js`；本地缩略图：`site/figures/*.webp`。
- 不要直接编辑生成的数据文件，应修改对应的 `content/*.json` 后运行同步脚本。
- 绘图模板 ID 是收藏和分享链接的一部分，只新增、不重排、不复用。
- 学术前沿：来源配置 `content/news-sources.json`（九个固定分类；禁用须写 `note`）；快照 `content/news.json` 与 `site/data/news.js`、按分类拆分的 `site/data/news-abstracts/*.json`、封面 `site/news/*.webp` 由 `sync_news.mjs` 生成。文章字段固定为 `id,title,date,journal,doi,image,abstract,url,category,source`；打开阅读器只加载当前分类摘要，搜索摘要时才加载全部；`image` 只能是本地 WebP（CSP 不允许外链图片）。抓取只用自己的 UA，不伪装浏览器、不用无头浏览器或第三方代理绕过 Cloudflare；被拦截的来源靠 ISSN 回退 Crossref。
- 生图提示词（`type: "prompt"`）用 `prompt` 字段，不用 `code`；`ai-prompts` 分类按来源分子分类（`subs`，条目用 `sub` 指明）；`listOnly` 来源只能列链接，不能收录条目。Ai4Scholar Gallery 未公开再分发协议，是站长决定标注来源后收录的（见其 `licenseNote`），数据由站长本人登录的浏览器从图库页面整理到 `raw/ai4scholar-gallery.json`。
- 链接字段（`url` 等）只能放单个地址；备注写 `note`，补充链接写 `refs: [{ t, url }]`。
- 只摘录已声明允许再分发协议的 Prompt；未声明协议或 NC/ND 的来源只列出链接（`validate.mjs` 会拦截）。
- 首页与子页面的搜索字段、同义词表统一在 `site/common.js`（`Astra.hay` / `SYN`），改检索逻辑只改这里。
- 首页外部搜索入口在 `site/app.js` 的 `ENGINES`：站内、Google、谷歌学术、百度、必应、知网、PubMed、X-MOL、Sci-Hub、Semantic Scholar。外部搜索直接打开目标网站，无需 API Key 或后端；X-MOL 使用 `/q?option=`，Sci-Hub 输入 DOI 或论文链接并保留路径分隔符。按钮在宽屏为五列两行，屏幕宽度不超过 800px 时为两列五行。
- 条目状态在 `content/status.json`（键名：导航为链接，其余为 `s:仓库` / `p:id` / `f:id`，与收藏一致）：`added` 由 `status.mjs` 记录，`checked` / `fails` 只由 GitHub Actions 每周的 `linkcheck --write` 更新；本地网络噪声大，不要在本地用 `--write`。
- 首页收藏分组 `astra:groups`、私人备注 `astra:notes` 只存浏览器，随导出备份（v4）。
- 绘图工作台 `site/workbench.html` 用 iframe 嵌入独立站点 `https://canvas.luffysite.top`（Netlify 站点 `astra-canvas`，构建自 fork `luffysolution-svg/infinite-canvas` 的 `main`，该分支只跟随上游）。画布站响应头与 SPA 回退在 `deploy/canvas/`，由 `.github/workflows/canvas.yml` 每小时同步上游、构建并部署；不要把画布源码搬进 `site/`。

## 约束

- 已按用户决定撤回独立“科研工具”模块（MinerU 解析、Materials Project / 点石 / Semantic Scholar API、Zotero 联动、本地桥及其依赖）；不要重新引入。原有导航站点链接与首页外部搜索入口保留。
- 用户反馈 Netlify credits 不足，已在 2026-10-02 通过 Vercel CLI 发布 `astra-scinav`，服务端状态为 `Ready`、目标为 `production`。`vercel.json` 配置静态输出 `site/`、跳过安装和构建，并沿用站点响应头；`.vercelignore` 只允许上传 `site/` 和 `vercel.json`。线上主页、六个子页面、脚本、样式、缓存规则及自定义错误页通过 HTTP 检查；最终手机布局尚未完成浏览器实测，不要把 HTTP 检查写成手机实测。现有 Netlify 配置保留，Cloudflare 与原域名迁移尚未完成。
- `raw/` 是用户的私人书签来源，只在本地使用，绝不能提交。
- 不要恢复 `!s` 一类搜索前缀。
- 分类保持通用，不按用户私人书签或个人工作流组织。
- 第三方 Prompt、代码和图片必须确认许可；预览图统一转存为本地 WebP。
- 修改离线 shell 文件列表时同步更新 `site/sw.js`，并递增缓存版本。
- 只做请求所需的改动，沿用现有原生 HTML/CSS/JavaScript 风格，不引入前端框架或构建链。

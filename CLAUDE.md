# CLAUDE.md

## 项目

Astra（星图）是原生静态科研与 AI 资源导航站。页面文件在 `site/`，Vercel 反馈函数在 `api/` 与 `lib/`。截至 2026-10-02，正式域名 `https://nav.luffysite.top` 已迁到 Vercel 项目 `astra-scinav`，默认域名为 `https://astra-scinav.vercel.app`，已关联 GitHub main 自动发布。已完成配置、真实验证证据及未验收范围见 `docs/vercel-verification.md`。

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
npm run migrate:check               # 只检查本地 Vercel 迁移配置
npm run migrate:configure           # 在已登录 Vercel/GitHub 的终端配置私有存储、项目设置及 Actions secrets，不部署或修改 DNS
node scripts/import_ai_figure_prompts.mjs raw/<来源id>.json  # 导入生图提示词图库（来源须有 licenseUrl/licenseNote 且非 listOnly），再运行 sync_figures
npx --yes vercel@62.1.0 --prod --yes --scope luffysolution-4375s-projects  # 必要时从已关联的仓库根目录手动发布导航
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
- 绘图工作台 `site/workbench.html` 用 iframe 嵌入独立站点 `https://canvas.luffysite.top`。正式画布使用 Vercel 项目 `luffy-canvas-site`，Git 集成跟随 fork `luffysolution-svg/infinite-canvas` 的 `main`，该分支只跟随上游。`.github/workflows/canvas.yml` 每小时先同步上游，再尝试构建并发布 Netlify 备用站 `astra-canvas`；当前备用生产发布因账号额度用尽返回 403，不影响 Vercel 跟随 fork 的 Git 发布。不要把画布源码搬进 `site/`，也不要删除或停用备用站。

## 约束

- 已按用户决定撤回独立“科研工具”模块（MinerU 解析、Materials Project / 点石 / Semantic Scholar API、Zotero 联动、本地桥及其依赖）；不要重新引入。原有导航站点链接与首页外部搜索入口保留。
- 用户决定迁移到 Vercel，并使用服务端存储保存反馈。`vercel.json` 使用 `npm ci` 安装反馈函数依赖，页面输出仍为 `site/`，不引入前端构建；五类表单调用 `/api/feedback`。Private Blob `astra-feedback` 已连接 Production / Preview，`BLOB_READ_WRITE_TOKEN` 已注入；正式 nav 域名的五类真实桌面 Edge 表单收到 201，并按 UUID 私有读回核对，未认证下载返回 403。旧 Netlify Forms 已按五类正常记录、垃圾箱和站点总表核对，现存 0 条，完整查询结果已私有归档；原站点和表单未删除。反馈、私有下载地址和凭据不得公开。详见 `docs/vercel-migration.md` 与 `docs/vercel-verification.md`。
- 用户已授权并完成迁移配置、停用 Netlify 导航站 Git 自动构建和合并 main；`netlify.toml` 的 ignore 恒返回 0，独立画布不受影响。Cloudflare 仅修改 nav / canvas 两条 CNAME 到各自 Vercel 项目要求的目标，均为 DNS only、TTL Auto，其他记录保留；不要重复迁移或改动无关 DNS。用户随后要求历史 Forms 迁移和后续验收，正式域名的真实桌面 Edge 主要流程已验证，包括收藏备份恢复、五类反馈、画布编辑持久化和文献缓存更新。触屏模拟的 16 次入口跳转通过，但不等于实体手机 Edge；中国大陆网络、外部目标的完整可用性和付费 AI / 本地 Agent 未验证，部署成功不能等同这些范围已通过。
- `raw/` 是用户的私人书签来源，只在本地使用，绝不能提交。
- 不要恢复 `!s` 一类搜索前缀。
- 分类保持通用，不按用户私人书签或个人工作流组织。
- 第三方 Prompt、代码和图片必须确认许可；预览图统一转存为本地 WebP。
- 修改离线 shell 文件列表时同步更新 `site/sw.js`，并递增缓存版本。
- Vercel 已关联 GitHub 仓库，普通 push 由 Git 集成发布。`.github/workflows/deploy.yml` 只接续文献/Skill/Prompt 同步，以及定时/手动外链核验，不接续普通 push/PR 校验，以免重复部署。Actions secrets `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID` 已配置；本轮手动文献同步 run 36962759193 和接续生产发布 run 36963220514 均成功，数据提交 5cce84d 已推送 main。正式页面最近抓取时间实测为 2026-10-02 12:08（UTC+08:00），3177 篇；保留 astra-v16 和原 Service Worker，普通刷新四类摘要哈希更新，摘要加载/复制与五页离线打开通过。该时间是实测快照，后续应查看最新运行。`.vercelignore` 只允许上传页面、函数源码和运行所需配置，禁止上传 `raw/`、凭据或私有笔记。
- 画布 Vercel 项目级 Routing Rule 已发布，嵌入允许 `nav.luffysite.top` 与 `astra-scinav.vercel.app`，随机预览域名未放行；项目规则无需修改上游 fork 源码。备用 Netlify 的响应头与 SPA 回退在 `deploy/canvas/`，适配文件的哈希纳入发布版本；其 403 已确认是账号 credit usage exceeded，不要误判成 fork 构建失败或盲目轮换 token。
- 学术前沿 `generated` 是内容快照更新时间，`fetchedAt` 是最近成功抓取时间；无内容变化的抓取仍更新后者。摘要 URL 使用每分类内容哈希版本，缺失已声明摘要时绕过缓存重试，不把旧缓存当作成功加载。
- 只做请求所需的改动，沿用现有原生 HTML/CSS/JavaScript 风格，不引入前端框架或构建链。

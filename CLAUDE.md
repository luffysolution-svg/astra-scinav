# CLAUDE.md

## 项目

Astra（星图）是无构建步骤的静态科研与 AI 资源导航站。可发布文件都在 `site/`，Netlify 由 GitHub `main` 自动部署，线上域名为 `https://nav.luffysite.top`。

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
netlify deploy --prod --no-build --dir site  # 自动部署不可用时手动发布
```

## 内容与生成文件

- 主导航数据：`site/data/{ai,lit,lab,kit}.js`。
- Skill / Prompt 源数据：`content/{skills,prompts}.json`；生成文件：`site/data/{skills,prompts}.js`。
- 科研绘图源数据：`content/figures.json`；生成文件：`site/data/figures.js`；本地缩略图：`site/figures/*.webp`。
- 不要直接编辑生成的数据文件，应修改对应的 `content/*.json` 后运行同步脚本。
- 绘图模板 ID 是收藏和分享链接的一部分，只新增、不重排、不复用。
- 链接字段（`url` 等）只能放单个地址；备注写 `note`，补充链接写 `refs: [{ t, url }]`。
- 只摘录已声明允许再分发协议的 Prompt；未声明协议或 NC/ND 的来源只列出链接（`validate.mjs` 会拦截）。
- 首页与子页面的搜索字段、同义词表统一在 `site/common.js`（`Astra.hay` / `SYN`），改检索逻辑只改这里。
- 条目状态在 `content/status.json`（键名：导航为链接，其余为 `s:仓库` / `p:id` / `f:id`，与收藏一致）：`added` 由 `status.mjs` 记录，`checked` / `fails` 只由 GitHub Actions 每周的 `linkcheck --write` 更新；本地网络噪声大，不要在本地用 `--write`。
- 首页收藏分组 `astra:groups`、私人备注 `astra:notes` 只存浏览器，随导出备份（v4）。

## 约束

- `raw/` 是用户的私人书签来源，只在本地使用，绝不能提交。
- 不要恢复 `!s` 一类搜索前缀。
- 分类保持通用，不按用户私人书签或个人工作流组织。
- 第三方 Prompt、代码和图片必须确认许可；预览图统一转存为本地 WebP。
- 修改离线 shell 文件列表时同步更新 `site/sw.js`，并递增缓存版本。
- 只做请求所需的改动，沿用现有原生 HTML/CSS/JavaScript 风格，不引入前端框架或构建链。

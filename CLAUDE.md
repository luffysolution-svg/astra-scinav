# CLAUDE.md

## 项目

Astra（星图）是无构建步骤的静态科研与 AI 资源导航站。可发布文件都在 `site/`，Netlify 由 GitHub `main` 自动部署，线上域名为 `https://nav.luffysite.top`。

## 常用命令

```bash
npm run check                         # 检查导航去重与未收录来源（依赖本地 raw/）
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

## 约束

- `raw/` 是用户的私人书签来源，只在本地使用，绝不能提交。
- 不要恢复 `!s` 一类搜索前缀。
- 分类保持通用，不按用户私人书签或个人工作流组织。
- 第三方 Prompt、代码和图片必须确认许可；预览图统一转存为本地 WebP。
- 修改离线 shell 文件列表时同步更新 `site/sw.js`，并递增缓存版本。
- 只做请求所需的改动，沿用现有原生 HTML/CSS/JavaScript 风格，不引入前端框架或构建链。

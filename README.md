# Astra 星图

原生 HTML、CSS、JavaScript 构建的科研资源导航，提供文献检索、AI 科研、论文写作、科研绘图与学术前沿浏览。页面无需前端框架或打包器。

[访问主站](https://nav.luffysite.top/) · [GitHub 项目](https://github.com/luffysolution-svg/astra-scinav) · [安全问题披露](SECURITY.md)

## 功能

- 分类导航、站内关键词与拼音搜索，以及跨 SKILL、Prompt、绘图内容检索。
- 桌面端多选外部搜索引擎，同一关键词打开多个搜索页面；被浏览器拦截时可逐个打开。
- 收藏、分组、私人备注、自定义站点和备份导入导出，保存在当前浏览器。
- 科研 SKILL 目录、可填空和复制的 Prompt、绘图示例与模板预览。
- 学术前沿按期刊或时间浏览，支持未读、收藏、摘要及图片筛选；摘要按需加载，缺少论文配图时可显示已获取的期刊封面，并标明来源。
- WebGL 背景动画、动画开关与离线缓存。系统启用减弱动态效果时默认暂停动画。
- 独立部署的绘图画布嵌入工作台；同一工作台页面内切换导航后返回可继续使用画布。

## 本地预览与检查

使用 Node.js 22 或更新版本、npm 和 Python 3，在仓库根目录运行：

```sh
npm ci
python -m http.server 4173 --directory site
```

打开 [本地预览](http://localhost:4173/)。静态预览不提供 `/api/feedback`，也不启动独立画布的服务端；画布仍访问其独立部署。

在另一个终端检查数据与测试：

```sh
npm run validate
node --test tests/*.test.mjs
npm audit
```

生产依赖 `@vercel/blob` 用于可选的反馈接口；开发依赖 `pinyin-pro` 用于生成拼音索引。仅浏览静态页面不需要在浏览器中加载这些 npm 包。

## 数据维护

`site/` 是发布目录，`content/` 保存 SKILL、Prompt、绘图和论文数据。`site/data/` 中标注自动生成的文件应通过对应脚本更新。

```sh
npm run pinyin
node scripts/sync_collections.mjs --offline
node scripts/sync_figures.mjs --offline
node scripts/sync_news.mjs --offline
node scripts/sync_news_journal_covers.mjs --offline
node scripts/status.mjs
npm run validate
```

以上命令由现有数据重建页面资源。联网同步去掉对应的 `--offline`；论文配图可单独运行 `node scripts/sync_news.mjs --images-only`，不重新抓取论文列表。联网更新 GitHub 仓库信息需要配置 `GITHUB_TOKEN`，或在本机登录 GitHub CLI；图片下载和 WebP 转换需要 FFmpeg，绘图缩略图还使用 FFprobe。

GitHub Actions 包含每日论文同步、每周 SKILL/Prompt 同步、每周外链核验和推送/PR 数据检查。发布工作流可在同步完成后接续部署；fork 后需自行配置权限、计划任务与部署 Secrets。上游限流、访问拦截、入库延迟或缺少公开图片时，部分内容可能暂时缺失。

## 部署与私有反馈

静态页面可部署到支持静态文件的托管服务，发布目录为 `site`。内置反馈接口使用 Vercel Functions；部署配置见 `vercel.json`。需要反馈功能时，在 Vercel 项目连接 **Private Blob**，将 `BLOB_READ_WRITE_TOKEN` 配置为服务端环境变量。反馈保存为私有 JSON，由维护者审核，站点不提供公开读取接口；未配置服务时，页面会明确提示提交失败。

普通推送可通过 Vercel Git 集成部署。仓库内的自动发布工作流另需在 GitHub Actions Secrets 配置 `VERCEL_TOKEN`、`VERCEL_ORG_ID` 和 `VERCEL_PROJECT_ID`。不要把实际凭据、反馈内容或私有文件地址提交到仓库。

绘图工作台访问独立的 [画布站](https://canvas.luffysite.top/)，上游为 [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas)。本仓库不包含画布源码或其服务端；自行部署画布时需同步调整工作台地址和 CSP 的允许来源。画布中的作品、API Key 和请求由该独立应用管理，使用前请了解它的存储与接口设置。

## 离线与本地数据

Service Worker 当前只在 HTTPS 下注册。离线缓存不包含未访问过的全部论文摘要、图片或外部站点，反馈提交、在线同步和独立画布的在线功能仍需要网络。首次加载与更新需要获取缓存资源，慢网时页面可能等待网络后再回退到已有缓存。

收藏、备注与画布数据属于浏览器及其所在域名的数据；清除站点数据、换浏览器或换域名不会自动迁移。重要内容请先使用对应应用的导出功能备份。

## 许可证与第三方内容

本项目原创源代码采用 [PolyForm Noncommercial License 1.0.0](LICENSE)，版权属于 `2026 luffysolution-svg`。允许许可规定的非商用使用、修改与分发；商业使用需要维护者另行授权。仓库公开供查看与学习，不属于允许自由商用的开源许可。维护者保留另行授权及商业化的权利。

第三方 Prompt、示例代码、论文元数据、图标、缩略图和期刊封面不因此改授本项目许可；它们的来源、原始许可和使用限制见 [第三方声明](THIRD_PARTY_NOTICES.md) 及各条数据记录。

部分素材尚未明确再分发许可，公开访问和标注来源并不代表获得授权。尤其 Ai4Scholar 的作品不属于本项目的开放授权范围，复制或再分发前应核实或取得权利人的许可。

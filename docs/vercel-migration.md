# Astra：Netlify → Vercel 迁移清单

本次已准备迁移配置并完成本地验证。用户授权先停用 Netlify 导航站自动构建、再合并 main，并确认已关联 Vercel。账号侧私有反馈存储、Actions 凭据和 Cloudflare DNS 尚未通过本次环境核验；不能将代码合并等同于这些资源已配置。

## 发布配置与功能对应

| 功能 | Vercel 迁移方式 | 当前验证状态 |
| --- | --- | --- |
| 首页、SKILL、Prompt、绘图、学术前沿、404、静态数据和图片 | Framework 选择 Other，输出 `site`，页面无需构建 | 本地浏览器及 Vercel CLI 构建通过 |
| 手机平台搜索 | 触屏设备当前标签导航；桌面保留新标签 | 9 平台点击与 Enter 等 27 项断言通过；外部站点为测试替身 |
| 收藏、分组、自定义站点、导入导出 | 浏览器本地存储，与托管商无关 | 自定义收藏持久化、删除及备份恢复通过 |
| 推荐站点 / Skill / Prompt / 绘图、报告问题 | `/api/feedback` Node 函数 + Private Vercel Blob | 五类浏览器表单及私有写入替身通过，真实 Blob 待连接 |
| CSP、安全响应头、图标缓存、Service Worker | `vercel.json` 沿用原策略 | 构建产物路由含相关响应头 |
| PWA、离线页面和摘要 | 同源 Service Worker，缓存版本 `astra-v16`；API 不缓存 | 实际 Service Worker 摘要回退/重试及五个页面离线打开通过 |
| 每日文献、每周 Skill/Prompt、外链核验 | 继续使用 GitHub Actions，不需要 Vercel Cron | 修复文献提交路径，校验通过；发布凭据待配置 |
| 绘图工作台 | 嵌入独立 `canvas.luffysite.top` | 本地手机尺寸布局通过；画布实际加载需在线验证 |
| 画布上游同步和部署 | 仍在 Netlify，由 `canvas.yml` 管理 | 响应头允许新 Vercel 正式域名，适配文件改动会触发部署 |

`.vercelignore` 仅允许页面、函数源码、package 配置和 `vercel.json`，私人 `raw/` 不上传。Vercel CLI 的排除文件语义需要 `!site` 放行目录本身，不能只写 `!site/`；本次构建已实际确认包含页面和反馈函数。

## 1. 首次 Vercel 部署

账号侧配置已整理为 `npm run migrate:configure`。先在能访问 Vercel/GitHub 的本机终端登录：

```bash
npx --yes vercel@62.1.0 login
gh auth login
npm run migrate:configure
```

该命令核对 `luffysolution-4375s-projects/astra-scinav`，关联本地项目；复用一个已连接生产环境的私有 Blob，或创建 `astra-feedback` 并连接 Production / Preview；设置 Other、site、npm ci、Node.js 22；把项目 ID 和团队 ID 自动写入 GitHub Actions secrets。已有 `VERCEL_TOKEN` 会保留，缺少时由 GitHub CLI 在终端提示安全输入长期部署 token；也支持从本机环境变量提供，不写入命令参数或日志。

命令不发布站点、不推送仓库、不修改 Cloudflare DNS。已有多个存储、Public store 或令牌连接不明确时停止，需在 Storage 中核对，避免创建重复存储或覆盖错误令牌。可重复运行复用已完成步骤。`npm run migrate:check` 只检查本地配置，不能代替真实账号验证。

本次执行环境没有 Vercel 登录凭据，当前连接器也看不到目标项目；因此账号侧资源配置尚未执行成功。账号侧脚本的 5 项隔离测试通过，验证私有创建、重复运行复用、异常配置停止和凭据不进入日志。

已按授权在 main 的 `netlify.toml` 配置 `build.ignore = "exit 0"`，停用 **Netlify 导航站的 Git 自动构建**，保留当前线上版本；暂停提交和迁移合并提交另加 `[skip netlify]` 标记。该设置不锁定控制台发布，也不会阻止手动 CLI 发布或 build hook；本仓库导航没有这些自动发布工作流。独立画布的 `netlify deploy --no-build` 保持正常。依据：[Netlify Ignore builds](https://docs.netlify.com/build/configure-builds/ignore-builds/)。

下一步完成 Vercel 部署与存储验收，最后切换 `nav` DNS。新表单只使用 Vercel API，不能把这版客户端手动发布到缺少该 API 的旧 Netlify 导航站。

1. 项目 Root Directory 使用仓库根目录，Framework 为 **Other**；Build Command 留空，Output Directory 为 **site**，Install Command 为 **npm ci**；Node.js 选择 **22.x**。仓库 `vercel.json` 已提供这些命令和输出配置，控制台不要保留旧的“跳过安装”覆盖项。
2. 在项目 Storage 中创建/连接 **Private Blob store**，选择 Production；也需要预览环境测试时，再连接 Preview。确认环境变量 `BLOB_READ_WRITE_TOKEN` 已注入。若是 Public store，`access: private` 写入会失败，不能改为公开存储反馈内容。不要把凭据写进源码、浏览器脚本或聊天。
3. 发布后分别提交四类推荐和一条报告，确认收到成功提示，并在对应 Blob store 中核对 `feedback/YYYY-MM-DD/<UUID>.json`，内含表单类型、时间、字段；没有自动收录，仍需人工审核。
4. 未配置存储或写入失败，API 返回 503，页面保留输入并显示失败；不会把静态页面 HTTP 200 当作反馈成功。API 默认不提供公开查询或下载入口，也不发送邮件；Netlify 的表单后台、通知及历史记录不会自动迁移。
5. 在关闭旧 Netlify 导航站前，从 Forms 后台导出历史反馈。保留画布站及其 Netlify 凭据：本次迁移的是导航站，画布尚未迁移到 Vercel。

反馈包含服务端字段/长度/URL 校验、同源检查、honeypot 和单实例突发节流；节流不保证跨实例全局一致。如遇垃圾提交，可在 Vercel Firewall 对 `/api/feedback` 配置全局限流。存储和请求消耗按账户套餐计费。

## 2. 接通文献更新与发布

文献继续在 GitHub Actions 每日北京时间 06:00 抓取，GitHub 定时任务可能延迟。一次真实失败记录显示：102 个来源抓取结束后，提交步骤因旧的 `site/data/news-abstracts.json` 路径退出，新数据没有推入仓库。本次已移除此路径，并增加提交路径校验。

页面分别显示“数据更新”和“最近抓取”。`generated` 是内容快照时间；`fetchedAt` 是成功同步时间，没有新文章时也会更新抓取时间。本地现有数据保留真实时间，未虚构一次成功抓取。摘要按分类内容哈希取版本，声明有摘要却缺失时绕过缓存重取。

在 GitHub 仓库 **Settings → Secrets and variables → Actions → Secrets** 配置：

- `VERCEL_TOKEN`：有该项目部署权限的 Vercel token。
- `VERCEL_ORG_ID`：该项目所属 team/org ID。
- `VERCEL_PROJECT_ID`：该项目 ID。

三项来自 Vercel 项目/账号配置；可通过已登录的 CLI `vercel link` 后读取 `.vercel/project.json` 中的 ID，token 单独创建，不提交该目录。

`.github/workflows/deploy.yml` 在数据校验、文献同步、Skill/Prompt 同步成功后执行：取最新 main → validate → pull 生产配置 → build → 检查首页和函数产物 → deploy。同步任务用 `GITHUB_TOKEN` 提交不会触发普通 push/Git 部署，`workflow_run` 接续能覆盖这一情况。若同时开启 Vercel Git 集成，普通 push 可能重复部署；只保留一个普通 push 发布入口即可，但要保留定时同步后的发布机制。

首次配置后手动运行“同步学术前沿”，再确认“发布导航到 Vercel”成功，并核对线上最近抓取时间。只有代码配置完成不代表自动发布已启用。

## 3. Cloudflare DNS

若继续使用 `nav.luffysite.top`，需要改 **nav 这一条 DNS 记录的目标**；不需要把整个域名 nameserver 从 Cloudflare 迁走。

1. 先在 Vercel 项目 Domains 添加 `nav.luffysite.top`。
2. 按 Vercel 控制台为该项目展示的 **具体 CNAME 目标**修改 Cloudflare 中的 `nav` 记录。不要照搬网上固定 IP 或另一个项目的 CNAME。
3. 初次切换先用 **DNS only（灰云）**，完成域名验证、证书签发和直接访问检查。无需修改博客、根域名、邮件/MX、TXT 或 `canvas` 记录。
4. 如之后使用 Cloudflare 代理，再确认 HTTPS 配置为 **Full (strict)**、Vercel 域名证书有效；保留正确 Host/Origin，反馈接口的同源校验依赖这些信息。
5. 不要为整站配置 Cache Everything：HTML、JS、`/data/*`、`/sw.js` 应保留更新能力；`/api/*` 绕过缓存。已有 HTML/脚本/数据强缓存规则需取消或收窄，迁移后清理相关旧 CDN 缓存。图标可继续长缓存。

若仅使用 `astra-scinav.vercel.app` 测试，暂时无需改 Cloudflare。浏览器存储按 origin 隔离，因此临时 Vercel 域名看不到旧域名的收藏、分组、备注和离线缓存；先从旧站导出，再到临时域名导入。保留原域名迁移且不清除浏览器数据，原收藏仍在。SEO canonical、sitemap、OpenSearch 当前继续指向 `nav.luffysite.top`，适合保留该域名；最终若改用另一个正式域名，需要同步更新这些地址和画布的嵌入允许名单。

画布的响应头只允许 `nav.luffysite.top` 和正式 `astra-scinav.vercel.app` 嵌入；随机预览域名不自动放行。提交适配响应头会触发画布工作流，部署版本包含适配文件哈希，源码未变化也不会跳过。确认画布站这次部署成功后，再检验 Vercel 正式站的工作台。

## 4. 大陆访问验收

目前没有真实中国大陆网络测试，不能保证 Vercel 默认域名、独立域名或 Cloudflare 代理在各地区/运营商均可用。换自定义域名或开启 Cloudflare 不构成大陆可用性的保证。本次也未读取现有 Cloudflare DNS/缓存规则。

有利于本站首屏的是：字体、脚本、样式、目录、论文列表、摘要和预览图均同源提供，学术数据由 GitHub Actions 拉取，用户打开列表无需访问文献源 API。但画布仍是独立网络请求，Google/谷歌学术等搜索目标的国内可访问性也独立于导航首页。

正式切换前，用大陆移动、联通、电信至少覆盖手机蜂窝网络和宽带、Microsoft Edge，分别检查：

- 首页首次访问、刷新后脚本/数据是否完整，首次有网访问后离线缓存是否能打开。
- SKILL、Prompt、绘图和文献页面的检索、收藏、复制、摘要与本地图像。
- 百度/必应/知网等实际目标的手机搜索跳转；海外平台单独记录目标可达性。
- 一条表单提交到真实 Blob 成功；一条画布载入并可操作，手机横屏底部可用。
- 下一次文献同步后，无需强制清缓存即可看到新的抓取时间和摘要。

若 Mainland 实测持续失败或延迟不满足要求，再评估面向大陆的托管/CDN；本次未擅自切换服务商或 DNS。

## 验证证据与限制

- Vercel CLI 62.1.0 的本地隔离构建实际输出 859 个静态文件及 `api/feedback.func`，运行时 `nodejs22.x`；包内未包含 `raw/`。构建使用本地测试 project settings，未连接真实生产项目/环境变量，也未部署。CLI 的联网更新检查出现警告，但打包与产物检查完成。
- Node 接口测试覆盖五类私有写入、保存失败/缺凭据、非法 URL/字段、跨源、超长数据、4000 字中文提示词与突发节流。
- 浏览器使用 Chromium/Playwright，手机使用触屏视口和 Edge 用户代理；不等同真实 Edge 手机。表单写入、外部搜索响应和跨域画布使用替身；真实存储、目标站和画布内部需部署后核验。
- 数据校验错误 0，保留原有 12 条来源协议警告。

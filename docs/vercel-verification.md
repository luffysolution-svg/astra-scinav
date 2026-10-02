# Vercel 线上配置与验证记录

记录日期：2026-10-02，时间按 UTC+08:00。用户随后要求迁移历史 Forms 并继续验收；本轮在正式导航和画布域名上完成以下验证。真实手机、中国大陆网络和外部 AI 服务的限制单独列明。

## 已完成的配置

- 导航项目：`luffysolution-4375s-projects/astra-scinav`，项目 ID `prj_twslERVv4Yh1137RYU1Kj38xstpL`。Other、仓库根目录、输出 `site`、安装 `npm ci`、空 Build Command、Node.js 22。
- 私有存储：`astra-feedback`，ID `store_rE3bN5Afl5ymlneO`，详情 API 的 `access` 为 `private`。只连接目标项目，环境为 Production / Preview，`BLOB_READ_WRITE_TOKEN` 已注入；不记录令牌值。
- GitHub Actions：`VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID` 均存在。当前 CLI OAuth 无法创建长期个人 Token；用户在 Vercel / GitHub 页面完成安全保存后，配置脚本重跑成功。
- 画布复用已有 `luffy-canvas-site`，项目 ID `prj_e81s7fdkusOCmDQlnJX2zQOKCToq`，关联 `luffysolution-svg/infinite-canvas` fork 的 main。安装 `cd web && bun install`，构建 `cd web && bun run build`，输出 `web/dist`；已有 SPA 回退。
- `canvas.yml` 继续同步上游到 fork，Vercel Git 集成配置为跟随 fork main 发布。手动调用 merge-upstream 返回 `merge_type: none`，fork 与上游均为 `dab19adc0847e32e39b7fc8ff90cb392561fb826`，没有虚构新的同步提交。
- 画布 Vercel 项目级 Routing Rule `Astra canvas embedding headers` 已发布：`frame-ancestors 'self' https://nav.luffysite.top https://astra-scinav.vercel.app`，同时设置 nosniff 和 Referrer-Policy。无需改动 fork 源码；随机预览域名未放行。

## 历史 Netlify Forms 导出与私有归档

- 核对旧导航站 `astra-scinav`，站点 ID `24d254be-ffd4-4571-b5f3-4e5f96ede21f`、账号 `luffysolution-svg`。Netlify 连接器要求重新认证，改用已登录 CLI 的本地凭据访问 API；未输出凭据。
- 逐表单查询 `suggest`、`suggest-skill`、`suggest-prompt`、`suggest-figure`、`report` 的 verified / spam 列表，按分页链接读取，并以站点级 verified / spam 列表交叉核对。共 12 次列表请求，五类正常提交和垃圾箱均为 **0 条**，不存在待迁移的历史反馈正文。
- 2026-10-02 11:53 导出完整查询结果，归档到现有 Private Blob 的 `archive/netlify-forms/<旧站点 ID>/<UTC 时间>.json`。私有读回与导出完全匹配，SHA-256 为 `616898ddd4579e36587dd803d0f47f47eeed03345345a63f43c77fd7d8aefbc3`；匿名下载返回 **403**。原站点、表单和原记录未删除。
- 本地脱敏证据在忽略目录 `.vercel/netlify-forms-migration.json`；不把私有归档下载地址、反馈正文或令牌写入仓库。

## 正式域名的真实验证证据

- Vercel 连接器的团队、项目列表和部署查询实际成功；单项目查询曾出现参数校验不一致，资源写入使用 CLI 完成，未根据“插件已启用”推断连接成功。
- Edge 来自 Microsoft 签名的 `msedge.exe`，版本 **154.0.4258.48**，签名有效、浏览器品牌含 Microsoft Edge；使用独立无头会话，实际启动 Edge 可执行文件，未以 Chromium 用户代理冒充 Edge。
- 在 `https://nav.luffysite.top` 核验首页收藏刷新持久化、自定义站点、实际下载 v4 备份并通过文件输入导入恢复；清除数据只发生在独立测试会话中。SKILL / Prompt / 绘图列表与检索、三页收藏刷新持久化、安装命令 / Prompt 全文 / 绘图代码的实际剪贴板复制均通过（核对时统一 Windows 换行）。绘图大图实际加载成功。
- 正式域名的五类实际 UI 表单分别收到 `/api/feedback` **201**、UUID 和成功提示；按 UUID 私有读回核对类型及字段，五次匿名下载均为 **403**。本轮及前轮共保留 **17 条合成测试反馈**，不包含迁入的历史用户反馈。没有公开其内容或下载地址。
- [本轮手动文献同步 run 36962759193](https://github.com/luffysolution-svg/astra-scinav/actions/runs/36962759193) 成功，数据提交 `5cce84dd33b2da623434295c2d1ccd9a7d78d32b` 已推送 main；接续的 [Actions 生产发布 run 36963220514](https://github.com/luffysolution-svg/astra-scinav/actions/runs/36963220514) 成功。该提交的 [Vercel 生产部署](https://vercel.com/luffysolution-4375s-projects/astra-scinav/6EvuW4f3mvrhDYZtU3bo6ftWVEPC) 状态 READY。
- 本轮实际抓取成功 **98/102 来源**：arXiv 凝聚态、化学物理、物理返回 429，材料科学超时；另有 **24 个封面下载失败**，日志列出 Wiley 站点拒绝访问。同步、校验、提交和部署均完成，但不能称所有来源或封面抓取成功。
- 保持同一个 Edge 会话、`astra-v16` 和 Service Worker 控制，先缓存全部九类旧摘要，再普通刷新。`fetchedAt` 从 `2026-10-02T01:16Z` 更新为 **`2026-10-02T04:08Z`**，页面显示最近抓取成功于 **2026-10-02 12:08**，文章数 **3105 → 3177**；nature、chem-materials、physics、preprints 四类摘要哈希更新。没有注销 Service Worker 或清除缓存。
- 更新后实际打开带摘要的论文，加载 **1506 字符**摘要；点击复制并读取剪贴板，内容完全匹配。断网后首页、SKILL、Prompt、绘图、学术前沿五页均能从已有缓存加载内容；测试结束已恢复该会话网络。
- 画布 [Vercel 生产重新部署](https://vercel.com/luffysolution-4375s-projects/luffy-canvas-site/AryF58MwjNg7KgJ3YyWQz3cG6E5S) 成功。正式画布域名 HTTPS 返回 200、Server 为 Vercel、嵌入 CSP 与配置一致；深层 SPA 路由返回 200。本轮真实 Edge 从正式导航工作台 iframe 新建文本节点、编辑后重新载入同一画布，文本仍然保留，未出现页面脚本错误。
- 两个正式域名返回 `public, max-age=0, must-revalidate`；导航未知路径返回 404 和自定义“页面不存在”内容。脱敏验收 JSON 与截图保存在本机忽略目录 `.vercel/`，未上传私有反馈、凭据或用户浏览器数据。
- Windows 配置脚本修复 `.cmd` 启动 EINVAL 和 CLI Blob 列表缺少 `access` 两项实测问题。5 项脚本回归测试通过；真实 `npm run migrate:configure` 重跑确认私有存储、两个环境和三项 Secrets。

## 搜索入口的触屏验收

使用同一真实桌面 Edge 可执行文件模拟 412 × 915 手机视口和触屏：coarse pointer 为 true、maxTouchPoints 为 1；这是触屏模拟，不是实体手机 Edge。

百度、Google、谷歌学术、必应、知网、PubMed、X-MOL、Semantic Scholar 各通过 Enter 和实际触屏按钮点击两种方式，共 **16 次**。全部发起包含正确关键词的目标导航请求，并在当前标签跳转。

目标站响应另行记录：谷歌学术、必应、PubMed 返回结果页；百度和知网返回验证页；Google 的一次按钮跳转返回 429 验证页；X-MOL 返回 429 访问受限；Semantic Scholar 返回 202，未确认结果内容。不能把入口跳转正确等同于这些外部平台完全可用。Sci-Hub 在前轮被浏览器安全策略阻止，本轮未重试或绕过。

## DNS 与缓存

Cloudflare 仍管理 nameserver；只修改了 nav 和 canvas 两条 CNAME，两者均为 DNS only、TTL Auto。Vercel 返回两个域名 `configured-correctly`、`verified: true`。

| 记录 | 当前目标 | 原目标 / 回退目标 |
| --- | --- | --- |
| nav CNAME | `24cf9a9183f08969.vercel-dns-017.com` | `astra-scinav.netlify.app` |
| canvas CNAME | `795ff6642e009a68.vercel-dns-017.com` | `astra-canvas.netlify.app` |
| 根域 A | `76.76.21.21`（保留） | 未修改 |
| www A | `76.76.21.21`（保留） | 未修改 |

检查到 Cache Rules 0、Cache Response Rules 0、Caching Level Standard、Browser Cache TTL 4 小时，Always Online / Development Mode 关闭。DNS only 不经过 Cloudflare 缓存，因此未进行整站清缓存或添加缓存规则；未新增或删除其他 DNS 记录。

如需回退画布，只恢复 canvas CNAME 原目标；不要删除 Netlify 项目。导航回退会恢复旧导航版本，不能把包含 `/api/feedback` 的新客户端手动发到旧 Netlify 站。画布数据主要保存在浏览器本地，保留正式域名避免人为改变 origin；没有迁移用户本地数据或宣称云同步。

## Netlify 备用与仍需实测的范围

- [画布 Actions run 36916142387](https://github.com/luffysolution-svg/astra-scinav/actions/runs/36916142387) 构建成功、生产部署 403。使用当前账号对同一站点发起生产部署，API 明确返回 `Account credit usage exceeded - new deploys are blocked until credits are added`；控制台也显示仅剩 operational credits，生产发布暂停。未购买套餐、未删除或停用画布。旧生产版本保留，Vercel 正式画布不依赖这次 Netlify 发布成功。
- 未进行真实手机 Edge 或中国大陆网络测试，不能保证大陆各地区/运营商的访问。
- 未用真实 AI Key 发起付费生成或连接用户的本地 Agent；没有把画布 UI 可操作等同于这些外部服务已配置。
- 历史 Forms 已查询并私有归档，现存记录为 0；不是留待后续迁移的事项。若旧站未来又收到提交，关闭前应重新导出新增记录。

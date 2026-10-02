# 第三方内容与许可

仓库的 PolyForm Noncommercial 许可证适用于本项目原创源代码，不改变第三方内容的版权、许可、商标或使用限制。页面收录、来源署名、链接可公开访问，以及图片转为缩略图，均不表示本项目取得了额外的再分发权。

## 来源记录

| 内容 | 来源与许可记录 | 适用边界 |
| --- | --- | --- |
| 资源导航与站点图标 | `site/data/ai.js`、`lit.js`、`lab.js`、`kit.js` 中的站点链接；`site/data/icons.js` 中的域名 | 第三方名称、标识及图标权利仍属于对应站点或权利人。 |
| 科研 SKILL 目录 | `content/skills.json` 的 `categories[].repos[]`，包括 `repo`、`license` | 目录简介和链接不替上游授予许可；`null` 或“其他协议”不能视为开源授权。 |
| 科研 Prompt | `content/prompts.json` 的 `repos[]`，包括 `repo`、`license`、`licenseNote`；条目通过 `src` 指向来源 | 提示词沿用原来源的条款，项目的非商用许可不替代 CC0、MIT、Apache、GPL 或其他声明。未摘录正文的来源也可能仅作为目录链接收录。 |
| 绘图示例、模板、预览图与生图 Prompt | `content/figures.json` 的 `sources[]`，包括 `url`、`license`、`licenseNote`、`licenseUrl`；条目含 `src`、`url`、`img` | 软件包许可、文档许可、示例代码许可与图片许可可能不同，应逐项核实。 |
| 论文元数据、摘要与论文配图 | `content/news-sources.json` 的官方来源；`content/news.json` 的 `journal`、`doi`、`url`、`source` | 来自期刊公开 Feed、Crossref、Europe PMC 和预印本接口。摘要、文章图及其他受保护内容沿用原作者或出版社的条款，不统一改授项目许可。 |
| 期刊封面及封面选图 | `content/news-journal-covers.json` 的 `source`、`imageUrl`、`label`、`kind` | 来自出版社或期刊官网，卷期封面与封面选图在页面区分。相关版权仍属于权利人，数据记录不等于再分发许可。 |

`site/data/` 与本地缩略图是上述内容的生成结果，同样遵守原内容的许可边界。来源记录用于定位和核实，不是本项目对许可完整性作出的保证；重复使用时还应检查原页面、文件和上游许可证中的署名与通知要求。

## 已记录的不同许可

项目记录的 Prompt 来源包括 `f/prompts.chat`（`licenseNote` 为“提示词 CC0”）、`dair-ai/Prompt-Engineering-Guide`（MIT）、`binary-husky/gpt_academic`（GPL-3.0）等。这里描述的是现有数据记录，不把这些来源的全部内容概括为相同授权。

绘图来源记录包含 Matplotlib、seaborn、Plotly、Graphviz、多个 R 软件包和图库。部分条款具有具体范围，例如 ComplexHeatmap 与 circlize 的软件包/文档许可不同；Bioicons 的图标具有各自许可；OriginLab 预览图与 MathWorks 图片在记录中保留版权限制。请以 `content/figures.json` 的对应记录和原始来源为准。

**Ai4Scholar Gallery** 的当前记录为“未声明协议，标注来源收录”，并注明站点未公开再分发协议。标注来源收录不构成许可，也没有让其中 Prompt、作品或缩略图获得本项目的非商用许可 授权。复制、修改或再分发这些内容前，应联系权利人或核实明确的授权依据。

## 依赖与独立应用

- `@vercel/blob`：Apache-2.0，保留 npm 包内的原始许可证及通知。
- `pinyin-pro`：MIT，保留 npm 包内的原始许可证及通知。
- 绘图工作台嵌入独立部署的 [basketikun/infinite-canvas](https://github.com/basketikun/infinite-canvas)。其代码、依赖和许可由上游及独立部署管理，本仓库不重新授权该应用。

若来源或权利记录有误，请通过仓库 Issue 联系维护者；涉及安全漏洞或敏感信息时，请改用 [私下披露流程](SECURITY.md)。

<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/hero-dark.svg" />
  <source media="(prefers-color-scheme: light)" srcset=".github/assets/hero.svg" />
  <img alt="USTC-QBank-Studio" src=".github/assets/hero.svg" width="100%" />
</picture>
<p>
  <a href="https://ddndles.github.io/USTC-QBank-Studio/"><img alt="GitHub Pages" src="https://img.shields.io/badge/demo-GitHub%20Pages-3A7BE0?style=flat-square&labelColor=24292F&logo=github&logoColor=white" /></a>
  <a href="LICENSE"><img alt="License MIT" src="https://img.shields.io/badge/license-MIT-3A7BE0?style=flat-square&labelColor=24292F" /></a>
  <a href="package.json"><img alt="TypeScript" src="https://img.shields.io/badge/typescript-React%2019-3A7BE0?style=flat-square&labelColor=24292F&logo=typescript&logoColor=white" /></a>
  <a href="src/db/storage.ts"><img alt="IndexedDB" src="https://img.shields.io/badge/storage-IndexedDB-3A7BE0?style=flat-square&labelColor=24292F" /></a>
</p>
<p>
  <a href="#功能模块">01 功能模块</a> &nbsp;&nbsp;
  <a href="#模板与导出">02 模板与导出</a> &nbsp;&nbsp;
  <a href="#题库同步与离线协议">03 题库同步</a> &nbsp;&nbsp;
  <a href="#仓库结构与本地开发">04 仓库结构</a> &nbsp;&nbsp;
  <a href="#联系方式">05 联系方式</a>
</p>
</div>

面向 [DDNdles/USTC-Question-Bank](https://github.com/DDNdles/USTC-Question-Bank) 的**纯前端、零模型静态工作台**（GitHub Pages 托管），完整迁移 [dsh-study](https://github.com/DDNdles/dsh-study) 的非大模型能力——包括多源题库按需同步、层级知识点检索、条件/蓝图/自选组卷以及原版试卷与讲评 PPT 导出。

- **在线访问**：[ddndles.github.io/USTC-QBank-Studio](https://ddndles.github.io/USTC-QBank-Studio/)

> **数据与版权边界**：本仓库代码采用 [MIT License](LICENSE)，**不内置任何课程真题或题库版权内容**。题库数据由浏览器在运行时按需从公开仓库或用户自建源拉取，经 `SHA-256` 校验后缓存于本机 IndexedDB；题面与解答版权归原权利人所有，详阅 [USTC-Question-Bank/NOTICE.md](https://github.com/DDNdles/USTC-Question-Bank/blob/main/NOTICE.md)。

<img alt="01" src=".github/assets/route-01.svg" width="100%" />

## 功能模块

| 模块 | 入口 | 核心能力 |
| --- | --- | --- |
| **题库浏览** | `#/bank` | 课程、层级知识点树（含递归计题）、题型、答案来源（`official` / `community` / `ai`）、难度、年份与全文检索；自选组卷篮与 8 类题目纠错反馈（直推接口 + 预填 GitLab / GitHub Issue） |
| **试卷工坊** | `#/paper` | 随机种子条件组卷、自定义大题蓝图、候选不足放宽提示；单题调序、改分、红字点评编辑与卷头定制；支持打印 PDF、独立 HTML、XeLaTeX 源码导出与 Overleaf 一键 XeLaTeX 编译 |
| **讲评 PPT** | `#/ppt` | 原版 `review-classic` 16:9 课件实时预览、键盘全屏放映、演讲者备注查看与浏览器原生 `.pptx` 打包下载 |
| **题库源** | `#/sources` | 多源目录刷新、按课程增量同步与 `SHA-256` 校验、CDN / 加速镜像配置、本地 v1.0 目录导入、试卷与配置 JSON 备份迁移 |

<img alt="02" src=".github/assets/route-02.svg" width="100%" />

## 模板与导出

全部排版模板原封不动沿用自 [dsh-study/templates](https://github.com/DDNdles/dsh-study/tree/main/templates)：

| 模板 ID | 格式 | 名称 | 特性说明 |
| --- | --- | --- | --- |
| `ustc-exam` | PDF / HTML / `.tex` | 中科大标准考试卷 | 奇数页左侧密封装订线、动态得分表、黑体解/证明、红字点评；支持「题后附解析」与「原题/答案分开」 |
| `gaokao` | PDF / HTML / `.tex` | 高考标准考试卷 | 卷头绝密标识与注意事项、大题赋分、连续编号；兼容 `exam-zh` 宏包与网页打印 |
| `review-classic` | `.pptx` / 在线放映 | 经典讲评 PPT | 16:9 宽屏，沿用原版素雅底纹（`bg-content.jpg`）、图标与流线型题目进度轨道；`mathjax-full` 矢量公式混排、长解析自动分页与完整 Speaker Notes |

<img alt="03" src=".github/assets/route-03.svg" width="100%" />

## 题库同步与离线协议

遵循题库协议 v1.0，支持三种浏览器端接入方式：

- **GitHub 仓库（默认）**：预置 `DDNdles/USTC-Question-Bank`，自动按 `jsDelivr CDN` → `raw.githubusercontent.com` 回退拉取，可自定义代理前缀
- **HTTP Manifest**：任意支持 CORS 的静态站点或对象存储（含 `manifest.json` 与 `courses/<课号>/`）
- **本地目录导入**：通过浏览器目录选择直接导入符合 v1.0 结构的私有题库及 `assets/` 配图

所有远程课程同步前均通过 Web Crypto API 校验 `meta.json`、`taxonomy.json`、`questions.jsonl` 的 `SHA-256` 摘要，写入 IndexedDB 后可完全离线使用。

<img alt="04" src=".github/assets/route-04.svg" width="100%" />

## 仓库结构与本地开发

```text
USTC-QBank-Studio/
├── .github/
│   ├── assets/                   # README 顶图与路线图分隔 SVG
│   └── workflows/deploy.yml      # GitHub Pages 自动构建部署
├── public/
│   ├── favicon.svg               # 几何 Q 标识
│   ├── images/                   # 主视觉与学科插画
│   └── templates/ppt/review-classic/assets/   # dsh-study 原版 PPT 底纹与图标
└── src/
    ├── components/               # Logo、导航（桌面极简顶栏 + 移动端底部毛玻璃栏）、KaTeX 与弹窗
    ├── context/StudyContext.tsx  # 全局状态与 IndexedDB 桥接
    ├── db/storage.ts             # IndexedDB 持久化与 JSON 备份恢复
    ├── engine/                   # 组卷器、原版 LaTeX/HTML 渲染器、MathJax + PptxGenJS 引擎
    ├── services/                 # 多源 SHA-256 同步、题目纠错反馈
    ├── templates/                # dsh-study 原版 ustc-exam / gaokao / review-classic 模板
    └── views/                    # 总览 / 题库 / 出卷 / PPT / 题库源
```

```bash
git clone https://github.com/DDNdles/USTC-QBank-Studio.git
cd USTC-QBank-Studio
npm install
npm run dev       # 本地开发
npm run build     # TypeScript 检查与生产构建
```

<img alt="05" src=".github/assets/route-05.svg" width="100%" />

## 联系方式

- **GitHub**：[@DDNdles](https://github.com/DDNdles) · [Issues](https://github.com/DDNdles/USTC-QBank-Studio/issues)
- **题库数据仓库**：[DDNdles/USTC-Question-Bank](https://github.com/DDNdles/USTC-Question-Bank) · [USTC GitLab 镜像](https://git.ustc.edu.cn/zzl_stella05/USTC-Question-Bank)
- **桌面插件版（含大模型协作）**：[DDNdles/dsh-study](https://github.com/DDNdles/dsh-study)
- **中科大邮箱**：[zzl_stella05@mail.ustc.edu.cn](mailto:zzl_stella05@mail.ustc.edu.cn)

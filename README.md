# USTC QBank Studio · 科大题卷工坊

面向 [USTC-Question-Bank](https://github.com/DDNdles/USTC-Question-Bank) 的**纯前端、零模型依赖、GitHub Pages 静态托管**学习排版工作台。完整迁移并重构了 `dsh-study` 的全部非大模型核心能力，采用致敬 Typora 官网的极简纸韵排版美学，内置桌面端双栏工坊与移动端浮动毛玻璃底部切换栏。

- **在线体验**：https://ddndles.github.io/USTC-QBank-Studio/
- **默认公开题库源**：[DDNdles/USTC-Question-Bank](https://github.com/DDNdles/USTC-Question-Bank)（不内置任何题目版权内容，浏览器运行时按需拉取并经 SHA-256 校验后离线缓存至 IndexedDB）

## 核心功能（全部零大模型直出）

1. **多源题库同步与离线缓存（IndexedDB + SHA-256）**
   - 内置 `DDNdles/USTC-Question-Bank`（自动双线路回退：`jsDelivr CDN` → `GitHub Raw`，支持自定义加速镜像）。
   - 支持按课程按需同步、Web Crypto `SHA-256` 完整性校验、接入任意 v1.0 协议远程 HTTP/GitHub 题库源或导入本地题库目录。
   - 支持一键导出/恢复试卷与错题本 JSON 备份。

2. **题库检索、层级知识点树与自选组卷篮**
   - 按课程、层级知识点树（含递归计题）、题型、答案来源（官方标答 / 社区详解 / AI 推导）、难度区间、真题年份与中文/公式关键词实时检索。
   - 内置 KaTeX 公式渲染与题图展示，支持一键加入自选篮、记入错题本、或提交 8 类题目纠错反馈（直推反馈接口 + 自动预填 USTC GitLab / GitHub Issue）。

3. **智能组卷与标准考试卷排版工坊**
   - 支持条件随机抽题（可设随机种子复现）、自定义大题蓝图、自选篮组卷、错题巩固组卷及候选不足放宽建议。
   - 支持拖拽/上下调序、单题分值修改、红字易错点评（`comment_md`）编辑与卷头元信息定制。
   - 双模板双模式实时预览与导出：
     - **中科大标准考试卷（`ustc-exam`）**：奇数页左侧密封装订线、动态得分表、黑体解/证明、红字点评块。
     - **高考标准考试卷（`gaokao`）**：绝密标识、注意事项、连续题号。
     - 均支持 **「题目后附解析」** 与 **「原题与答案分开」**，可一键**打印 / 另存高清 PDF**、下载**离线独立 `.html`** 或下载完整 **XeLaTeX `.tex` 源码**。

4. **经典 16:9 讲评 PPTX 制作与在线放映厅**
   - 原版保留 `dsh-study` 的 `review-classic` 模板（`template.json`、`bg-content.jpg`、`icon-question.png`、`icon-solution.png` 与流线型题目进度轨道），纯浏览器集成 `mathjax-full` 矢量公式混排 + `pptxgenjs` 导出 `.pptx`，支持长解析自动分页、完整演讲者备注（Speaker Notes）与全屏键盘放映模式。

5. **个人错题本与 SM-2 间隔重复复习**
   - 完整实现 SM-2 记忆调度算法（重来 / 困难 / 良好 / 轻松掌握），内置今日待复习闪卡流、手工 Markdown+LaTeX 录题器，以及一键生成错题巩固卷（原题重做 + 同知识点举一反三）。

## 本地开发

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

## 许可协议

本项目源码采用 [MIT License](LICENSE)。题库数据版权归原题库作者及相应出题方所有，详见 [USTC-Question-Bank](https://github.com/DDNdles/USTC-Question-Bank)。

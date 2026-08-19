<h1 align="center">Web Clipper（Notion PAT 修复版）</h1>
<p align="center">
  <a href="https://github.com/webclipper/web-clipper">
    <img src="https://img.shields.io/badge/Fork%20from-webclipper%2Fweb--clipper-v1.42.0-blue?style=flat-square" alt="Fork from webclipper/web-clipper v1.42.0">
  </a>
  <a href="https://github.com/zq7969/web-clipper-notion-pat-fixed/releases">
    <img src="https://img.shields.io/github/v/release/zq7969/web-clipper-notion-pat-fixed?style=flat-square" alt="Latest Release">
  </a>
  <img src="https://img.shields.io/badge/license-GPL--2.0--or--later-blue?style=flat-square" alt="License">
</p>

> **这是 [webclipper/web-clipper](https://github.com/webclipper/web-clipper) v1.42.0 的衍生（Fork）版本**。原版使用的 Notion 私有 v3 API（Cookie + 注入模式）已被官方安全策略收紧导致**所有剪辑 Notion 的操作报 401 授权失败**，且原项目已有 10+ 个月未更新。本版本将 Notion 模块完全迁移到 **Notion 官方 v1 REST API（2026-03-11 版本）+ Personal Access Token (PAT)** 认证方式，以提供长期稳定的 Notion 剪辑能力。
>
> 保留原项目所有其它后端服务（Joplin / Yuque / Obsidian / Bear / GitHub / OneNote 等）完全不变；仅 Notion 相关代码重写。
>
> 协议：**与原仓库保持一致 — GPL-2.0-or-later**（见仓库内 [LICENSE](LICENSE)）

---

## ✨ 这个 Fork 修改了什么

| 项 | 原版（v1.42.0，已失效） | 本修复版 |
| --- | --- | --- |
| **Notion 接口** | 私有 v3 API（Cookie + declarativeNetRequest 注入请求头） | ✅ **Notion 官方 v1 REST API（`2026-03-11` 版本）** |
| **鉴权方式** | 手动在扩展后台抓网页 Cookie（极不稳定，6-12 个月必失效） | ✅ **Personal Access Token (PAT)**（`ntn_` 开头，官方长期标准） |
| **Notion 搜索兼容** | 仅支持 `page` / `database`，新版数据库搜不到 | ✅ 兼容 Notion 2026-03-11 新增的 **`data_source`** 对象类型（Database 接口重构） |
| **空列表错误提示** | 下拉直接显示「暂无数据」，用户不知道为什么 | ✅ PAT 校验阶段**直接抛出中文详细错误**，一步一步教你做「Share 页面给 Integration」 |
| **数据库写必填字段** | 未处理 `properties.title` → 写入时 400 Validation Error | ✅ database / data_source 作为 parent 时**自动兜底 title 字段** |
| **核心端点** | - | `GET /v1/users/me` · `POST /v1/search`（最多 500 条分页） · `POST /v1/pages`（利用 API 原生 Markdown 字段，不拼接 blocks） |

---

## 🚀 Chrome / Edge 安装 + Notion 使用 4 步

### 1️⃣ 下载扩展包并加载
1. 打开本仓库的 [Releases 页面](https://github.com/zq7969/web-clipper-notion-pat-fixed/releases)，下载**最新版本的 `web-clipper-chrome.zip`**
2. 打开 `chrome://extensions`（Edge 是 `edge://extensions`）→ 右上角开启 **开发者模式**
3. 解压 zip → 点「**加载已解压的扩展程序**」→ 选择解压后的文件夹（扩展加载完成）

### 2️⃣ 生成你自己的 Notion PAT（Personal Access Token）
1. 打开：https://www.notion.so/my-integrations
2. 点右上角 **+ New integration**（或 + 新建集成）
3. 名字随便填（比如 `My Web Clipper`）→ **Integration type 选 Internal** → 点 **Submit** / 提交
4. 在 **Secrets** 那一栏点 **Show** → 复制 `ntn_` 开头的一长串 Token（**只显示一次，赶紧保存**）

### 3️⃣ ⚠️ 必须做：把目标页面/数据库 Share 给 Integration（99%「暂无数据」的原因）
Notion 官方安全强制设计：**PAT 默认没有任何页面访问权限，必须手动 Share**。
1. 打开 Notion 里你想要剪辑进去的**目标页面或数据库**
2. 右上角点 **···** 三个点 → 选 **Add connections**（中文：连接 / 添加关联）
3. 搜索你刚才第 2 步创建的 Integration 名字（比如 `My Web Clipper`）→ 选中 → 点 **Confirm**（确认）
4. 重复这一步，把你常用的所有 Notion 目标文件夹/数据库都 Share 一次

### 4️⃣ 在 Web Clipper 里填 PAT 并校验
1. 打开任意网页 → 点右上角 Web Clipper 图标 → 点 **添加账户** → 选 Notion
2. 在 Personal Access Token 输入框里粘贴你第 2 步复制的 `ntn_` 开头的 Token
3. 点 **校验**：
   - 如果提示「知识库为空」→ 回到第 3 步，把你想选的页面 Share 给 Integration
   - 如果校验通过 → **默认知识库**下拉就有内容了 → 选好 → 点保存
4. 完成！现在你可以在任何网页点 Web Clipper → 选 Notion → 直接剪辑内容了 🎉

---

## 🔨 本地构建（如果你想自己改代码）

```bash
# 环境要求：Node.js >= 16（推荐 18 LTS），pnpm 8（package.json 里有 packageManager 字段）
git clone https://github.com/zq7969/web-clipper-notion-pat-fixed.git
cd web-clipper-notion-pat-fixed

pnpm install          # 安装依赖
pnpm run release      # 构建 MV3 release 包
# 产物位置：release/web-clipper-chrome.zip

pnpm run dev          # 开发模式（watch 热更新，产物 dist/chrome，直接加载 dist 文件夹即可）
pnpm run test         # 跑单元测试
```

---

## 🔄 同步官方原仓库更新

本仓库每天 UTC 0 点（北京时间早上 8 点）会自动检查官方 `webclipper/web-clipper` 是否发布了新 Release tag；如果有，会自动 merge 官方更新 → 跑测试 → 重新构建 → 发新版 Release（tag 格式 `官方tag-pat-fixed`，比如 `v1.43.0-pat-fixed`）。

如果合并遇到冲突，会直接失败并通过 GitHub 邮件通知你，你需要手动执行：
```bash
git fetch upstream
git merge upstream/<新tag名>
# 解决冲突 → pnpm run release → 推送到 GitHub → 手动发 Release
```

---

## 💬 反馈 / 问题
- **关于本 Fork（Notion 修复相关）**：请在 [本仓库的 Issues](https://github.com/zq7969/web-clipper-notion-pat-fixed/issues) 里提
- **关于原 Web Clipper 其它功能**：请去官方仓库 [webclipper/web-clipper/issues](https://github.com/webclipper/web-clipper/issues)

---
---
---

<h1 align="center">Web Clipper</h1>
<p align="center">
    <a href="https://github.com/webclipper/web-clipper/actions">
      <img src="https://github.com/webclipper/web-clipper/workflows/CI%20Test/badge.svg" alt="CI Test Status">
    </a>
     <a href="https://github.com/webclipper/web-clipper/actions">
      <img src="https://github.com/webclipper/web-clipper/workflows/Release resource/badge.svg" alt="Release resource status">
    </a>
    <a href="https://codecov.io/gh/webclipper/web-clipper">
      <img src="https://img.shields.io/codecov/c/github/webclipper/web-clipper/master.svg?style=flat-square" alt="Codecov">
    </a>
</p>

You can use Web Clipper to save anything on the web to anywhere.

<img src="https://clipper.website/static/image/screenshot.png">

### Support Site

- [FlowUs](https://flowus.cn/)
- [Obsidian](https://obsidian.md/)
- [Github](https://github.com)
- [Yuque](https://www.yuque.com)
- [Buildin.AI](https://buildin.ai/product)
- [Notion](https://www.notion.so/)
- [Youdao](https://note.youdao.com/)
- [OneNote](https://www.onenote.com/)
- [Bear](https://bear.app)
- [Joplin](https://joplinapp.org/)
- [Server Chan](http://sc.ftqq.com/3.version)
- [dida365](https://dida365.com/)
- [baklib](https://www.baklib-free.com/)
- [wolai](https://www.wolai.com/)
- [Leanote](https://github.com/leanote/leanote)
- [Flomo](https://flomoapp.com/)
- [Siyuan](https://b3log.org/siyuan)
- [Ulysses](https://ulysses.app/)
- [Confluence](https://www.atlassian.com/software/confluence)

### Install

- [Chrome](https://chrome.google.com/webstore/detail/web-clipper/mhfbofiokmppgdliakminbgdgcmbhbac)

- [Edge](https://microsoftedge.microsoft.com/addons/detail/opejamnnohhbjflpbhnmdlknhjkfhfdp)

ps: Because the review takes a week, the version will fall behind.

#### From Github

1. Download the webclipper.zip from [release page](https://github.com/webclipper/web-clipper/releases)
2. Go to **chrome://extensions/** and check the box for **Developer mode** in the top right.
3. Locate the ZIP file on your computer and unzip it.
4. Go back to the chrome://extensions/ page and click the **Load unpacked extension** button and select the unzipped folder for your extension to install it.

### Develop

```bash
$ git clone https://github.com/webclipper/web-clipper.git
$ cd web-clipper
$ npm i
$ npm run dev
```

- You should load the 'dist/chrome' folder in Chrome.

- You should load the 'dist/manifest.json' folder in Firefox.

### Test

```bash
$ npm run test
```

### Feedback

| Type     | Link                                                 |
| -------- | ---------------------------------------------------- |
| Telegram | [Link](https://t.me/joinchat/HoVttRRUIA6aXASixzoqAw) |

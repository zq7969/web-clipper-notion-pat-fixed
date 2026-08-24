<h1 align="center">Web Clipper（Notion PAT 修复版）</h1>

<p align="center">
  <strong>中文</strong> | <a href="README.md">English</a>
</p>

<p align="center">
  <a href="https://github.com/webclipper/web-clipper">
    <img src="https://img.shields.io/badge/Fork%20from-webclipper%2Fweb--clipper-v1.42.0-blue?style=flat-square" alt="Fork from webclipper/web-clipper v1.42.0">
  </a>
  <a href="https://github.com/zq7969/web-clipper-notion-pat-fixed/releases">
    <img src="https://img.shields.io/github/v/release/zq7969/web-clipper-notion-pat-fixed?style=flat-square" alt="Latest Release">
  </a>
  <img src="https://img.shields.io/badge/license-GPL--2.0--or--later-blue?style=flat-square" alt="License">
</p>

## 这个版本修复了什么

原版 `webclipper/web-clipper` 使用的是 Notion 私有 v3 API（Cookie + 注入请求头），Notion 收紧安全策略后，**所有剪辑 Notion 的操作都会报 401 授权失败**，且原项目 10+ 个月没更新了。

本 fork **只改了 Notion 相关代码**，其它后端（Joplin / 语雀 / Obsidian / Bear / GitHub / OneNote …）**完全保留原版**，该怎么用还怎么用。

| 原版 v1.42.0（Notion 已失效） | 本修复版 |
| --- | --- |
| 私有 v3 Cookie API（必报 401） | ✅ Notion 官方 v1 REST API + Personal Access Token |
| 手动去开发者工具抓 Cookie（极不稳定） | ✅ 标准 PAT 鉴权，`ntn_` 开头 Token |
| 新版 Notion `data_source` 数据库搜不到 | ✅ 兼容 `page` / `database` / `data_source` 三类对象 |
| 下拉为空时没有任何有用提示 | ✅ 给出明确的引导性错误信息 |
| 写入 Database 时缺 `properties.title` 报 400 | ✅ 自动处理字段，不再报错 |

**开源协议**：**GPL-2.0-or-later**。原始代码 © 2020 DiamondYuan，完整协议文本见仓库内 [LICENSE](LICENSE)。

---

## 快速安装（Chrome / Edge）

> ⚠️ **不要从 Chrome/Edge 应用商店安装。** 商店里的是原版 v1.42.0，Notion 剪辑依然会 401。

**第 1 步 — 安装扩展**
1. 打开本仓库的 [Releases 页面](https://github.com/zq7969/web-clipper-notion-pat-fixed/releases)，下载最新的 `web-clipper-chrome.zip`。
2. 打开 `chrome://extensions`（Edge 用 `edge://extensions`）→ 右上角打开 **开发者模式**。
3. 解压 zip → 点 **加载已解压的扩展程序** → 选解压后的文件夹。

**第 2 步 — 生成 Notion PAT（Personal Access Token）**
1. 打开 <https://www.notion.so/my-integrations> → 右上角 **+ New integration**（新建集成，类型 选 Internal）→ 点 提交/Submit。
2. 在 **Secrets** 区域点 **Show** → 复制 `ntn_` 开头的 Token（只显示一次，记得保存）。

**第 3 步 — 在 Web Clipper 里校验并保存**
1. 打开任意网页 → 点右上角 Web Clipper 图标 → **添加账户** → 选择 **Notion**。
2. 粘贴你刚才复制的 `ntn_` Token → 点 **校验**。
   - 提示「知识库为空」？→ 检查集成的权限配置，确保目标页面对集成可见后重新校验即可。
   - 校验通过 → **默认知识库**下拉里就有内容了 → 选一个 → 点 **保存**。
3. 搞定 🎉 以后任何网页都可以直接点 Web Clipper → 选 Notion → 剪辑。

---

## 本地构建（想自己改代码时）

```bash
# 环境：Node.js >= 16，pnpm 8（package.json 里已锁定）
git clone https://github.com/zq7969/web-clipper-notion-pat-fixed.git
cd web-clipper-notion-pat-fixed
pnpm install
pnpm run release   # 产物：release/web-clipper-chrome.zip
pnpm run dev       # 开发模式，热更新到 dist/chrome
pnpm run test      # 跑 vitest 单测
```

## 反馈

- **Notion 修复 / 本 fork 相关问题** → [本仓库 Issues](https://github.com/zq7969/web-clipper-notion-pat-fixed/issues)
- **其它后端或原版项目问题** → [webclipper/web-clipper/issues](https://github.com/webclipper/web-clipper/issues)

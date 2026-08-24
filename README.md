<h1 align="center">Web Clipper (Notion PAT Fixed)</h1>

<p align="center">
  <a href="README.zh-CN.md">中文</a> | <strong>English</strong>
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

## What this fork fixes

The original webclipper/web-clipper used a private Notion v3 cookie-injection API that **started returning 401 for all Notion clips** after Notion tightened security. The upstream repo has been unmaintained for 10+ months.

This fork **only changes the Notion backend** — everything else (Joplin / Yuque / Obsidian / Bear / GitHub / OneNote …) is **untouched**.

| Broken in original (v1.42.0) | This fork (fixed) |
| --- | --- |
| Private v3 cookie API (fails with 401) | ✅ Official Notion v1 REST API + Personal Access Token |
| Cookie extraction from dev tools (unstable) | ✅ PAT auth using standard `ntn_` tokens |
| New-style Notion databases (`data_source`) invisible | ✅ Supports `page` / `database` / `data_source` |
| No useful "Repository list is empty" hints | ✅ Clear error messages that guide the user |
| `properties.title` missing on DB saves (400 error) | ✅ Automatically handled |

**License**: **GPL-2.0-or-later**. Original code © 2020 DiamondYuan. See [LICENSE](LICENSE) for the full text.

---

## Quick install (Chrome / Edge)

> ⚠️ **Do NOT use the web-store versions.** They ship the original broken v1.42.0 code that still gives 401 with Notion.

**Step 1 — Install the extension**
1. Download the latest `web-clipper-chrome.zip` from the [Releases page](https://github.com/zq7969/web-clipper-notion-pat-fixed/releases).
2. Open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode** (top-right).
3. Unzip, then click **Load unpacked** and pick the unzipped folder.

**Step 2 — Get a Notion Personal Access Token**
1. Open <https://www.notion.so/my-integrations> → **+ New integration** (type: Internal) → Submit.
2. Under **Secrets** click **Show** and copy the `ntn_…` token (save it — it's shown only once).

**Step 3 — Verify in Web Clipper**
1. Click the Web Clipper toolbar icon → **Add account** → choose **Notion**.
2. Paste your `ntn_…` token → click **Verify**.
   - "Repository list is empty"? → make sure your integration has the right permissions and the target pages are shared/visible to it, then re-verify.
   - Verification OK → the **Default repository** dropdown populates. Pick one → **Save**.
3. Done 🎉 Clip any page with Notion.

---

## Build from source

```bash
# Node.js >= 16, pnpm 8 (packageManager pinned)
git clone https://github.com/zq7969/web-clipper-notion-pat-fixed.git
cd web-clipper-notion-pat-fixed
pnpm install
pnpm run release   # -> release/web-clipper-chrome.zip
pnpm run dev       # dev watch mode (HMR -> dist/chrome)
pnpm run test      # vitest
```

## Feedback

- **Notion / this fork** → [Issues in this repository](https://github.com/zq7969/web-clipper-notion-pat-fixed/issues)
- **Other backends / original project** → [webclipper/web-clipper/issues](https://github.com/webclipper/web-clipper/issues)

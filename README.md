# dsh-prompt-assistant

Prompt assistant for the dsh web GUI: a settings section (tab) named
**提示词** in the settings panel. Manage a prompt library — add many prompts,
edit / delete, one-click copy, search, and organize prompts by user-defined
categories.

## Data location: a Markdown file in the USER data directory

Prompts live in a real Markdown file in the **user data directory** (never
inside the installed package — npm-installed packages sit in a read-only /
ephemeral pnpm store, so user data must not live there):

```
$DSH_HOME/dsh-prompt-assistant/prompts.md     (default: ~/.dsh/dsh-prompt-assistant/prompts.md)
```

```md
## 分类名

### 标题

提示词内容...
```

- The **host half** (`lib/index.js`) owns the file: it parses/serializes
  through `lib/prompts-md.js` and exposes two routes for the browser half:
  - `GET /api/dsh-prompt-assistant/prompts` → `{ ok, prompts, md }`
  - `PUT /api/dsh-prompt-assistant/prompts` (body `{ prompts }`) → writes the file
- The **browser half** is a client: it never touches the file directly —
  every add / edit / delete pushes the new list through the PUT route.
- **The package's own `prompts.md` is only a seed**: on the very first run
  (no user file yet) it is copied to the user directory once; all later
  reads/writes go to the user file, so upgrading or reinstalling the plugin
  never loses user data (and works on machines whose package dir is
  read-only).
- **You can edit the file by hand** (headings `##` / `###` are the format;
  single-line `<!-- comments -->` are ignored); changes appear after
  refreshing the GUI (or on the next page load).
- `localStorage` (`dsh.prompt-assistant.v1`) is only a cache: it seeds the
  UI before the first fetch, backs the UI when the file is unreachable
  (header badge shows 「💾 本地缓存」 then), and is migrated into the file on
  first load when the file is empty.

## Layout

- `cordis.patch.yml` — bundle patch: inserts the `prompt-assistant` roster row.
- `lib/index.js` — host half: `webServer` routes serving the user data file.
- `lib/prompts-md.js` — Markdown parse/serialize (the format's single home).
- `lib/client.js` — browser half: settings section + prompt manager UI.
- `prompts.md` — **seed** file inside the package (migrated on first run).
- `.smoke.mjs` — Node smoke tests (`node .smoke.mjs`): md round-trips, client
  contract, host route registration.

## Usage

1. Install (see below).
2. Restart `dsh web`, open **Settings → 提示词**.
3. **Use**: search filters title + content（按 `/` 聚焦搜索，`Esc` 清空）;
   click a card's title or content to **copy it** (toast feedback, button
   flashes ✓); long prompts expand/collapse (展开全文/收起); category pills
   filter by group with counts.
4. **Manage**: `＋ 新建提示词` opens a **modal dialog**（Esc / 点遮罩 /
   取消关闭，**Ctrl+Enter** 保存）; `✎ 分类管理` opens a **category
   management modal** — add new categories, rename any category (click
   「N 条 · ✎」), and delete (two-step confirm; deleting a non-empty category
   removes its prompts too, with the count stated); empty categories show as
   dashed chips on the page (click one to add the first prompt to that
   category; empty categories persist in localStorage since the md file
   cannot represent a category without prompts); `编辑` turns a card into an
   inline edit form; `删除` is two-step confirm; `↑`/`↓` reorder a prompt
   within its category (persisted to prompts.md).
5. The header shows a compact storage status dot（绿色=已保存到文件，黄
   色=本地缓存；悬停显示完整路径/说明）and a per-save 「正在保存…/已保存」
   indicator.

The UI follows the dsh design tokens (`--dsw-alias-*` / `--dsw-font-family`),
so it adapts to the active skin automatically.

## Install

```sh
dsh plugin --profile web add link:/root/code/dsh-prompt-assistant
```

The command runs `pnpm add` in the profile and appends the package to
`dsh.profile.bundles` because it declares `dsh.bundle`. Restart `dsh web`,
open Settings — the **提示词** tab appears next to **Hello**.

Uninstall: `dsh plugin --profile web remove dsh-prompt-assistant` (drops the
bundle layer; the prompts.md file stays on disk), then restart.

## How it works

The settings domain declares the `settings.section` slot: one settings page
per registered entry (`id`, `order`, `label`). The web shell kernel provides
`react` / `@deepseek-ai/dsh-client-runtime` to client bundles, and the host
`webServer` service carries HTTP routes (`ctx.webServer.register` inside a
`ctx.effect` callback — the effect runs now, its returned function is the
unload cleanup). Everything is zero-build: both halves are hand-written JS in
the kernel formats.

Prompt IDs are derived from (category + title + content), so hand-editing the
file never breaks React keys. Known limitation: content lines that start with
`## ` or `### ` would be read as headings — keep them inside plain bullets.
# dsh-notepad

A **frequently-used snippet library** for the DeepSeek Harness Web GUI (`dsh web`): prompts, templates, canned phrases, code snippets, quick notes — keep them all in one place and **grab one with a click right next to the input box**.

## What problem does it solve?

Re-composing a prompt from scratch for every weekly report, email polish, code review, translation or meeting is a chore — and the fragments you reuse all the time are scattered across notes and chat history. Save them once: **next to the chat input, click the icon, browse by category or search, and one click puts the snippet into your draft.**

## Features

- **Quick access at the input box** — a 📋 icon button on the chat composer toolbar pops up the snippet panel: filter by category, search, click to append into the draft (keeps existing text), or ⧉ to copy
- **Category management** — organize by scenario (code / writing / translation / thinking / meetings...), with add, rename, delete and reorder
- **Centralized management** — the「随身笔记」settings page manages everything: add/edit/delete, reorder, search (`/` focuses, `Esc` clears)
- **One-click copy** — click a card's title or content to copy it to the clipboard
- **Your data, your file** — notes live in a local Markdown file (`~/.dsh/dsh-notepad/prompts.md`), editable by hand, easy to back up; uninstalling never deletes your data
- **Restore defaults** — one click restores the built-in seed notes (the current file is auto-backed up as `prompts.backup-*.md` first)

## Install

```sh
dsh plugin --profile web add github:chenchen4396/dsh-notepad
```

- **Pin a commit** (recommended for reproducibility): append `#<commit-sha>`
- **Local development / offline**: clone the repo, then `dsh plugin --profile web add link:/path/to/dsh-notepad`
- **Restricted networks**: use the SSH URL `git+ssh://git@github.com/chenchen4396/dsh-notepad.git`

After installing, **restart `dsh web`**: the 📋 icon appears next to the input box and the「随身笔记」page appears in Settings.

Uninstall: `dsh plugin --profile web remove dsh-notepad` (your notes stay on disk — reinstalling brings them back).

## Data file

Notes are stored in `prompts.md` under the user data directory (default `~/.dsh/dsh-notepad/prompts.md`), in a Markdown format of `## category` / `### title` / content — safe to hand-edit; changes appear after refreshing the page. Data is migrated automatically when upgrading from the old name (dsh-prompt-assistant).

> Formerly dsh-prompt-assistant (提示词助手). Old install commands keep working (GitHub redirects the repository), and the old data directory is migrated on first launch.
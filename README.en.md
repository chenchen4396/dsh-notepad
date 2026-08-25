# dsh-notepad

A **frequently-used snippet library** for the DeepSeek Harness Web GUI (`dsh web`): prompts, templates, canned phrases, code snippets, quick notes — keep them all in one place and **grab one with a click right next to the input box**.

## What problem does it solve?

Re-composing a prompt from scratch for every weekly report, email polish, code review, translation or meeting is a chore — and the fragments you reuse all the time are scattered across notes and chat history. Save them once: **next to the chat input, click the icon, browse by category or search, and one click puts the snippet into your draft.**

![Open the note library right next to the chat input](docs/screenshots/image.png)

![Manage all notes in the settings page](docs/screenshots/image-1.png)

## Features

- **Quick access at the input box** — a 📋 icon button on the chat composer toolbar pops up the snippet panel: filter by category, search, click to append into the draft (keeps existing text), or ⧉ to copy
- **Category management** — organize by scenario (code / writing / translation / thinking / meetings...), with add, rename, delete and reorder
- **Centralized management** — the「随身笔记」settings page manages everything: add/edit/delete, reorder, search (`/` focuses, `Esc` clears)
- **One-click copy** — click a card's title or content to copy it to the clipboard
- **Import other people's notes** — 📥: pick a shared note file; two formats are supported:
  - **dsh-notepad JSON** (this plugin's export format — `{"version":1,"notes":[…]}` or a bare array), compatible with similar exports from other tools
  - **Any plain text / Markdown note file** (imported as a single note, the file name becomes its title)
  - A preview dialog lets you choose **merge (recommended, duplicates skipped)** or **replace everything**
- **Export to share** — 📤: download the whole library as a JSON file for backup, migration, or handing to someone else to import
- **Your data, your file** — notes live in a local JSON file (`~/.dsh/dsh-notepad/notes.json`), clean structure, easy to back up; uninstalling never deletes your data
- **Restore defaults** — one click restores the built-in seed notes (the current file is auto-backed up as `notes.json.backup-*` first)

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

Notes are stored in `notes.json` under the user data directory (default `~/.dsh/dsh-notepad/notes.json`):

```json
{
  "version": 1,
  "notes": [
    { "id": "63609328", "category": "代码", "title": "代码解释", "content": "…", "updatedAt": 1712345678901 }
  ]
}
```

The `version` field is reserved for future format migrations; unknown keys are ignored on read. Safe to hand-edit; changes appear after refreshing the page. This single JSON file is the entire data format — first launch writes the built-in default notes into it automatically.
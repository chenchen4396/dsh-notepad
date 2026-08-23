# dsh-prompt-assistant

A prompt management plugin for the DeepSeek Harness Web GUI (`dsh web`): keep your frequently-used prompts in one place and **manage them end-to-end — save, search, copy, organize** — ready whenever you need them.

## What problem does it solve?

Writing weekly reports, polishing emails, code review, translation, meeting minutes... re-composing a prompt from scratch every time is a chore. Save your go-to prompts once, then copy one with a single click into the chat — no more digging through chat history or notes, no more retyping.

## Features

- **Centralized management** — a new「提示词」(Prompts) settings page inside the dsh web settings panel holds all your prompts in one place
- **One-click copy** — click a card's title or content to copy it to the clipboard, ready to paste into a conversation
- **Custom categories** — organize prompts by scenario (code / writing / translation / thinking / meetings / agent collaboration...), with add, rename, delete and reorder
- **Quick search** — press `/` to focus search (matches title + content), `Esc` to clear; category pills filter in one click
- **Your data, your file** — prompts live in a local Markdown file in the user data directory, editable by hand and easy to back up; uninstalling the plugin never deletes your data

## Install

```sh
dsh plugin --profile web add github:chenchen4396/dsh-prompt-assistant
```

- **Pin a commit** (recommended for reproducibility): append `#<commit-sha>`, e.g.
  `dsh plugin --profile web add github:chenchen4396/dsh-prompt-assistant#12d703e`
- **Local development / offline**: clone the repo, then `dsh plugin --profile web add link:/path/to/dsh-prompt-assistant`
- **Restricted networks**: use the SSH URL `git+ssh://git@github.com/chenchen4396/dsh-prompt-assistant.git`

After installing, **restart `dsh web`** and open **Settings → 提示词 (Prompts)**.

Uninstall: `dsh plugin --profile web remove dsh-prompt-assistant` (your prompts stay on disk — reinstalling brings them back).

## Data file

Prompts are stored in `prompts.md` under the user data directory (default `~/.dsh/dsh-prompt-assistant/prompts.md`), in a Markdown format of `## category` / `### title` / content — safe to hand-edit; changes appear after refreshing the page. A「恢复默认值」(Restore defaults) button in the UI resets the library to the built-in seed prompts (the current file is automatically backed up as `prompts.backup-*.md` first).
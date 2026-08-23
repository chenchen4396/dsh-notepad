# dsh-notepad · 随身笔记

为 DeepSeek Harness Web GUI（`dsh web`）打造的**常用片段库**：提示词、模板、话术、代码片段、备忘……把高频常用的东西集中记在一个地方，**在输入框旁一键取用**。

## 这个插件解决什么

写周报、润色邮件、代码审查、翻译、会议纪要……每次都要重新组织 prompt 很麻烦；常用的文本片段散落在备忘录、聊天记录里，用的时候找不到。把高频内容提前存好：**聊天时点一下输入框旁的图标，弹出随身笔记，搜索分类、点击即放入输入框**。

## 主要功能

- **输入框快捷入口** — 聊天输入框旁一个 📋 图标按钮，点击弹出笔记面板：按分类筛选、搜索、点击即放入输入框（保留已有草稿），⧉ 一键复制
- **分类管理** — 按使用场景分门别类（代码 / 写作 / 翻译 / 思考 / 会议…），支持新增、重命名、删除与排序
- **集中管理** — 设置面板「随身笔记」页统一管理所有笔记：增删改、排序、搜索（`/` 聚焦、`Esc` 清空）
- **一键复制** — 点击卡片标题或内容即复制进剪贴板
- **数据归属你** — 笔记保存在本地用户目录的 Markdown 文件（`~/.dsh/dsh-notepad/prompts.md`），可手动编辑、随时备份；卸载插件不丢数据
- **恢复默认值** — 一键还原为插件内置默认笔记（原数据自动备份为 `prompts.backup-*.md`）

## 安装

```sh
dsh plugin --profile web add github:chenchen4396/dsh-notepad
```

- **锁定版本**（推荐，保证可复现）：追加 `#<commit-sha>`
- **本地开发 / 离线环境**：clone 后用 `dsh plugin --profile web add link:/path/to/dsh-notepad`
- **网络受限的环境**：可用 SSH URL `git+ssh://git@github.com/chenchen4396/dsh-notepad.git`

安装完成后**重启 `dsh web`**：输入框旁出现 📋 图标按钮；设置面板出现「随身笔记」页。

卸载：`dsh plugin --profile web remove dsh-notepad`（笔记数据保留在磁盘，重装不丢）。

## 数据文件

笔记存于用户目录下的 `prompts.md`（默认 `~/.dsh/dsh-notepad/prompts.md`），格式为 `## 分类` / `### 标题` / 内容 的 Markdown，可以直接手动编辑，刷新页面后生效。从旧版（dsh-prompt-assistant）升级时数据会自动迁移。

> 曾用名：dsh-prompt-assistant（提示词助手）。改名后旧安装命令仍可访问（GitHub 仓库重定向），旧数据目录会在首次启动时自动迁移。
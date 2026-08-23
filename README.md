# dsh-prompt-assistant · 提示词助手

为 DeepSeek Harness Web GUI（`dsh web`）打造的提示词管理插件：把日常高频使用的提示词集中到一个地方，**一站式完成保存、搜索、复制与管理**，随用随取。

## 这个插件解决什么

写周报、润色邮件、代码审查、翻译、会议纪要……这些高频任务每次都现场组织 prompt 太麻烦。把常用提示词提前保存好，用时点一下就能复制进对话，不用再翻聊天记录或备忘录，也不用重复打字。

## 主要功能

- **集中管理** — 在 dsh web 设置面板新增「提示词」页，所有高频提示词统一管理
- **一键复制** — 点击卡片标题或内容即可复制进剪贴板，直接粘贴到对话开用
- **自定义分类** — 按使用场景分门别类（代码 / 写作 / 翻译 / 思考 / 会议 / Agent 协作…），支持新增、重命名、删除与排序
- **快速查找** — 按 `/` 聚焦搜索（标题 + 内容），`Esc` 清空；分类胶囊一键筛选
- **数据归属你** — 提示词保存在本地用户目录的 Markdown 文件中，可手动编辑、随时备份；卸载插件不会丢失数据

## 安装

```sh
dsh plugin --profile web add github:chenchen4396/dsh-prompt-assistant
```

- **锁定版本**（推荐，保证可复现）：追加 `#<commit-sha>`，如
  `dsh plugin --profile web add github:chenchen4396/dsh-prompt-assistant#12d703e`
- **本地开发 / 离线环境**：clone 后用 `dsh plugin --profile web add link:/path/to/dsh-prompt-assistant`
- **网络受限的环境**：可用 SSH URL `git+ssh://git@github.com/chenchen4396/dsh-prompt-assistant.git`

安装完成后**重启 `dsh web`**，在 **设置 → 提示词** 中即可使用。

卸载：`dsh plugin --profile web remove dsh-prompt-assistant`（提示词数据保留在磁盘，重装不丢）。

## 数据文件

提示词存于用户目录下的 `prompts.md`（默认 `~/.dsh/dsh-prompt-assistant/prompts.md`），格式为 `## 分类` / `### 标题` / 内容 的 Markdown，可以直接手动编辑，刷新页面后生效。页面还提供「恢复默认值」按钮，可一键还原为插件内置的默认提示词（原数据会自动备份为 `prompts.backup-*.md`）。
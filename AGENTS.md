# ResearchCodes 仓库规则

本文件适用于整个 `ResearchCodes` 仓库；`docs/tutorials/` 下的所有教程遵循同一套约定。本文件只写规则，不写入任何敏感内容。

## AI 过程文档只保留在本机

- 与 AI 的对话原文、模型给出的审查/评审意见、提示词、思维过程与计划摘要、任务交接、TODO 与草稿、调试记录等中间材料，统一放在仓库根目录的 `local-notes/`。
- `local-notes/` 已在 `.gitignore` 中整体忽略，只在本机存在，不得提交、不得推送。
- 不要把这些材料放在仓库根目录、`docs/`、`src/`、`tests/` 或任何教程目录，即使只是临时文件；可以按项目分子目录，例如 `local-notes/compton-telescope-visualization/`。
- 源码中由 AI 工具生成的标识、包装或注释不属于过程文档，可以保留；需要隐藏的只是讨论、审查和交接过程本身。

## 可以提交的成品文档

- README、CHANGELOG、LICENSE，以及被 README 引用、确认属于交付物的使用说明/教程/物理说明。
- 无法判断一份文档是“成品”还是“过程材料”时，先问仓库维护者，默认按过程材料处理。

## 提交与推送前自检

- `git status --ignored` 确认 `local-notes/` 处于 ignored 状态。
- `git ls-files` 确认没有 `local-notes/` 下的文件、AI 对话原文、本地绝对路径（`/Users/...`、`C:\Users\...`、`/home/...`）或其他隐私信息。
- 不得用 `git add -f local-notes/` 绕过忽略规则。
- 发现误入库时先停止提交/推送，清理后再继续。

## 如果过程文档已经进入历史

- 只删除当前文件不够，必须重写历史（`git filter-repo` 或 `git filter-branch`）。
- GitHub 上仅 force push 后旧提交仍可能按 SHA 被访问；已公开或即将公开的仓库应删除旧仓库后重建，或确认旧对象已不可访问。
- 重写前先用 `git bundle` 备份完整历史，备份放在本机（例如 `local-notes/`），不要提交。

## 忽略规则的位置

- 公开的 `.gitignore` 只写目录级规则 `local-notes/`，不写具体过程文件名，避免用文件名暴露 AI 工作流。
- 如需连目录名也不公开，改用 `.git/info/exclude`。

## 其他约定

- `git clean -fdx` / `git clean -fdX` 会删除 ignored 文件，执行前必须确认，不能自动运行。
- 提交信息、文档语言遵循仓库现有习惯；本文件为中文，技术术语保留英文。

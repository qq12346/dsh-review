# 发布与社区收录步骤

## 1. npm 发布

```bash
cd /Users/work/Documents/ChatGPT/dsh插件
npm run build
npm pack --dry-run          # 确认 tarball 含 lib/、cordis.patch.yml、README.md
npm login
npm publish --access public
```

发布前注意：

- `package.json` 的 `name` 目前是 `dsh-review`；如果 npm 上已被占用，先改成 `dsh-review-journal` 再发布。
- 发布的是构建后的 `lib/`，避免 git 安装时的 `prepare` 构建授权问题。

## 2. GitHub topic

仓库已创建为公共仓库：https://github.com/qq12346/dsh-review

已添加 topics：`dsh-plugin`、`deepseek-harness`、`dsh`、`typescript`。

## 3. awesome-dsh-plugin 收录 PR

目标仓库：`awesome-dsh-plugin/awesome-dsh-plugin`

PR 标题：

```text
Add dsh-review — session review and lessons plugin
```

PR 描述：

```text
## dsh-review

DeepSeek Harness（DSH）的「会话复盘 + 经验沉淀」插件。定位是复盘插件，不是记忆插件：
会话边界自动或手动生成复盘报告，并把经验条目沉淀到工作区 `.dsh-review/`，
供以后会话注入和检索。

- 双端：host（工具 / 会话事件 / 系统提示注入）+ client（复盘中心面板）
- 自动触发（`turn/end`、`compaction/end`）+ 手动 `review_session`
- 工具：`review_session`、`search_lessons`
- 数据目录：`.dsh-review/`（报告 + `lessons.json` + `lessons.md` + `index.json`）
- 安装：`dsh plugin --profile <name> add dsh-review`
- 仓库：https://github.com/qq12346/dsh-review

建议分类：Sessions & Messages（也可放 Workflow & Automation）
```

PR 正文里的“仓库链接”已更新为实际地址。

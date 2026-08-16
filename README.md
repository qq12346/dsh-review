# dsh-review

DeepSeek Harness（DSH）的「会话复盘 + 经验沉淀」插件。核心定位是复盘插件，不是记忆插件：它会生成人类可读的复盘报告，并把经验条目沉淀到工作区 `.dsh-review/`，供以后会话复用。

## 安装

```sh
dsh plugin --profile <profile> add dsh-review
```

安装后需要重启该 profile。

## 配置

在 profile 的 `cordis.patch.yml` 中覆盖以下字段：

- `stateDir`：数据目录，默认 `.dsh-review`。
- `maxInjectedLessons`：系统提示注入的经验条数，默认 5。
- `injectionBudgetChars`：注入文本字符预算，默认 800。
- `llmProvider` / `llmModel`：可选，配置后才启用 LLM 经验提炼；不配置则只做确定性结构化报告。

## 数据目录

```text
.dsh-review/
├── reports/<session-id>.md
├── lessons.json
├── lessons.md
└── index.json
```

## 工具

- `review_session`：对当前会话立即复盘并生成报告。
- `search_lessons`：按关键词或标签检索经验库。

## 开发

```sh
npm install --legacy-peer-deps
npm test
npm run build
node scripts/verify.mjs
```

DSH 仍处开发者预览期，`SESSION_FORMAT_VERSION = 0`，集成 API 以 `API-NOTES.md` 为准。

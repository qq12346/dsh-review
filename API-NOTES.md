# dsh-review API pin（来自 pinned checkout）

> 状态：待 Task 0 克隆 deepseek-harness 后回填。所有 DSH 集成代码以本文件为准。

1. defineTool: @deepseek-ai/dsh-tools
   ctx.tools.register(defineTool({ name, description, parameters, output: { schema, render }, execute(args, exec) }))
   exec.agent.session.header.cwd 为工作区；exec.agent.session 为 Session。
2. 系统提示: ctx.systemPrompt.section({ name, order, text: string | ((ctx) => string) }) 返回 disposer。
3. 会话事件: ctx.on('session/event', (session, event) => void)，event 含 type 与 data。
   SessionEventMap: 'turn/end' -> { turn: number; reason: TurnEndReason }；compaction/* 由 compaction 插件声明。
4. LLM: ctx.llm.stream(options: GenerateOptions): AsyncIterable<StreamChunk>；
   GenerateOptions 含 provider, model, messages: Message[], system?, maxTokens?, signal? 等。
   BlockAssembler 位于 @deepseek-ai/dsh-llm。
5. HTTP 路由: web.register({ kind: 'exact'|'prefix', path, handler(req, res) }) 返回 disposer；
   ctx.get('webServer')（rc.6）为 WebRouteHost。
6. 工作区: ctx.workspaceRegistry（rc.6），具体工作区根解析方式见 packages/workspace。

## 已确认的精确签名（2026-08-16，对照 npm rc 包 + 仓库源码）

- Session：`session.events` 是 `readonly SessionEvent[]`；`session.header.cwd`、`session.id` 可用。
- SessionEvent 信封：`{ type, seq, time, data, ignorable? }`；`data` 按 `SessionEventMap[type]` 定型。
- `tool/call` 数据含 `name`；`tool/result` 数据含 `error?: { name, code }`，工具名不在 `tool/result`，要从 `tool/call` 取。
- `ctx.on('session/event', (session, event) => ...)`，事件名由 `@deepseek-ai/dsh-session` 声明。
- `defineTool`：`parameters` 是 `{ [key]: ValueSchemaSpec & { required?: true } }`；`output.schema` 的 object 必须显式 `additionalProperties: boolean`；`execute` 返回值由 `output.schema` 推断。
- `PromptSection`：`{ name, order, text: string | ((ctx) => string), complete? }`；`text` 不接受 Promise。
- Schemastery 没有 `.optional()`；可选配置字段用 `Schema.string().default('')` 表达。
- `webServer` 类型来自 web 包；本插件用 `ctx.get('webServer') as WebRouteHost` 访问。

## 已知生态阻塞（npm rc 包不自洽）

- `@deepseek-ai/dsh-type-meta` 被 `@deepseek-ai/dsh-session` 引用但未发布到 npm，导致 host 全量 `tsc` 无法通过。
- `@deepseek-ai/dsh-client-runtime` 依赖未发布的 `@deepseek-ai/dsh-compact`，导致 client 侧依赖无法安装。
- 结论：npm rc.1 包无法支撑离线全量 typecheck/build；需要用官方仓库 checkout（`packages/` 完整源码）作为依赖来构建，或在 profile 内安装官方 bundle 后验证。

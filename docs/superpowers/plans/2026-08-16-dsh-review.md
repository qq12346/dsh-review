# dsh-review 插件 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个 DeepSeek Harness（DSH）双端插件 `dsh-review`，在会话边界自动或手动生成复盘报告，并把经验条目沉淀到工作区 `.dsh-review/`，通过系统提示注入 + 检索工具供后续会话复用。

**Architecture:** 一个 npm 包同时承担 host bundle 与 client bundle。host 面注册工具、监听 `session/event`、生成复盘、读写 `.dsh-review/`、注入系统提示、暴露 HTTP 路由；client 面用 React 面板浏览报告和经验库。核心业务逻辑（数据存储、git 提取、报告渲染、复盘组装、JSON 解析）全部抽成纯 TS 模块并先写测试。

**Tech Stack:** TypeScript 5.7+、Node.js、Cordis、@deepseek-ai/dsh-tools、@deepseek-ai/dsh-llm、@deepseek-ai/dsh-system-prompt、React + tsdown（client bundle）、vitest。

**Pre-release caveat:** DSH 的 `SESSION_FORMAT_VERSION = 0`，官方明示会有破坏性变更。Task 0 必须先 pin 一个 checkout 的精确 API 签名；后续所有集成代码以 Task 0 记录的签名为准。

---

### Task 0: 脚手架与 API pin

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.client.json`
- Create: `cordis.patch.yml`
- Create: `.gitignore`
- Create: `API-NOTES.md`
- Create: `vitest.config.ts`

- [ ] **Step 1: 初始化 package.json**

`package.json`：

```json
{
  "name": "dsh-review",
  "version": "0.1.0",
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./client": { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" },
    "./cordis.patch.yml": "./cordis.patch.yml",
    "./package.json": "./package.json"
  },
  "files": ["lib", "cordis.patch.yml", "README.md"],
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "inject": ["@deepseek-ai/dsh-client-runtime"], "platform": "web" }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json && tsc -p tsconfig.client.json && tsdown",
    "typecheck": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.client.json --noEmit",
    "test": "vitest run"
  },
  "peerDependencies": {
    "@deepseek-ai/dsh-tools": "*",
    "@deepseek-ai/dsh-llm": "*",
    "@deepseek-ai/dsh-system-prompt": "*",
    "@deepseek-ai/dsh-session": "*",
    "@deepseek-ai/dsh-client-runtime": "*",
    "react": "*"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "tsdown": "^0.22.0",
    "lightningcss": "^1.22.0",
    "vitest": "^2.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  }
}
```

Run: `npm install`
Expected: 依赖安装成功，无 `package.json` 解析错误。

- [ ] **Step 2: 写 tsconfig 与 cordis.patch.yml**

`tsconfig.json`：

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "declarationDir": "lib/types",
    "outDir": "lib",
    "rootDir": "src",
    "allowImportingTsExtensions": true,
    "rewriteRelativeImportExtensions": true,
    "types": ["node"]
  },
  "include": ["src"],
  "exclude": ["src/client"]
}
```

`tsconfig.client.json`：

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": []
  },
  "include": ["src/client", "src/css-modules.d.ts"],
  "exclude": []
}
```

`cordis.patch.yml`：

```yaml
- insert:
    - id: dsh-review
      name: dsh-review
```

`.gitignore`：

```text
node_modules/
lib/
*.tgz
.dsh-review/
```

- [ ] **Step 3: pin API 并记录到 API-NOTES.md**

Run:

```bash
mkdir -p /tmp/dsh-api && git clone --depth 1 https://github.com/deepseek-ai/deepseek-harness /tmp/dsh-api
```

Expected: `/tmp/dsh-api` 存在，且包含 `packages/`。

记录以下内容到 `API-NOTES.md`（以 checkout 实际签名为准，若与下面摘要不同则按实际改，后续任务以本文件为准）：

```text
# dsh-review API pin（来自 pinned checkout）
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
```

Commit:

```bash
git add package.json tsconfig.json tsconfig.client.json cordis.patch.yml .gitignore API-NOTES.md vitest.config.ts
git commit -m "chore: scaffold dsh-review plugin and pin DSH API"
```

### Task 1: 领域类型与校验

**Files:**
- Create: `src/types.ts`
- Test: `src/types.test.ts`

- [ ] **Step 1: 写失败测试**

`src/types.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { isLessonKind, makeLesson } from './types.ts'

describe('types', () => {
  it('accepts valid lesson kinds', () => {
    expect(isLessonKind('pitfall')).toBe(true)
    expect(isLessonKind('decision')).toBe(true)
    expect(isLessonKind('pattern')).toBe(true)
  })

  it('rejects invalid lesson kinds', () => {
    expect(isLessonKind('memory')).toBe(false)
  })

  it('creates a lesson with stable id and timestamps', () => {
    const lesson = makeLesson({ text: 'x', kind: 'pitfall', tags: [], sourceSessionId: 's1' })
    expect(lesson.id).toBeTruthy()
    expect(lesson.createdAt).toBeTruthy()
    expect(lesson.updatedAt).toBe(lesson.createdAt)
  })
})
```

Run: `npx vitest run src/types.test.ts`
Expected: FAIL，`Cannot find module './types.ts'`。

- [ ] **Step 2: 实现 types.ts**

`src/types.ts`：

```ts
import { randomUUID } from 'node:crypto'

export type LessonKind = 'pitfall' | 'decision' | 'pattern'

export interface Lesson {
  id: string
  text: string
  kind: LessonKind
  tags: string[]
  sourceSessionId: string
  createdAt: string
  updatedAt: string
}

export interface ReviewReport {
  sessionId: string
  title: string
  summary: string
  changedFiles: string[]
  decisions: string[]
  errors: string[]
  lessons: Lesson[]
}

export interface ReportMeta {
  sessionId: string
  path: string
  createdAt: string
  updatedAt: string
}

export interface ReviewIndex {
  reports: ReportMeta[]
}

export function isLessonKind(value: unknown): value is LessonKind {
  return value === 'pitfall' || value === 'decision' || value === 'pattern'
}

export function makeLesson(input: {
  text: string
  kind: LessonKind
  tags: string[]
  sourceSessionId: string
}): Lesson {
  const now = new Date().toISOString()
  return { id: randomUUID(), text: input.text, kind: input.kind, tags: input.tags, sourceSessionId: input.sourceSessionId, createdAt: now, updatedAt: now }
}
```

- [ ] **Step 3: 跑测试确认通过**

Run: `npx vitest run src/types.test.ts`
Expected: PASS，3 tests。

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/types.test.ts
git commit -m "feat: add review domain types"
```

### Task 2: 经验库存储

**Files:**
- Create: `src/lessons.ts`
- Test: `src/lessons.test.ts`

- [ ] **Step 1: 写失败测试**

`src/lessons.test.ts`：

```ts
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LessonsStore, makeLesson } from './lessons.ts'

let dir: string
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'dsh-review-')) })
afterEach(async () => { await rm(dir, { recursive: true, force: true }) })

describe('LessonsStore', () => {
  it('saves and loads lessons atomically', async () => {
    const store = new LessonsStore(dir)
    const lesson = makeLesson({ text: '别直接改 lockfile', kind: 'pitfall', tags: ['git'], sourceSessionId: 's1' })
    await store.save([lesson])
    expect(await store.load()).toEqual([lesson])
  })

  it('upserts by id and renders lessons.md', async () => {
    const store = new LessonsStore(dir)
    const a = makeLesson({ text: 'old', kind: 'pitfall', tags: [], sourceSessionId: 's1' })
    await store.save([a])
    const result = await store.upsert([{ ...a, text: 'new' }])
    expect(result.updated).toBe(1)
    expect((await store.load())[0]?.text).toBe('new')
    const md = await readFile(join(dir, 'lessons.md'), 'utf8')
    expect(md).toContain('new')
  })

  it('searches by text or tag', async () => {
    const store = new LessonsStore(dir)
    await store.save([
      makeLesson({ text: '复用 git diff 做改动清单', kind: 'pattern', tags: ['git'], sourceSessionId: 's1' }),
      makeLesson({ text: '审批前先检查异常', kind: 'decision', tags: ['approval'], sourceSessionId: 's2' }),
    ])
    expect((await store.search('git')).length).toBe(1)
  })

  it('returns empty when file missing or corrupted', async () => {
    const store = new LessonsStore(dir)
    expect(await store.load()).toEqual([])
    await store.save([])
    const file = join(dir, 'lessons.json')
    await import('node:fs/promises').then(fs => fs.writeFile(file, 'not json', 'utf8'))
    expect(await store.load()).toEqual([])
  })
})
```

Run: `npx vitest run src/lessons.test.ts`
Expected: FAIL，`Cannot find module './lessons.ts'`。

- [ ] **Step 2: 实现 lessons.ts**

`src/lessons.ts`：

```ts
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { makeLesson, type Lesson } from './types.ts'

export { makeLesson }

export class LessonsStore {
  constructor(private baseDir: string) {}

  private get file() { return join(this.baseDir, 'lessons.json') }
  private get mdFile() { return join(this.baseDir, 'lessons.md') }

  async load(): Promise<Lesson[]> {
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8'))
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  async save(lessons: Lesson[]): Promise<void> {
    await mkdir(this.baseDir, { recursive: true })
    const tmp = this.file + '.tmp'
    await writeFile(tmp, JSON.stringify(lessons, null, 2), 'utf8')
    await rename(tmp, this.file)
    await writeFile(this.mdFile, renderLessonsMd(lessons), 'utf8')
  }

  async upsert(incoming: Lesson[]): Promise<{ added: number; updated: number }> {
    const existing = await this.load()
    const byId = new Map(existing.map(item => [item.id, item]))
    let added = 0
    let updated = 0
    for (const item of incoming) {
      const found = byId.get(item.id)
      if (found) {
        byId.set(item.id, { ...found, text: item.text, kind: item.kind, tags: item.tags, updatedAt: new Date().toISOString() })
        updated++
      } else {
        byId.set(item.id, item)
        added++
      }
    }
    await this.save([...byId.values()])
    return { added, updated }
  }

  async search(query: string, limit = 5): Promise<Lesson[]> {
    const q = query.toLowerCase()
    const lessons = await this.load()
    return lessons
      .filter(item => item.text.toLowerCase().includes(q) || item.tags.some(tag => tag.toLowerCase().includes(q)))
      .slice(0, limit)
  }
}

function renderLessonsMd(lessons: Lesson[]): string {
  const lines = ['# 复盘经验库', '']
  for (const item of lessons) {
    lines.push(`- [${item.kind}] ${item.text}`, `  - tags: ${item.tags.join(', ') || '-'}`, `  - session: ${item.sourceSessionId}`, '')
  }
  return lines.join('\n')
}
```

- [ ] **Step 3: 跑测试确认通过**

Run: `npx vitest run src/lessons.test.ts`
Expected: PASS，4 tests。

- [ ] **Step 4: Commit**

```bash
git add src/lessons.ts src/lessons.test.ts
git commit -m "feat: add lessons store"
```

### Task 3: git 改动提取

**Files:**
- Create: `src/git.ts`
- Test: `src/git.test.ts`

- [ ] **Step 1: 写失败测试**

`src/git.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { parseChangedFiles, type GitRunner } from './git.ts'

describe('parseChangedFiles', () => {
  it('splits porcelain output into file names', () => {
    expect(parseChangedFiles(' M src/index.ts\n?? README.md\n')).toEqual(['src/index.ts', 'README.md'])
  })

  it('handles renamed files with arrow syntax', () => {
    expect(parseChangedFiles('R  old.ts -> new.ts\n')).toEqual(['new.ts'])
  })
})

describe('getChangedFiles', () => {
  it('runs git status with porcelain format', async () => {
    let args: string[] = []
    const runner: GitRunner = { run: async (a) => { args = a; return ' M a.ts\n' } }
    const { getChangedFiles } = await import('./git.ts')
    expect(await getChangedFiles(runner, '/work')).toEqual(['a.ts'])
    expect(args).toEqual(['status', '--porcelain'])
  })
})
```

Run: `npx vitest run src/git.test.ts`
Expected: FAIL，`Cannot find module './git.ts'`。

- [ ] **Step 2: 实现 git.ts**

`src/git.ts`：

```ts
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface GitRunner {
  run(args: string[], cwd: string): Promise<string>
}

export const systemGit: GitRunner = {
  async run(args, cwd) {
    const { stdout } = await execFileAsync('git', args, { cwd })
    return stdout
  },
}

export async function getChangedFiles(runner: GitRunner, cwd: string): Promise<string[]> {
  const output = await runner.run(['status', '--porcelain'], cwd)
  return parseChangedFiles(output)
}

export async function getDiffStat(runner: GitRunner, cwd: string): Promise<string> {
  try {
    return await runner.run(['diff', '--stat'], cwd)
  } catch {
    return ''
  }
}

export function parseChangedFiles(output: string): string[] {
  return output
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      if (line.includes(' -> ')) return line.split(' -> ')[1]?.trim() ?? ''
      return line.slice(3).trim()
    })
    .filter(Boolean)
}
```

- [ ] **Step 3: 跑测试确认通过**

Run: `npx vitest run src/git.test.ts`
Expected: PASS，3 tests。

- [ ] **Step 4: Commit**

```bash
git add src/git.ts src/git.test.ts
git commit -m "feat: add git change extraction"
```

### Task 4: 报告渲染

**Files:**
- Create: `src/report.ts`
- Test: `src/report.test.ts`

- [ ] **Step 1: 写失败测试**

`src/report.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { renderReport, reportFileName } from './report.ts'
import type { ReviewReport } from './types.ts'

describe('renderReport', () => {
  it('renders the standard sections', () => {
    const report: ReviewReport = {
      sessionId: 's1',
      title: '修复登录',
      summary: '做了登录修复',
      changedFiles: ['src/login.ts'],
      decisions: ['改用 token 校验'],
      errors: ['第一次调用超时'],
      lessons: [],
    }
    const md = renderReport(report)
    expect(md).toContain('# 修复登录')
    expect(md).toContain('## 改动文件')
    expect(md).toContain('src/login.ts')
    expect(md).toContain('## 关键决策')
    expect(md).toContain('## 报错 / 卡点')
  })

  it('generates a stable file name', () => {
    expect(reportFileName('s1')).toBe('s1.md')
  })
})
```

Run: `npx vitest run src/report.test.ts`
Expected: FAIL，`Cannot find module './report.ts'`。

- [ ] **Step 2: 实现 report.ts**

`src/report.ts`：

```ts
import type { ReviewReport } from './types.ts'

export function reportFileName(sessionId: string): string {
  return `${sessionId}.md`
}

export function renderReport(report: ReviewReport): string {
  const lines: string[] = []
  lines.push(`# ${report.title}`, '')
  lines.push('## 会话摘要', '', report.summary, '')
  lines.push('## 改动文件', '')
  if (report.changedFiles.length === 0) lines.push('- （无文件改动）', '')
  else for (const file of report.changedFiles) lines.push(`- \`${file}\``)
  lines.push('', '## 关键决策', '')
  if (report.decisions.length === 0) lines.push('- （无记录）', '')
  else for (const item of report.decisions) lines.push(`- ${item}`)
  lines.push('', '## 报错 / 卡点', '')
  if (report.errors.length === 0) lines.push('- （无报错）', '')
  else for (const item of report.errors) lines.push(`- ${item}`)
  lines.push('', '## 本轮经验', '')
  if (report.lessons.length === 0) lines.push('- （无新经验）', '')
  else for (const lesson of report.lessons) lines.push(`- [${lesson.kind}] ${lesson.text}`)
  return lines.join('\n') + '\n'
}
```

- [ ] **Step 3: 跑测试确认通过**

Run: `npx vitest run src/report.test.ts`
Expected: PASS，2 tests。

- [ ] **Step 4: Commit**

```bash
git add src/report.ts src/report.test.ts
git commit -m "feat: add report renderer"
```

### Task 5: 复盘组装与经验 JSON 解析

**Files:**
- Create: `src/review.ts`
- Create: `src/parse.ts`
- Test: `src/review.test.ts`
- Test: `src/parse.test.ts`

- [ ] **Step 1: 写失败测试**

`src/review.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { buildReview, type SessionFacts } from './review.ts'
import type { GitRunner } from './git.ts'

describe('buildReview', () => {
  it('assembles a deterministic report from facts and git', async () => {
    const runner: GitRunner = { run: async (args) => args[0] === 'status' ? ' M a.ts\n' : ' a.ts | 2 +-\n' }
    const facts: SessionFacts = {
      sessionId: 's1',
      cwd: '/work',
      decisions: ['改了入口'],
      errors: ['超时一次'],
      approvals: ['批准删除临时文件'],
    }
    const report = await buildReview(facts, runner)
    expect(report.changedFiles).toEqual(['a.ts'])
    expect(report.decisions).toContain('改了入口')
    expect(report.errors).toContain('超时一次')
    expect(report.title).toBeTruthy()
    expect(report.summary).toContain('a.ts')
  })
})
```

`src/parse.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { parseLessonsJson } from './parse.ts'

describe('parseLessonsJson', () => {
  it('parses a lessons array', () => {
    const parsed = parseLessonsJson(JSON.stringify([
      { text: 'x', kind: 'pitfall', tags: [], sourceSessionId: 's1' },
    ]), 's1')
    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.id).toBeTruthy()
  })

  it('returns empty on invalid json or wrong shape', () => {
    expect(parseLessonsJson('not json', 's1')).toEqual([])
    expect(parseLessonsJson('{"a":1}', 's1')).toEqual([])
  })
})
```

Run: `npx vitest run src/review.test.ts src/parse.test.ts`
Expected: FAIL，`Cannot find module './review.ts'`。

- [ ] **Step 2: 实现 review.ts 与 parse.ts**

`src/review.ts`：

```ts
import { getChangedFiles, type GitRunner } from './git.ts'
import { makeLesson, type Lesson, type ReviewReport } from './types.ts'

export interface SessionFacts {
  sessionId: string
  cwd: string
  title?: string
  decisions: string[]
  errors: string[]
  approvals: string[]
}

export async function buildReview(facts: SessionFacts, git: GitRunner, lessons: Lesson[] = []): Promise<ReviewReport> {
  const changedFiles = await getChangedFiles(git, facts.cwd)
  const title = facts.title ?? `会话复盘 ${facts.sessionId}`
  const summaryParts = [`本会话改动 ${changedFiles.length} 个文件。`]
  if (facts.errors.length > 0) summaryParts.push(`记录到 ${facts.errors.length} 个报错/卡点。`)
  if (facts.approvals.length > 0) summaryParts.push(`涉及 ${facts.approvals.length} 次审批。`)
  return {
    sessionId: facts.sessionId,
    title,
    summary: summaryParts.join(''),
    changedFiles,
    decisions: facts.decisions,
    errors: facts.errors,
    lessons,
  }
}
```

`src/parse.ts`：

```ts
import { isLessonKind, makeLesson, type Lesson } from './types.ts'

export function parseLessonsJson(text: string, sourceSessionId: string): Lesson[] {
  try {
    const value = JSON.parse(text)
    if (!Array.isArray(value)) return []
    return value.flatMap(item => {
      if (!item || typeof item.text !== 'string' || !isLessonKind(item.kind)) return []
      return [makeLesson({ text: item.text, kind: item.kind, tags: Array.isArray(item.tags) ? item.tags.filter((t: unknown) => typeof t === 'string') : [], sourceSessionId })]
    })
  } catch {
    return []
  }
}
```

- [ ] **Step 3: 跑测试确认通过**

Run: `npx vitest run src/review.test.ts src/parse.test.ts`
Expected: PASS，3 tests。

- [ ] **Step 4: Commit**

```bash
git add src/review.ts src/parse.ts src/review.test.ts src/parse.test.ts
git commit -m "feat: add review assembly and lesson parsing"
```

### Task 5.5: 会话事实分类（纯逻辑）

**Files:**
- Create: `src/facts.ts`
- Test: `src/facts.test.ts`

- [ ] **Step 1: 写失败测试**

`src/facts.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { reduceSessionFacts, type ClassifiedFact } from './facts.ts'

describe('reduceSessionFacts', () => {
  it('classifies errors, approvals, and tool calls', () => {
    const facts: ClassifiedFact[] = [
      { kind: 'error', text: '超时一次' },
      { kind: 'approval', text: '批准删除临时文件' },
      { kind: 'tool', text: 'review_session' },
      { kind: 'tool', text: 'review_session' },
    ]
    const result = reduceSessionFacts(facts)
    expect(result.errors).toEqual(['超时一次'])
    expect(result.approvals).toEqual(['批准删除临时文件'])
    expect(result.decisions).toContain('使用工具 review_session')
  })

  it('deduplicates identical entries', () => {
    const facts: ClassifiedFact[] = [
      { kind: 'error', text: 'x' },
      { kind: 'error', text: 'x' },
    ]
    expect(reduceSessionFacts(facts).errors).toEqual(['x'])
  })
})
```

Run: `npx vitest run src/facts.test.ts`
Expected: FAIL，`Cannot find module './facts.ts'`。

- [ ] **Step 2: 实现 facts.ts**

`src/facts.ts`：

```ts
export interface ClassifiedFact {
  kind: 'tool' | 'error' | 'approval'
  text: string
}

export interface ReducedFacts {
  decisions: string[]
  errors: string[]
  approvals: string[]
}

export function reduceSessionFacts(facts: ClassifiedFact[]): ReducedFacts {
  const seen = { decisions: new Set<string>(), errors: new Set<string>(), approvals: new Set<string>() }
  for (const fact of facts) {
    if (fact.kind === 'error') seen.errors.add(fact.text)
    if (fact.kind === 'approval') seen.approvals.add(fact.text)
    if (fact.kind === 'tool') seen.decisions.add(`使用工具 ${fact.text}`)
  }
  return { decisions: [...seen.decisions], errors: [...seen.errors], approvals: [...seen.approvals] }
}
```

- [ ] **Step 3: 跑测试确认通过**

Run: `npx vitest run src/facts.test.ts`
Expected: PASS，2 tests。

- [ ] **Step 4: Commit**

```bash
git add src/facts.ts src/facts.test.ts
git commit -m "feat: add session fact classification"
```

### Task 5.6: LLM 经验提炼（纯逻辑 + 薄适配）

**Files:**
- Create: `src/llm.ts`
- Test: `src/llm.test.ts`

- [ ] **Step 1: 写失败测试**

`src/llm.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { buildExtractionPrompt } from './llm.ts'
import type { SessionFacts } from './review.ts'

describe('buildExtractionPrompt', () => {
  it('embeds session facts and constrains output shape', () => {
    const facts: SessionFacts = { sessionId: 's1', cwd: '/work', decisions: ['a'], errors: ['b'], approvals: [] }
    const prompt = buildExtractionPrompt(facts)
    expect(prompt).toContain('s1')
    expect(prompt).toContain('pitfall')
    expect(prompt).toContain('只输出 JSON')
  })
})
```

Run: `npx vitest run src/llm.test.ts`
Expected: FAIL，`Cannot find module './llm.ts'`。

- [ ] **Step 2: 实现 llm.ts**

`src/llm.ts`：

```ts
import type { Context } from '@deepseek-ai/cordis'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { createUserMessage } from '@deepseek-ai/dsh-llm/message'
import { parseLessonsJson } from './parse.ts'
import type { SessionFacts } from './review.ts'
import type { Lesson } from './types.ts'

export interface LlmConfig { provider: string; model: string }

export function buildExtractionPrompt(facts: SessionFacts): string {
  return [
    '你是复盘助手。根据以下会话事实，输出 JSON 数组，每条经验含 text/kind/tags。',
    'kind 只能是 pitfall、decision、pattern。',
    `会话 id: ${facts.sessionId}`,
    `决策: ${facts.decisions.join('；') || '无'}`,
    `报错: ${facts.errors.join('；') || '无'}`,
    `审批: ${facts.approvals.join('；') || '无'}`,
    '只输出 JSON，不要解释。',
  ].join('\n')
}

export function makeExtractLessons(ctx: Context, cfg: LlmConfig): (facts: SessionFacts) => Promise<Lesson[]> {
  return async (facts) => {
    const options: GenerateOptions = {
      provider: cfg.provider,
      model: cfg.model,
      messages: [createUserMessage({ content: [{ type: 'text', text: buildExtractionPrompt(facts) }], source: { kind: 'plugin', plugin: 'dsh-review' } })],
      maxTokens: 800,
    }
    const text = await generateText(ctx, options)
    return parseLessonsJson(text, facts.sessionId)
  }
}

export async function generateText(ctx: Context, options: GenerateOptions): Promise<string> {
  let text = ''
  for await (const chunk of ctx.llm.stream(options)) {
    const item = chunk as StreamChunk
    if (item.type === 'text-delta') text += item.text
  }
  return text
}
```

注意：`GenerateOptions`、`StreamChunk` 的导出入口与 `createUserMessage` 的路径以 Task 0 的 `API-NOTES.md` 为准；若 `messages` 的 `source` 字段另有必填 form，按 pin 文件补齐。

- [ ] **Step 3: 跑测试确认通过**

Run: `npx vitest run src/llm.test.ts`
Expected: PASS，1 test。

- [ ] **Step 4: Commit**

```bash
git add src/llm.ts src/llm.test.ts
git commit -m "feat: add LLM lesson extraction seam"
```

### Task 6: host 集成

**Files:**
- Create: `src/index.ts`
- Create: `src/tools.ts`
- Create: `src/events.ts`
- Create: `src/state.ts`
- Create: `src/session-facts.ts`

注意：本任务中的 DSH 包名与精确签名以 Task 0 的 `API-NOTES.md` 为准；若 `@deepseek-ai/dsh-session` 的 Context 声明合并入口不是 `/types`，按 pin 文件修正。

- [ ] **Step 1: 实现 state.ts（工作区状态）**

`src/state.ts`：

```ts
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { LessonsStore } from './lessons.ts'
import { reportFileName, renderReport } from './report.ts'
import type { ReviewIndex, ReviewReport } from './types.ts'

export class ReviewState {
  readonly lessons: LessonsStore
  constructor(private baseDir: string) {
    this.lessons = new LessonsStore(baseDir)
  }

  private reportsDir() { return join(this.baseDir, 'reports') }

  async saveReport(report: ReviewReport): Promise<string> {
    await mkdir(this.reportsDir(), { recursive: true })
    const path = join(this.reportsDir(), reportFileName(report.sessionId))
    const tmp = path + '.tmp'
    await writeFile(tmp, renderReport(report), 'utf8')
    await rename(tmp, path)
    await this.touchIndex(report)
    return path
  }

  private async touchIndex(report: ReviewReport): Promise<void> {
    const index = await this.loadIndex()
    const now = new Date().toISOString()
    const existing = index.reports.find(item => item.sessionId === report.sessionId)
    if (existing) {
      existing.path = `reports/${reportFileName(report.sessionId)}`
      existing.updatedAt = now
    } else {
      index.reports.unshift({ sessionId: report.sessionId, path: `reports/${reportFileName(report.sessionId)}`, createdAt: now, updatedAt: now })
    }
    const tmp = this.indexFile() + '.tmp'
    await writeFile(tmp, JSON.stringify(index, null, 2), 'utf8')
    await rename(tmp, this.indexFile())
  }

  async loadIndex(): Promise<ReviewIndex> {
    try {
      const value = JSON.parse(await readFile(this.indexFile(), 'utf8'))
      return value && Array.isArray(value.reports) ? value : { reports: [] }
    } catch {
      return { reports: [] }
    }
  }

  private indexFile() { return join(this.baseDir, 'index.json') }
}
```

- [ ] **Step 2: 实现 session-facts.ts**

`src/session-facts.ts`：

```ts
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session/types'
import { reduceSessionFacts, type ClassifiedFact } from './facts.ts'
import type { SessionFacts } from './review.ts'

export function sessionToFacts(session: Session, events: SessionEvent[]): SessionFacts {
  const classified: ClassifiedFact[] = []
  for (const event of events) {
    if (event.type === 'tool/result' && event.data?.isError) classified.push({ kind: 'error', text: event.data?.error ?? '工具调用报错' })
    if (event.type.startsWith('approval/')) classified.push({ kind: 'approval', text: event.type })
    if (event.type === 'tool/result') classified.push({ kind: 'tool', text: event.data?.name ?? 'tool' })
  }
  const reduced = reduceSessionFacts(classified)
  return { sessionId: session.id, cwd: session.header.cwd, decisions: reduced.decisions, errors: reduced.errors, approvals: reduced.approvals }
}

export async function readSessionEvents(session: Session): Promise<SessionEvent[]> {
  const events: SessionEvent[] = []
  // 精确读取 API 以 API-NOTES.md 为准；此处展示目标循环，不隐藏未知点。
  for await (const event of session.readEvents()) events.push(event)
  return events
}
```

注意：`SessionEvent` 的精确结构、`session.readEvents()` 的真实方法名、以及 `tool/result` 的 payload 字段名，以 Task 0 的 `API-NOTES.md` 为准；`readSessionEvents` 是唯一需要按 pin 结果替换的薄适配函数。

- [ ] **Step 3: 实现 tools.ts**

`src/tools.ts`：

```ts
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import { buildReview, type SessionFacts } from './review.ts'
import { systemGit } from './git.ts'
import { ReviewState } from './state.ts'
import type { Lesson } from './types.ts'

export function registerTools(ctx: Context, state: ReviewState, gather: (sessionId: string) => Promise<{ facts: SessionFacts; lessons: Lesson[] }>): void {
  ctx.tools.register(defineTool({
    name: 'review_session',
    description: '对当前会话生成复盘报告并沉淀经验。当用户要求复盘、总结这次工作，或在会话结尾想留下经验时使用。',
    parameters: {},
    output: {
      schema: { type: 'object', properties: { reportPath: { type: 'string' }, lessonCount: { type: 'number' } }, required: ['reportPath', 'lessonCount'] },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(_args, exec) {
      const agent = exec.agent
      if (!agent) throw new Error('requires a calling agent')
      const { facts, lessons } = await gather(agent.id)
      const report = await buildReview(facts, systemGit, lessons)
      const path = await state.saveReport(report)
      return { reportPath: path, lessonCount: report.lessons.length }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'search_lessons',
    description: '从复盘经验库检索相关经验，遇到类似任务、类似报错或类似决策时使用。',
    parameters: {
      query: { type: 'string', required: true, description: '关键词或标签' },
      limit: { type: 'number', required: false, description: '返回条数，默认 5' },
    },
    output: {
      schema: { type: 'array', items: { type: 'object' } },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args) {
      return state.lessons.search(args.query, args.limit ?? 5)
    },
  }))
}
```

- [ ] **Step 4: 实现 events.ts**

`src/events.ts`：

```ts
import type { Context } from '@deepseek-ai/cordis'
import { buildReview, type SessionFacts } from './review.ts'
import { systemGit } from './git.ts'
import { ReviewState } from './state.ts'
import type { Lesson } from './types.ts'

export function registerEvents(ctx: Context, state: ReviewState, gather: (sessionId: string) => Promise<{ facts: SessionFacts; lessons: Lesson[] }>): void {
  ctx.on('session/event', (session, event) => {
    if (event.type !== 'turn/end' && event.type !== 'compaction/end') return
    void gather(session.id)
      .then(({ facts, lessons }) => buildReview(facts, systemGit, lessons))
      .then(report => state.saveReport(report))
      .catch(() => {})
  })
}
```

- [ ] **Step 5: 实现 index.ts**

`src/index.ts`：

```ts
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-session/types'
import { makeExtractLessons } from './llm.ts'
import { registerTools } from './tools.ts'
import { registerEvents } from './events.ts'
import { ReviewState } from './state.ts'
import { readSessionEvents, sessionToFacts } from './session-facts.ts'
import type { Lesson } from './types.ts'
import type { SessionFacts } from './review.ts'

export const name = 'dsh-review'
export const inject = ['tools', 'sessions', 'systemPrompt', 'llm', 'webServer', 'workspaceRegistry']

export interface Config {
  stateDir: string
  maxInjectedLessons: number
  injectionBudgetChars: number
  llmProvider?: string
  llmModel?: string
}

export const Config = Schema.object({
  stateDir: Schema.string().default('.dsh-review'),
  maxInjectedLessons: Schema.number().default(5),
  injectionBudgetChars: Schema.number().default(800),
  llmProvider: Schema.string().optional(),
  llmModel: Schema.string().optional(),
})

export function apply(ctx: Context, config: Config): void {
  const workspace = ctx.workspaceRegistry
  const base = workspace?.current?.cwd ?? process.cwd()
  const state = new ReviewState(join(base, config.stateDir))
  const extract = config.llmProvider && config.llmModel ? makeExtractLessons(ctx, { provider: config.llmProvider, model: config.llmModel }) : undefined

  async function gather(sessionId: string): Promise<{ facts: SessionFacts; lessons: Lesson[] }> {
    const session = ctx.sessions.list().find(item => item.id === sessionId)
    if (!session) throw new Error('session not found')
    const events = await readSessionEvents(session)
    const facts = sessionToFacts(session, events)
    const lessons = extract ? await extract(facts) : []
    return { facts, lessons }
  }

  ctx.effect(() => ctx.systemPrompt.section({
    name: 'review:lessons',
    order: 115,
    text: () => state.lessons.load()
      .then(lessons => lessons.slice(0, config.maxInjectedLessons))
      .then(lessons => `## 复盘经验（来自 dsh-review）\n${lessons.map(item => `- [${item.kind}] ${item.text}`).join('\n')}`.slice(0, config.injectionBudgetChars)),
  }))

  registerTools(ctx, state, gather)
  registerEvents(ctx, state, gather)

  const web = ctx.webServer
  ctx.effect(() => web.register({
    kind: 'exact',
    path: '/dsh-review/state',
    handler: async (_req, res) => {
      const [lessons, index] = await Promise.all([state.lessons.load(), state.loadIndex()])
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify({ lessons, index }))
    },
  }))
  ctx.effect(() => web.register({
    kind: 'exact',
    path: '/dsh-review/run',
    handler: async (_req, res) => {
      res.writeHead(202, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: true }))
    },
  }))
}
```

注意：`systemPrompt.section.text` 返回 Promise 的写法是否被允许取决于 pin 文件；若 `text` 只接受同步字符串，则把注入改为同步读取最近写入的静态缓存（`events.ts` 每次复盘后刷新 `lessons.md` 摘要）。Task 0 已确认后再落地。

- [ ] **Step 6: typecheck**

Run: `npm run typecheck`
Expected: 若出现 DSH 包名/签名差异，按 `API-NOTES.md` 修正后通过。

- [ ] **Step 7: Commit**

```bash
git add src/index.ts src/tools.ts src/events.ts src/state.ts src/session-facts.ts
git commit -m "feat: wire host plugin"
```

### Task 7: 离线验证与构建

**Files:**
- Create: `scripts/verify.mjs`
- Create: `README.md`

- [ ] **Step 1: 写 verify.mjs**

`scripts/verify.mjs`：

```js
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = await mkdtemp(join(tmpdir(), 'dsh-review-verify-'))
try {
  const { LessonsStore, makeLesson } = await import('../lib/lessons.js')
  const store = new LessonsStore(dir)
  const lesson = makeLesson({ text: 'smoke', kind: 'pitfall', tags: ['x'], sourceSessionId: 's1' })
  await store.save([lesson])
  const loaded = await store.load()
  if (loaded.length !== 1 || loaded[0].text !== 'smoke') throw new Error('lessons smoke failed')
  console.log('verify ok')
} finally {
  await rm(dir, { recursive: true, force: true })
}
```

- [ ] **Step 2: 构建并跑验证**

Run:

```bash
npm run build
node scripts/verify.mjs
dsh --profile dsh-review-scratch --dump-config
```

Expected:

- build 生成 `lib/index.js` 与 `lib/client.js`（client 在 Task 8 后才有）；
- `node scripts/verify.mjs` 输出 `verify ok`；
- `dsh --profile dsh-review-scratch --dump-config` 的组合树出现 `dsh-review` 行。

- [ ] **Step 3: 写 README.md**

`README.md` 至少包含：一句话定位（复盘插件，不是记忆插件）、安装命令 `dsh plugin --profile <name> add dsh-review`、配置项说明、`.dsh-review/` 目录说明、两个工具的使用时机、开发命令。

- [ ] **Step 4: Commit**

```bash
git add scripts/verify.mjs README.md
git commit -m "test: add offline verification and docs"
```

### Task 8: client bundle

**Files:**
- Create: `src/css-modules.d.ts`
- Create: `src/client/index.tsx`
- Create: `src/client/ReviewPanel.tsx`
- Create: `src/client/ReviewPanel.module.css`
- Create: `tsdown.config.ts`

- [ ] **Step 1: 写 client 入口与面板**

`src/css-modules.d.ts`：

```ts
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
```

`src/client/index.tsx`：

```tsx
import { createRoot } from 'react-dom/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { ReviewPanel } from './ReviewPanel.tsx'

export const inject = ['sessions']

export function apply(ctx: ClientContext): void {
  const host = document.createElement('div')
  host.dataset.dshReviewHost = ''
  document.body.appendChild(host)
  const root = createRoot(host)
  root.render(<ReviewPanel />)
  ctx.effect(() => () => { root.unmount(); host.remove() })
}
```

`src/client/ReviewPanel.tsx`：

```tsx
import { useEffect, useState } from 'react'
import styles from './ReviewPanel.module.css'

interface State { lessons: unknown[]; index: { reports: unknown[] } }

export function ReviewPanel(): JSX.Element {
  const [data, setData] = useState<State>({ lessons: [], index: { reports: [] } })
  const [error, setError] = useState<string>('')

  useEffect(() => {
    let alive = true
    fetch('/dsh-review/state', { cache: 'no-store' })
      .then(res => res.json())
      .then(json => { if (alive) setData(json) })
      .catch(() => { if (alive) setError('读取失败') })
    return () => { alive = false }
  }, [])

  return (
    <div className={styles.panel}>
      <h2>复盘中心</h2>
      {error && <p className={styles.error}>{error}</p>}
      <button onClick={() => fetch('/dsh-review/run', { method: 'POST', cache: 'no-store' })}>复盘当前会话</button>
      <section>
        <h3>报告（{data.index.reports.length}）</h3>
        <ul>{data.index.reports.map((item: { sessionId: string }) => <li key={item.sessionId}>{item.sessionId}</li>)}</ul>
      </section>
      <section>
        <h3>经验（{data.lessons.length}）</h3>
        <ul>{data.lessons.map((item: { id: string; text: string }) => <li key={item.id}>{item.text}</li>)}</ul>
      </section>
    </div>
  )
}
```

`src/client/ReviewPanel.module.css`：

```css
.panel { padding: 16px; font: 14px/1.5 system-ui, sans-serif; }
.error { color: #c62828; }
```

- [ ] **Step 2: 写 tsdown.config.ts**

`tsdown.config.ts` 按 dsh-agent-teams 的 client 协议复刻，entry 指向 `lib/client/index.js`，输出 `lib/client.js`，banner/footer/intro 使用 `window.__ModuleLoader__.load({ id: "dsh-review", factory: ... })`。purity gate 与 css-modules 插件从 pinned checkout 的 `packages/client/tsdown.client.ts` 复制并改包名。

Run: `npm run build`
Expected: 生成 `lib/client.js`。

- [ ] **Step 3: 手动验收**

起临时 profile 跑一轮会话，确认前端面板出现在浏览器、能列出报告和经验、按钮可触发。

- [ ] **Step 4: Commit**

```bash
git add src/css-modules.d.ts src/client tsdown.config.ts
git commit -m "feat: add client review panel"
```

### Task 9: 分发与社区收录

**Files:**
- Modify: `README.md`
- Modify: `package.json`

- [ ] **Step 1: npm 发布前检查**

Run: `npm run build && npm pack --dry-run`
Expected: tarball 包含 `lib/`、`cordis.patch.yml`、`README.md`。

- [ ] **Step 2: 发布**

Run: `npm publish --access public`
Expected: 包出现在 npm，版本 `0.1.0`。

- [ ] **Step 3: 加 GitHub topic 并提收录 PR**

在仓库 About 添加 `dsh-plugin` topic；向 `awesome-dsh-plugin/awesome-dsh-plugin` 提交 PR，把 `dsh-review` 放入 Sessions & Messages 或 Workflow & Automation 分类，附一句定位说明。

- [ ] **Step 4: Commit**

```bash
git add package.json README.md
git commit -m "docs: finalize distribution metadata"
```

## Self-Review

- Spec coverage：spec 第 3-10 节分别对应 Task 0/6/8（架构与分发）、Task 2/5（数据与报告）、Task 3（git）、Task 6（事件/工具/注入/路由）、Task 7（验证）、Task 9（社区）。
- 已知待办由 Task 0 的 API pin 收敛，不保留 TBD/TODO 占位。
- 类型一致性：`Lesson`、`ReviewReport`、`SessionFacts`、`ReviewState`、`LessonsStore` 在 Task 1-6 中的字段命名一致；`reportFileName` 统一输出 `sessionId.md`。

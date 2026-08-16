import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import { join } from 'node:path'
import { registerEvents } from './events.ts'
import { makeExtractLessons } from './llm.ts'
import { registerTools } from './tools.ts'
import { ReviewState } from './state.ts'
import type { SessionFacts } from './review.ts'
import type { Lesson } from './types.ts'

export const name = 'dsh-review'
export const inject = ['tools', 'sessions', 'systemPrompt', 'llm', 'webServer']

export interface Config {
  stateDir: string
  maxInjectedLessons: number
  injectionBudgetChars: number
  llmProvider: string
  llmModel: string
}

export const Config = Schema.object({
  stateDir: Schema.string().default('.dsh-review'),
  maxInjectedLessons: Schema.number().default(5),
  injectionBudgetChars: Schema.number().default(800),
  llmProvider: Schema.string().default(''),
  llmModel: Schema.string().default(''),
})

export function apply(ctx: Context, config: Config): void {
  const state = new ReviewState(join(process.cwd(), config.stateDir))
  const extract: (facts: SessionFacts) => Promise<Lesson[]> = config.llmProvider && config.llmModel
    ? makeExtractLessons(ctx, { provider: config.llmProvider, model: config.llmModel })
    : async () => []

  let lessonsText = ''
  const refreshLessonsText = (): void => {
    void state.lessons.load().then(lessons => {
      const text = `## 复盘经验（来自 dsh-review）\n${lessons.slice(0, config.maxInjectedLessons).map(item => `- [${item.kind}] ${item.text}`).join('\n')}`
      lessonsText = text.slice(0, config.injectionBudgetChars)
    })
  }
  refreshLessonsText()

  ctx.effect(() => ctx.systemPrompt.section({
    name: 'review:lessons',
    order: 115,
    text: () => lessonsText,
  }))

  registerTools(ctx, state, extract, refreshLessonsText)
  registerEvents(ctx, state, extract, refreshLessonsText)

  interface WebRouteHost {
    register(options: {
      kind: 'exact' | 'prefix'
      path: string
      handler: (req: unknown, res: { writeHead: (status: number, headers: Record<string, string>) => void; end: (body: string) => void }) => void | Promise<void>
    }): () => void
  }
  const web = (ctx as unknown as { get(name: string): unknown }).get('webServer') as WebRouteHost
  ctx.effect(() => web.register({
    kind: 'exact',
    path: '/dsh-review/state',
    handler: async (_req: unknown, res: { writeHead: (status: number, headers: Record<string, string>) => void; end: (body: string) => void }) => {
      const [lessons, index] = await Promise.all([state.lessons.load(), state.loadIndex()])
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify({ lessons, index }))
    },
  }))
  ctx.effect(() => web.register({
    kind: 'exact',
    path: '/dsh-review/run',
    handler: async (_req: unknown, res: { writeHead: (status: number, headers: Record<string, string>) => void; end: (body: string) => void }) => {
      res.writeHead(202, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: true }))
    },
  }))
}

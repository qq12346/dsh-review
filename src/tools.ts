import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-session'
import { systemGit } from './git.ts'
import { buildReview, type SessionFacts } from './review.ts'
import { sessionToFacts } from './session-facts.ts'
import { ReviewState } from './state.ts'
import type { Lesson } from './types.ts'

export function registerTools(
  ctx: Context,
  state: ReviewState,
  extract: (facts: SessionFacts) => Promise<Lesson[]>,
  onPersist: () => void,
): void {
  ctx.tools.register(defineTool({
    name: 'review_session',
    description: '对当前会话生成复盘报告并沉淀经验。当用户要求复盘、总结这次工作，或在会话结尾想留下经验时使用。',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          reportPath: { type: 'string' },
          lessonCount: { type: 'number' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(_args, exec) {
      const agent = exec.agent
      if (!agent) throw new Error('requires a calling agent')
      const facts = sessionToFacts(agent.session)
      const lessons = await extract(facts)
      await state.lessons.upsert(lessons)
      const report = await buildReview(facts, systemGit, lessons)
      const path = await state.saveReport(report)
      onPersist()
      return { reportPath: path, lessonCount: report.lessons.length }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'search_lessons',
    description: '从复盘经验库检索相关经验，遇到类似任务、类似报错或类似决策时使用。',
    parameters: {
      query: { type: 'string', required: true, description: '关键词或标签' },
      limit: { type: 'number', description: '返回条数，默认 5' },
    },
    output: {
      schema: { type: 'array', items: { type: 'json' } },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args) {
      const lessons = await state.lessons.search(args.query, args.limit ?? 5)
      return lessons as unknown as JsonValue[]
    },
  }))
}

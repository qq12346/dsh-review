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

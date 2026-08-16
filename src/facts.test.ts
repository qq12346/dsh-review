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

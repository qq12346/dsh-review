import { describe, expect, it } from 'vitest'
import { buildExtractionPrompt } from './prompt.ts'
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

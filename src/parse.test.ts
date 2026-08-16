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

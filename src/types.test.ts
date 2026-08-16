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

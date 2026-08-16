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

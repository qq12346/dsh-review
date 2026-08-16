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

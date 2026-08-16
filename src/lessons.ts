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

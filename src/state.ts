import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { LessonsStore } from './lessons.ts'
import { reportFileName, renderReport } from './report.ts'
import type { ReviewIndex, ReviewReport } from './types.ts'

export class ReviewState {
  readonly lessons: LessonsStore
  constructor(private baseDir: string) {
    this.lessons = new LessonsStore(baseDir)
  }

  private reportsDir() { return join(this.baseDir, 'reports') }

  async saveReport(report: ReviewReport): Promise<string> {
    await mkdir(this.reportsDir(), { recursive: true })
    const path = join(this.reportsDir(), reportFileName(report.sessionId))
    const tmp = path + '.tmp'
    await writeFile(tmp, renderReport(report), 'utf8')
    await rename(tmp, path)
    await this.touchIndex(report)
    return path
  }

  private async touchIndex(report: ReviewReport): Promise<void> {
    const index = await this.loadIndex()
    const now = new Date().toISOString()
    const existing = index.reports.find(item => item.sessionId === report.sessionId)
    if (existing) {
      existing.path = `reports/${reportFileName(report.sessionId)}`
      existing.updatedAt = now
    } else {
      index.reports.unshift({ sessionId: report.sessionId, path: `reports/${reportFileName(report.sessionId)}`, createdAt: now, updatedAt: now })
    }
    const tmp = this.indexFile() + '.tmp'
    await writeFile(tmp, JSON.stringify(index, null, 2), 'utf8')
    await rename(tmp, this.indexFile())
  }

  async loadIndex(): Promise<ReviewIndex> {
    try {
      const value = JSON.parse(await readFile(this.indexFile(), 'utf8'))
      return value && Array.isArray(value.reports) ? value : { reports: [] }
    } catch {
      return { reports: [] }
    }
  }

  private indexFile() { return join(this.baseDir, 'index.json') }
}

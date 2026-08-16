import { getChangedFiles, type GitRunner } from './git.ts'
import type { Lesson, ReviewReport } from './types.ts'

export interface SessionFacts {
  sessionId: string
  cwd: string
  title?: string
  decisions: string[]
  errors: string[]
  approvals: string[]
}

export async function buildReview(facts: SessionFacts, git: GitRunner, lessons: Lesson[] = []): Promise<ReviewReport> {
  const changedFiles = await getChangedFiles(git, facts.cwd)
  const title = facts.title ?? `会话复盘 ${facts.sessionId}`
  const filePreview = changedFiles.length === 0
    ? '没有文件改动。'
    : `改动 ${changedFiles.length} 个文件（${changedFiles.slice(0, 3).join('、')}${changedFiles.length > 3 ? ' 等' : ''}）。`
  const summaryParts = [filePreview]
  if (facts.errors.length > 0) summaryParts.push(`记录到 ${facts.errors.length} 个报错/卡点。`)
  if (facts.approvals.length > 0) summaryParts.push(`涉及 ${facts.approvals.length} 次审批。`)
  return {
    sessionId: facts.sessionId,
    title,
    summary: summaryParts.join(''),
    changedFiles,
    decisions: facts.decisions,
    errors: facts.errors,
    lessons,
  }
}

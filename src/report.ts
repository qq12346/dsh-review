import type { ReviewReport } from './types.ts'

export function reportFileName(sessionId: string): string {
  return `${sessionId}.md`
}

export function renderReport(report: ReviewReport): string {
  const lines: string[] = []
  lines.push(`# ${report.title}`, '')
  lines.push('## 会话摘要', '', report.summary, '')
  lines.push('## 改动文件', '')
  if (report.changedFiles.length === 0) lines.push('- （无文件改动）', '')
  else for (const file of report.changedFiles) lines.push(`- \`${file}\``)
  lines.push('', '## 关键决策', '')
  if (report.decisions.length === 0) lines.push('- （无记录）', '')
  else for (const item of report.decisions) lines.push(`- ${item}`)
  lines.push('', '## 报错 / 卡点', '')
  if (report.errors.length === 0) lines.push('- （无报错）', '')
  else for (const item of report.errors) lines.push(`- ${item}`)
  lines.push('', '## 本轮经验', '')
  if (report.lessons.length === 0) lines.push('- （无新经验）', '')
  else for (const lesson of report.lessons) lines.push(`- [${lesson.kind}] ${lesson.text}`)
  return lines.join('\n') + '\n'
}

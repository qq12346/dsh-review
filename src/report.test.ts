import { describe, expect, it } from 'vitest'
import { renderReport, reportFileName } from './report.ts'
import type { ReviewReport } from './types.ts'

describe('renderReport', () => {
  it('renders the standard sections', () => {
    const report: ReviewReport = {
      sessionId: 's1',
      title: '修复登录',
      summary: '做了登录修复',
      changedFiles: ['src/login.ts'],
      decisions: ['改用 token 校验'],
      errors: ['第一次调用超时'],
      lessons: [],
    }
    const md = renderReport(report)
    expect(md).toContain('# 修复登录')
    expect(md).toContain('## 改动文件')
    expect(md).toContain('src/login.ts')
    expect(md).toContain('## 关键决策')
    expect(md).toContain('## 报错 / 卡点')
  })

  it('generates a stable file name', () => {
    expect(reportFileName('s1')).toBe('s1.md')
  })
})

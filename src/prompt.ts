import type { SessionFacts } from './review.ts'

export function buildExtractionPrompt(facts: SessionFacts): string {
  return [
    '你是复盘助手。根据以下会话事实，输出 JSON 数组，每条经验含 text/kind/tags。',
    'kind 只能是 pitfall、decision、pattern。',
    `会话 id: ${facts.sessionId}`,
    `决策: ${facts.decisions.join('；') || '无'}`,
    `报错: ${facts.errors.join('；') || '无'}`,
    `审批: ${facts.approvals.join('；') || '无'}`,
    '只输出 JSON，不要解释。',
  ].join('\n')
}

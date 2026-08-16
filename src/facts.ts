export interface ClassifiedFact {
  kind: 'tool' | 'error' | 'approval'
  text: string
}

export interface ReducedFacts {
  decisions: string[]
  errors: string[]
  approvals: string[]
}

export function reduceSessionFacts(facts: ClassifiedFact[]): ReducedFacts {
  const seen = { decisions: new Set<string>(), errors: new Set<string>(), approvals: new Set<string>() }
  for (const fact of facts) {
    if (fact.kind === 'error') seen.errors.add(fact.text)
    if (fact.kind === 'approval') seen.approvals.add(fact.text)
    if (fact.kind === 'tool') seen.decisions.add(`使用工具 ${fact.text}`)
  }
  return { decisions: [...seen.decisions], errors: [...seen.errors], approvals: [...seen.approvals] }
}

import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import { reduceSessionFacts, type ClassifiedFact } from './facts.ts'
import type { SessionFacts } from './review.ts'

export function sessionToFacts(session: Session): SessionFacts {
  const classified = classifyEvents(session.events)
  const reduced = reduceSessionFacts(classified)
  return {
    sessionId: session.id,
    cwd: session.header.cwd ?? process.cwd(),
    decisions: reduced.decisions,
    errors: reduced.errors,
    approvals: reduced.approvals,
  }
}

function classifyEvents(events: readonly SessionEvent[]): ClassifiedFact[] {
  const classified: ClassifiedFact[] = []
  for (const event of events) {
    if (event.type === 'tool/call') classified.push({ kind: 'tool', text: event.data.name })
    if (event.type === 'tool/result' && event.data.error) classified.push({ kind: 'error', text: event.data.error.code })
    if (event.type.startsWith('approval/')) classified.push({ kind: 'approval', text: event.type })
  }
  return classified
}

import type { Context } from '@deepseek-ai/cordis'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { systemGit } from './git.ts'
import { buildReview, type SessionFacts } from './review.ts'
import { sessionToFacts } from './session-facts.ts'
import { ReviewState } from './state.ts'
import type { Lesson } from './types.ts'

export function registerEvents(
  ctx: Context,
  state: ReviewState,
  extract: (facts: SessionFacts) => Promise<Lesson[]>,
  onPersist: () => void,
): void {
  ctx.on('session/event', (session, event: SessionEvent) => {
    const type: string = event.type
    if (type !== 'turn/end' && type !== 'compaction/end') return
    const facts = sessionToFacts(session)
    void extract(facts)
      .then(lessons => state.lessons.upsert(lessons))
      .then(() => buildReview(facts, systemGit, []))
      .then(report => state.saveReport(report))
      .then(onPersist)
      .catch(() => {})
  })
}

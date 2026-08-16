import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = await mkdtemp(join(tmpdir(), 'dsh-review-verify-'))
try {
  const { LessonsStore, makeLesson } = await import('../lib/lessons.js')
  const store = new LessonsStore(dir)
  const lesson = makeLesson({ text: 'smoke', kind: 'pitfall', tags: ['x'], sourceSessionId: 's1' })
  await store.save([lesson])
  const loaded = await store.load()
  if (loaded.length !== 1 || loaded[0].text !== 'smoke') throw new Error('lessons smoke failed')
  console.log('verify ok')
} finally {
  await rm(dir, { recursive: true, force: true })
}

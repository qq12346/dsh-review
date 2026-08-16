import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LessonsStore, makeLesson } from './lessons.ts'

let dir: string
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'dsh-review-')) })
afterEach(async () => { await rm(dir, { recursive: true, force: true }) })

describe('LessonsStore', () => {
  it('saves and loads lessons atomically', async () => {
    const store = new LessonsStore(dir)
    const lesson = makeLesson({ text: '别直接改 lockfile', kind: 'pitfall', tags: ['git'], sourceSessionId: 's1' })
    await store.save([lesson])
    expect(await store.load()).toEqual([lesson])
  })

  it('upserts by id and renders lessons.md', async () => {
    const store = new LessonsStore(dir)
    const a = makeLesson({ text: 'old', kind: 'pitfall', tags: [], sourceSessionId: 's1' })
    await store.save([a])
    const result = await store.upsert([{ ...a, text: 'new' }])
    expect(result.updated).toBe(1)
    expect((await store.load())[0]?.text).toBe('new')
    const md = await readFile(join(dir, 'lessons.md'), 'utf8')
    expect(md).toContain('new')
  })

  it('searches by text or tag', async () => {
    const store = new LessonsStore(dir)
    await store.save([
      makeLesson({ text: '复用 git diff 做改动清单', kind: 'pattern', tags: ['git'], sourceSessionId: 's1' }),
      makeLesson({ text: '审批前先检查异常', kind: 'decision', tags: ['approval'], sourceSessionId: 's2' }),
    ])
    expect((await store.search('git')).length).toBe(1)
  })

  it('returns empty when file missing or corrupted', async () => {
    const store = new LessonsStore(dir)
    expect(await store.load()).toEqual([])
    await writeFile(join(dir, 'lessons.json'), 'not json', 'utf8')
    expect(await store.load()).toEqual([])
  })
})

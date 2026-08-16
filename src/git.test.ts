import { describe, expect, it } from 'vitest'
import { getChangedFiles, parseChangedFiles, type GitRunner } from './git.ts'

describe('parseChangedFiles', () => {
  it('splits porcelain output into file names', () => {
    expect(parseChangedFiles(' M src/index.ts\n?? README.md\n')).toEqual(['src/index.ts', 'README.md'])
  })

  it('handles renamed files with arrow syntax', () => {
    expect(parseChangedFiles('R  old.ts -> new.ts\n')).toEqual(['new.ts'])
  })
})

describe('getChangedFiles', () => {
  it('runs git status with porcelain format', async () => {
    let args: string[] = []
    const runner: GitRunner = { run: async (a) => { args = a; return ' M a.ts\n' } }
    expect(await getChangedFiles(runner, '/work')).toEqual(['a.ts'])
    expect(args).toEqual(['status', '--porcelain'])
  })
})

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface GitRunner {
  run(args: string[], cwd: string): Promise<string>
}

export const systemGit: GitRunner = {
  async run(args, cwd) {
    const { stdout } = await execFileAsync('git', args, { cwd })
    return stdout
  },
}

export async function getChangedFiles(runner: GitRunner, cwd: string): Promise<string[]> {
  const output = await runner.run(['status', '--porcelain'], cwd)
  return parseChangedFiles(output)
}

export async function getDiffStat(runner: GitRunner, cwd: string): Promise<string> {
  try {
    return await runner.run(['diff', '--stat'], cwd)
  } catch {
    return ''
  }
}

export function parseChangedFiles(output: string): string[] {
  return output
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => {
      const path = line.slice(3).trim()
      if (path.includes(' -> ')) return path.split(' -> ')[1]?.trim() ?? ''
      return path
    })
    .filter(Boolean)
}

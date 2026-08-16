import type { Context } from '@deepseek-ai/cordis'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { createUserMessage } from '@deepseek-ai/dsh-llm/message'
import { parseLessonsJson } from './parse.ts'
import { buildExtractionPrompt } from './prompt.ts'
import type { SessionFacts } from './review.ts'
import type { Lesson } from './types.ts'

export interface LlmConfig {
  provider: string
  model: string
}

export function makeExtractLessons(ctx: Context, cfg: LlmConfig): (facts: SessionFacts) => Promise<Lesson[]> {
  return async (facts) => {
    const options: GenerateOptions = {
      provider: cfg.provider,
      model: cfg.model,
      messages: [createUserMessage({ content: [{ type: 'text', text: buildExtractionPrompt(facts) }], source: { kind: 'plugin', plugin: 'dsh-review' } })],
      maxTokens: 800,
    }
    const text = await generateText(ctx, options)
    return parseLessonsJson(text, facts.sessionId)
  }
}

export async function generateText(ctx: Context, options: GenerateOptions): Promise<string> {
  let text = ''
  for await (const chunk of ctx.llm.stream(options)) {
    const item = chunk as StreamChunk
    if (item.type === 'text-delta') text += item.text
  }
  return text
}

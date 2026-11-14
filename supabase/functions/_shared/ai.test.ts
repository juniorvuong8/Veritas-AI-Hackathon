import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it, vi } from 'vitest'
import { AiError, createClaudeAiCaller, parseJsonObject, type ClaudeClient } from './ai.ts'
import type { ChatMessage } from './prompt.ts'

const lesson = { title_vi: 'x', n: 1 }

describe('parseJsonObject', () => {
  it('parses plain JSON', () => {
    expect(parseJsonObject(JSON.stringify(lesson))).toEqual(lesson)
  })
  it('parses JSON inside a ```json fence', () => {
    expect(parseJsonObject('```json\n' + JSON.stringify(lesson) + '\n```')).toEqual(lesson)
  })
  it('parses JSON surrounded by prose', () => {
    expect(parseJsonObject('Here you go: ' + JSON.stringify(lesson) + ' Enjoy!')).toEqual(lesson)
  })
  it('returns undefined for non-JSON', () => {
    expect(parseJsonObject('not json')).toBeUndefined()
  })
  it('returns undefined for a top-level array', () => {
    expect(parseJsonObject('[1,2]')).toBeUndefined()
  })
})

const messages: ChatMessage[] = [
  { role: 'system', content: 's' },
  { role: 'user', content: 'u' },
]

function fakeClient(result: unknown | (() => never)) {
  const create = vi.fn(async () => (typeof result === 'function' ? (result as () => never)() : result))
  return { client: { beta: { messages: { create } } } as unknown as ClaudeClient, create }
}

const reply = (text: string, stop_reason = 'end_turn') => ({
  stop_reason,
  content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }],
})

const apiError = (status: number) =>
  Anthropic.APIError.generate(status, { type: 'error', error: { type: 'x', message: 'm' } }, 'm', new Headers())

describe('createClaudeAiCaller', () => {
  it('sends the system prompt separately and returns the text', async () => {
    const { client, create } = fakeClient(reply('{"a":1}'))
    await expect(createClaudeAiCaller('k', { client })(messages)).resolves.toBe('{"a":1}')
    const [params, options] = create.mock.calls[0] as unknown as [Record<string, unknown>, Record<string, unknown>]
    expect(params.model).toBe('claude-opus-5-5')
    expect(params.system).toBe('s')
    expect(params.messages).toEqual([{ role: 'user', content: 'u' }])
    expect(params.max_tokens).toBe(8000)
    expect(params.output_config).toEqual({ effort: 'low' })
    expect(params.speed).toBe('fast')
    expect(params.fallbacks).toBe('default')
    expect(params.betas).toEqual(['server-side-fallback-2026-07-01'])
    expect(options).toEqual({ timeout: 25_000, maxRetries: 0 })
  })

  it('throws a retryable AiError 504 when Claude is too slow', async () => {
    const { client } = fakeClient(() => {
      throw new Anthropic.APIConnectionTimeoutError()
    })
    await expect(createClaudeAiCaller('k', { client })(messages)).rejects.toMatchObject({ name: 'AiError', status: 504 })
  })

  it('throws AiError 429 when rate-limited', async () => {
    const { client } = fakeClient(() => {
      throw apiError(429)
    })
    await expect(createClaudeAiCaller('k', { client })(messages)).rejects.toMatchObject({ name: 'AiError', status: 429 })
  })

  it('retries at standard speed when fast mode is rate-limited', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(apiError(429))
      .mockResolvedValueOnce(reply('{"a":1}'))
    const client = { beta: { messages: { create } } } as unknown as ClaudeClient
    await expect(createClaudeAiCaller('k', { client })(messages)).resolves.toBe('{"a":1}')
    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[0][0].speed).toBe('fast')
    expect(create.mock.calls[1][0].speed).toBe('standard')
  })

  it('throws AiError 402 when out of credits', async () => {
    const { client } = fakeClient(() => {
      throw apiError(402)
    })
    const call = createClaudeAiCaller('k', { client })
    await expect(call(messages)).rejects.toBeInstanceOf(AiError)
    await expect(call(messages)).rejects.toMatchObject({ status: 402 })
  })

  it('throws AiError 502 on a refusal, a cut-off answer, or no text', async () => {
    for (const r of [reply('{}', 'refusal'), reply('{"a":', 'max_tokens'), { stop_reason: 'end_turn', content: [] }]) {
      const { client } = fakeClient(r)
      await expect(createClaudeAiCaller('k', { client })(messages)).rejects.toMatchObject({ status: 502 })
    }
  })
})

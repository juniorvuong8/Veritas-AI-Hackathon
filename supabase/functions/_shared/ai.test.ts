import { describe, expect, it, vi } from 'vitest'
import { AiGatewayError, createLovableAiCaller, parseJsonObject } from './ai.ts'
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

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }))
}

describe('createLovableAiCaller', () => {
  it('posts to the gateway with both auth headers and JSON mode', async () => {
    const f = fakeFetch(200, { choices: [{ message: { content: '{"a":1}' } }] })
    const call = createLovableAiCaller('key123', f as unknown as typeof fetch)
    await expect(call(messages)).resolves.toBe('{"a":1}')
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://ai.gateway.lovable.dev/v1/chat/completions')
    expect(init.method).toBe('POST')
    const headers = new Headers(init.headers)
    expect(headers.get('Authorization')).toBe('Bearer key123')
    expect(headers.get('Lovable-API-Key')).toBe('key123')
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('google/gemini-3.7-flash')
    expect(body.messages).toEqual(messages)
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.max_tokens).toBe(8000)
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('throws a retryable AiGatewayError 504 when the gateway is too slow', async () => {
    const slow = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('timed out', 'TimeoutError')))
        }),
    )
    const call = createLovableAiCaller('k', slow as unknown as typeof fetch, undefined, 10)
    await expect(call(messages)).rejects.toMatchObject({ name: 'AiGatewayError', status: 504 })
  })

  it('throws AiGatewayError 429 when rate-limited', async () => {
    const call = createLovableAiCaller('k', fakeFetch(429, {}) as unknown as typeof fetch)
    await expect(call(messages)).rejects.toMatchObject({ name: 'AiGatewayError', status: 429 })
  })

  it('throws AiGatewayError 402 when out of credits', async () => {
    const call = createLovableAiCaller('k', fakeFetch(402, {}) as unknown as typeof fetch)
    await expect(call(messages)).rejects.toBeInstanceOf(AiGatewayError)
    await expect(call(messages)).rejects.toMatchObject({ status: 402 })
  })

  it('throws AiGatewayError 502 when the answer has no content', async () => {
    const call = createLovableAiCaller('k', fakeFetch(200, { choices: [] }) as unknown as typeof fetch)
    await expect(call(messages)).rejects.toMatchObject({ status: 502 })
  })
})

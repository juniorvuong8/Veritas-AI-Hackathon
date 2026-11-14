import Anthropic from '@anthropic-ai/sdk'
import type { ChatMessage } from './prompt.ts'

export const DEFAULT_MODEL = 'claude-opus-5-5'
/** Per-attempt limit: two attempts must fit inside the browser's request timeout (src/lib/api.ts). */
export const AI_TIMEOUT_MS = 25_000
/** Output cap (spec: usage guard). Generous, because thinking tokens count toward it. */
export const MAX_OUTPUT_TOKENS = 8000
/** Lessons are short and well specified, so low effort keeps answers fast without hurting quality. */
export const EFFORT = 'low'
/** Fast mode: the same model with up to ~2.5x faster output, at twice the per-token price. */
export const SPEED: 'fast' | 'standard' = 'fast'

export type AiCaller = (messages: ChatMessage[]) => Promise<string>

/** The part of the Anthropic client this module uses (lets tests pass a fake). */
export type ClaudeClient = { beta: { messages: { create: Anthropic['beta']['messages']['create'] } } }

/** An AI call failed. `status` follows HTTP: 429 rate limited, 402 out of credits, 504 too slow. */
export class AiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'AiError'
    this.status = status
  }
}

function toAiError(err: unknown, timeoutMs: number): unknown {
  if (err instanceof Anthropic.APIConnectionTimeoutError)
    return new AiError(504, `Claude did not answer within ${timeoutMs} ms`)
  if (err instanceof Anthropic.APIConnectionError) return err
  if (err instanceof Anthropic.APIError && typeof err.status === 'number')
    return new AiError(err.status, `Claude API returned ${err.status}: ${err.message}`)
  return err
}

export function createClaudeAiCaller(
  apiKey: string,
  opts: { client?: ClaudeClient; model?: string; timeoutMs?: number } = {},
): AiCaller {
  const timeoutMs = opts.timeoutMs ?? AI_TIMEOUT_MS
  const model = opts.model ?? DEFAULT_MODEL
  // No SDK retries: generateLesson retries once itself, inside the time budget.
  const client = opts.client ?? new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 0 })

  return async (messages) => {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
    const turns = messages
      .filter((m) => m.role === 'user')
      .map((m) => ({ role: 'user' as const, content: m.content }))

    const send = (speed: 'fast' | 'standard') =>
      client.beta.messages.create(
        {
          model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system,
          messages: turns,
          output_config: { effort: EFFORT },
          speed,
          // If a safety check declines the request, the API retries it on a suitable model in the same call.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        },
        { timeout: timeoutMs, maxRetries: 0 },
      )

    let res
    try {
      try {
        res = await send(SPEED)
      } catch (err) {
        // Fast mode has its own rate limit: when it is full, run at standard speed instead.
        if (SPEED === 'fast' && err instanceof Anthropic.RateLimitError) res = await send('standard')
        else throw err
      }
    } catch (err) {
      throw toAiError(err, timeoutMs)
    }

    if (res.stop_reason === 'refusal') throw new AiError(502, 'Claude declined the request')
    if (res.stop_reason === 'max_tokens') throw new AiError(502, 'Claude hit the output limit')
    const text = res.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
    if (text.trim() === '') throw new AiError(502, 'Claude returned no text')
    return text
  }
}

function asObject(v: unknown): Record<string, unknown> | undefined {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** Parse a JSON object from model text, tolerating code fences or prose around it. */
export function parseJsonObject(text: string): unknown | undefined {
  const direct = tryParse(text)
  if (direct !== undefined) return asObject(direct)
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return undefined
  return asObject(tryParse(text.slice(start, end + 1)))
}

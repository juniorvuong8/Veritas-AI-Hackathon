import type { ChatMessage } from './prompt.ts'

export const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions'
export const DEFAULT_MODEL = 'google/gemini-3.7-flash'

export type AiCaller = (messages: ChatMessage[]) => Promise<string>

export class AiGatewayError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'AiGatewayError'
    this.status = status
  }
}

export function createLovableAiCaller(
  apiKey: string,
  fetchFn: typeof fetch = fetch,
  model: string = DEFAULT_MODEL,
): AiCaller {
  return async (messages) => {
    const res = await fetchFn(LOVABLE_AI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Lovable-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, response_format: { type: 'json_object' } }),
    })
    if (!res.ok) throw new AiGatewayError(res.status, `AI gateway returned ${res.status}`)
    const data = (await res.json().catch(() => null)) as
      | { choices?: { message?: { content?: unknown } }[] }
      | null
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.trim() === '')
      throw new AiGatewayError(502, 'AI gateway returned no content')
    return content
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

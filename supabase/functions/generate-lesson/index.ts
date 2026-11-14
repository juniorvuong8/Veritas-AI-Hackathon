// Supabase Edge Function: POST { scenarioId, words, level } -> Lesson | ErrorBody
import { createClaudeAiCaller } from '../_shared/ai.ts'
import { ERRORS, generateLesson } from '../_shared/generate.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(400, { code: 'bad_request', message_vi: ERRORS.bad_request.message_vi })
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set')
    return json(502, { code: 'ai_failed', message_vi: ERRORS.ai_failed.message_vi })
  }

  try {
    const result = await generateLesson(body, createClaudeAiCaller(apiKey))
    return json(result.status, result.body)
  } catch (err) {
    // Keep CORS headers on unexpected failures so the browser shows our message, not a network error.
    console.error('generate-lesson: unexpected error', err)
    return json(502, { code: 'ai_failed', message_vi: ERRORS.ai_failed.message_vi })
  }
})

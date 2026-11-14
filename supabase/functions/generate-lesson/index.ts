// Supabase Edge Function: POST { scenarioId, words, level } -> Lesson | ErrorBody
import { createLovableAiCaller } from '../_shared/ai.ts'
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

  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) {
    console.error('LOVABLE_API_KEY is not set')
    return json(502, { code: 'ai_failed', message_vi: ERRORS.ai_failed.message_vi })
  }

  const result = await generateLesson(body, createLovableAiCaller(apiKey))
  return json(result.status, result.body)
})

// Generates the LLM lessons through the app's own code (costs money): npm run eval:llm [-- --only <caseId>]
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { AI_TIMEOUT_MS, createClaudeAiCaller, type ClaudeClient } from '../../supabase/functions/_shared/ai.ts'
import { generateLesson } from '../../supabase/functions/_shared/generate.ts'
import type { Lesson } from '../../supabase/functions/_shared/types.ts'
import { readEnvKey } from '../lib/env.ts'
import { runCases } from '../lib/runner.ts'
import type { EvalCase, ResultsFile, RunResult } from '../lib/types.ts'
import { EVAL_DIR, ROOT, readJson, writeJsonAtomic } from './io.ts'

const apiKey = readEnvKey(readFileSync(join(ROOT, 'supabase/.env'), 'utf8'), 'ANTHROPIC_API_KEY')
if (!apiKey) {
  console.error('ANTHROPIC_API_KEY is missing from supabase/.env')
  process.exit(1)
}

const onlyIdx = process.argv.indexOf('--only')
const only = onlyIdx !== -1 ? process.argv[onlyIdx + 1] : undefined
const allCases = readJson<EvalCase[]>(join(EVAL_DIR, 'cases.json'))
const cases = only ? allCases.filter((c) => c.id === only) : allCases
if (cases.length === 0) {
  console.error(`no case with id ${only}`)
  process.exit(1)
}

// Wrap the real client to add up token usage for the cost report.
const PRICES = { fast: { in: 8, out: 40 }, standard: { in: 4, out: 20 } } as const
const totals = { input: 0, output: 0, cost: 0, calls: 0 }
const real = new Anthropic({ apiKey, timeout: AI_TIMEOUT_MS, maxRetries: 0 })
const client: ClaudeClient = {
  beta: {
    messages: {
      create: (async (...args: Parameters<ClaudeClient['beta']['messages']['create']>) => {
        const res = await real.beta.messages.create(...args)
        const u = (res as { usage?: { input_tokens: number; output_tokens: number; speed?: string } }).usage
        if (u) {
          const p = u.speed === 'standard' ? PRICES.standard : PRICES.fast
          totals.input += u.input_tokens
          totals.output += u.output_tokens
          totals.cost += (u.input_tokens * p.in + u.output_tokens * p.out) / 1_000_000
          totals.calls++
        }
        return res
      }) as ClaudeClient['beta']['messages']['create'],
    },
  },
}
const callAi = createClaudeAiCaller(apiKey, { client })

const outPath = join(EVAL_DIR, 'results/llm.json')
const existing = readJson<ResultsFile>(outPath, {})

const results = await runCases(
  cases,
  existing,
  async (c): Promise<RunResult> => {
    const started = Date.now()
    const r = await generateLesson({ scenarioId: c.scenarioId, words: c.words, level: c.level }, callAi)
    const secs = ((Date.now() - started) / 1000).toFixed(1)
    if (r.status === 200) {
      console.log(`  ok    ${c.id}  (${secs}s)`)
      return { ok: true, lesson: r.body as Lesson }
    }
    const code = 'code' in r.body ? r.body.code : `status_${r.status}`
    console.log(`  FAIL  ${c.id}  ${code}  (${secs}s)`)
    return { ok: false, code }
  },
  (all) => writeJsonAtomic(outPath, all),
)

const done = cases.filter((c) => results[c.id]?.ok).length
console.log(`\nllm: ${done}/${cases.length} ok · ${totals.calls} API calls · ${totals.input} in / ${totals.output} out tokens · ~$${totals.cost.toFixed(2)}`)

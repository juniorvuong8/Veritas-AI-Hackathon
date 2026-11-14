import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css'
import cases from '../cases.json'
import baseline from '../results/baseline.json'
import llm from '../results/llm.json'
import type { EvalCase, ResultsFile } from '../lib/types'
import { RatingApp } from './RatingApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RatingApp
      cases={cases as EvalCase[]}
      results={{ baseline: baseline as unknown as ResultsFile, llm: llm as unknown as ResultsFile }}
    />
  </StrictMode>,
)

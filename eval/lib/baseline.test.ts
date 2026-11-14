import { describe, expect, it } from 'vitest'
import { SCENARIOS } from '@shared/scenarios.ts'
import { checkLesson } from '@shared/validate-lesson.ts'
import casesJson from '../cases.json'
import dictJson from '../baseline/dictionary.json'
import templatesJson from '../baseline/templates.json'
import { buildBaselineLesson, type Dictionary, type Templates } from './baseline'
import type { EvalCase } from './types'

const cases = casesJson as EvalCase[]
const dict = dictJson as Dictionary
const templates = templatesJson as Templates

describe('baseline', () => {
  it('produces a lesson that passes the app checks for every case', () => {
    for (const c of cases) {
      const r = checkLesson(buildBaselineLesson(c, dict, templates), c)
      expect(r.ok ? [] : r.errors, c.id).toEqual([])
    }
  })

  it('has a dictionary entry and a line at every level for every suggested word', () => {
    for (const s of SCENARIOS) {
      for (const w of s.suggestedWords) {
        expect(dict.words[w], w).toBeDefined()
        for (const level of ['1', '2', '3'] as const) {
          expect(templates[s.id].levels[level].words[w], `${s.id} L${level} ${w}`).toBeDefined()
        }
      }
    }
  })

  it('maps every Vietnamese case word to English', () => {
    for (const c of cases.filter((x) => x.set === 'B')) {
      const vi = c.words.at(-1)!
      expect(dict.vi_to_en[vi], vi).toBeTruthy()
    }
  })

  it('teaches the English word for a Vietnamese input', () => {
    const c = cases.find((x) => x.id === 'cafe-B-L1')!
    const lesson = buildBaselineLesson(c, dict, templates)
    const v = lesson.vocab.find((x) => x.input === 'hóa đơn')!
    expect(v.word).toBe('receipt')
    expect(lesson.lines.some((l) => l.text.includes('receipt'))).toBe(true)
  })

  it('is deterministic', () => {
    const c = cases[5]
    expect(buildBaselineLesson(c, dict, templates)).toEqual(buildBaselineLesson(c, dict, templates))
  })
})

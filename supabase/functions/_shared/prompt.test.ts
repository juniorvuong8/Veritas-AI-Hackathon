import { describe, expect, it } from 'vitest'
import { buildMessages } from './prompt.ts'
import { getScenario } from './scenarios.ts'
import { validRequest } from './test-fixtures.ts'

const cafe = getScenario('cafe')!

describe('buildMessages', () => {
  it('returns a system and a user message', () => {
    const msgs = buildMessages(cafe, validRequest)
    expect(msgs.map((m) => m.role)).toEqual(['system', 'user'])
  })

  it('system message defines all three levels and the JSON fields', () => {
    const [system] = buildMessages(cafe, validRequest)
    expect(system.content).toContain('Level 1')
    expect(system.content).toContain('Level 2')
    expect(system.content).toContain('Level 3')
    expect(system.content).toContain('"input"')
    expect(system.content).toContain('"answer_index"')
  })

  it('user message names the words and the level', () => {
    const [, user] = buildMessages(cafe, { ...validRequest, level: 2 })
    expect(user.content).toContain(JSON.stringify(validRequest.words))
    expect(user.content).toContain('Level: 2')
    expect(user.content).toContain(cafe.promptContext)
  })
})

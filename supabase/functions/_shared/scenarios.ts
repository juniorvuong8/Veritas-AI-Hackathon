export interface Scenario {
  id: string
  emoji: string
  name_vi: string
  /** English description of the situation, used in the AI prompt. */
  promptContext: string
  suggestedWords: string[]
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'cafe',
    emoji: '☕',
    name_vi: 'Quán cà phê',
    promptContext: 'ordering drinks at a café in an English-speaking city',
    suggestedWords: [
      'menu',
      'to go',
      'receipt',
      'medium',
      'large',
      'refill',
      'straw',
      'iced',
      'napkin',
      'order',
      'change',
      'for here',
    ],
  },
]

export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id)
}

/** NFC-normalize, trim and collapse inner whitespace. Keeps the learner's casing. */
export function normalizeWord(w: string): string {
  return w.normalize('NFC').trim().replace(/\s+/g, ' ')
}

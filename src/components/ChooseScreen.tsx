import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addWord, canSubmit, toggleWord } from '@/lib/selection'
import { cn } from '@/lib/utils'
import { SCENARIOS, getScenario, normalizeWord } from '@shared/scenarios.ts'
import type { LessonRequest, Level } from '@shared/types.ts'
import { MAX_WORDS, MIN_WORDS, isValidWord } from '@shared/validate-request.ts'

const LEVELS: { level: Level; label: string }[] = [
  { level: 1, label: 'Cấp 1: chỉ từ mới bằng tiếng Anh' },
  { level: 2, label: 'Cấp 2: thêm cụm từ tiếng Anh ngắn' },
  { level: 3, label: 'Cấp 3: cả câu tiếng Anh, có dịch' },
]

const key = (w: string) => normalizeWord(w).toLowerCase()

export function ChooseScreen(props: { initial?: LessonRequest; onSubmit: (req: LessonRequest) => void }) {
  const [scenarioId, setScenarioId] = useState<string | undefined>(props.initial?.scenarioId)
  const [words, setWords] = useState<string[]>(props.initial?.words ?? [])
  const [level, setLevel] = useState<Level>(props.initial?.level ?? 1)
  const [custom, setCustom] = useState('')
  const [customError, setCustomError] = useState<string | undefined>()

  const scenario = scenarioId ? getScenario(scenarioId) : undefined
  const suggested = scenario?.suggestedWords ?? []
  const customWords = words.filter((w) => !suggested.some((s) => key(s) === key(w)))
  const isSelected = (w: string) => words.some((s) => key(s) === key(w))

  function pickScenario(id: string) {
    if (id !== scenarioId) setWords([])
    setScenarioId(id)
  }

  function addCustom(e: FormEvent) {
    e.preventDefault()
    if (!isValidWord(normalizeWord(custom))) {
      setCustomError('Từ chỉ được dùng chữ cái, khoảng trắng, dấu gạch ngang hoặc dấu nháy (tối đa 30 ký tự).')
      return
    }
    setCustomError(undefined)
    setWords((ws) => addWord(ws, custom))
    setCustom('')
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">1. Chọn tình huống</h2>
        <div className="grid grid-cols-2 gap-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === scenarioId}
              onClick={() => pickScenario(s.id)}
              className={cn(
                'rounded-xl border p-3 text-left transition-colors',
                s.id === scenarioId ? 'border-primary bg-primary/10' : 'hover:bg-muted',
              )}
            >
              <span className="mr-2 text-xl" aria-hidden>
                {s.emoji}
              </span>
              {s.name_vi}
            </button>
          ))}
        </div>
      </section>

      {scenario && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. Chọn từ vựng</h2>
          <p className="text-sm text-muted-foreground">
            Đã chọn {words.length}/{MAX_WORDS} từ (cần ít nhất {MIN_WORDS})
          </p>
          <div className="flex flex-wrap gap-2">
            {suggested.map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={isSelected(w)}
                onClick={() => setWords((ws) => toggleWord(ws, w))}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm transition-colors',
                  isSelected(w) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                {w}
              </button>
            ))}
            {customWords.map((w) => (
              <span
                key={w}
                className="flex items-center gap-1 rounded-full border border-primary bg-primary px-3 py-1 text-sm text-primary-foreground"
              >
                <span>{w}</span>
                <button
                  type="button"
                  aria-label={`Bỏ ${w}`}
                  onClick={() => setWords((ws) => ws.filter((x) => x !== w))}
                  className="ml-1 opacity-80 hover:opacity-100"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <form onSubmit={addCustom} className="flex gap-2">
            <Input
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value)
                setCustomError(undefined)
              }}
              aria-invalid={customError ? true : undefined}
              placeholder="Thêm từ của bạn (tiếng Anh hoặc tiếng Việt)"
              maxLength={30}
            />
            <Button type="submit" variant="outline" disabled={!custom.trim() || words.length >= MAX_WORDS}>
              Thêm
            </Button>
          </form>
          {customError && (
            <p role="alert" className="text-sm text-destructive">
              {customError}
            </p>
          )}
        </section>
      )}

      {scenario && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">3. Chọn cấp độ</h2>
          <div className="grid gap-2">
            {LEVELS.map((l) => (
              <button
                key={l.level}
                type="button"
                aria-pressed={l.level === level}
                onClick={() => setLevel(l.level)}
                className={cn(
                  'rounded-xl border p-3 text-left text-sm transition-colors',
                  l.level === level ? 'border-primary bg-primary/10' : 'hover:bg-muted',
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <Button
        className="w-full"
        size="lg"
        disabled={!scenario || !canSubmit(words)}
        onClick={() => scenario && props.onSubmit({ scenarioId: scenario.id, words, level })}
      >
        Tạo hội thoại
      </Button>
    </div>
  )
}

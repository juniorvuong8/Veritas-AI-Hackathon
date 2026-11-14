import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addWord, canSubmit, toggleWord } from '@/lib/selection'
import { cn } from '@/lib/utils'
import { getScenario, normalizeWord } from '@shared/scenarios.ts'
import { MAX_WORDS, MIN_WORDS, isValidWord } from '@shared/validate-request.ts'

const key = (w: string) => normalizeWord(w).toLowerCase()
const INVALID_WORD = 'Từ chỉ được dùng chữ cái, khoảng trắng, dấu gạch ngang hoặc dấu nháy (tối đa 30 ký tự).'

export function WordPicker(props: {
  scenarioId: string
  initialWords?: string[]
  submitLabel: string
  onSubmit: (words: string[]) => void
}) {
  const [words, setWords] = useState<string[]>(props.initialWords ?? [])
  const [custom, setCustom] = useState('')
  const [customError, setCustomError] = useState<string | undefined>()

  const suggested = getScenario(props.scenarioId)?.suggestedWords ?? []
  const customWords = words.filter((w) => !suggested.some((s) => key(s) === key(w)))
  const isSelected = (w: string) => words.some((s) => key(s) === key(w))

  function addCustom(e: FormEvent) {
    e.preventDefault()
    if (!isValidWord(normalizeWord(custom))) {
      setCustomError(INVALID_WORD)
      return
    }
    setCustomError(undefined)
    setWords((ws) => addWord(ws, custom))
    setCustom('')
  }

  return (
    <div className="space-y-3">
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
              isSelected(w) ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
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
      <Button className="w-full" size="lg" disabled={!canSubmit(words)} onClick={() => props.onSubmit(words)}>
        {props.submitLabel}
      </Button>
    </div>
  )
}

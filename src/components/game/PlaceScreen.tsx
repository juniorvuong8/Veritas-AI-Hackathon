import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FALLBACK_LESSONS } from '@/data/fallback-lessons'
import { PLACE_ART, PLAYER_EMOJI } from '@/game/art'
import { COINS_PER_CORRECT } from '@/game/state'
import { requestLesson, type LessonResult } from '@/lib/api'
import { getScenario } from '@shared/scenarios.ts'
import type { Lesson, LessonRequest, Level } from '@shared/types.ts'
import { Conversation } from './Conversation'
import { HostQuiz } from './HostQuiz'
import { SpeechBubble } from './SpeechBubble'
import { WordNotes } from './WordNotes'
import { WordPicker } from './WordPicker'

type ErrorCode = Extract<LessonResult, { ok: false }>['code']
type Phase =
  | { name: 'pick' }
  | { name: 'loading' }
  | { name: 'error'; code: ErrorCode; message_vi: string }
  | { name: 'talk' | 'notes' | 'quiz'; lesson: Lesson; isSample: boolean }
  | { name: 'done'; correct: number; total: number }

export function PlaceScreen(props: {
  placeId: string
  level: Level
  initialWords: string[]
  onWordsChosen: (words: string[]) => void
  onCorrect: () => void
  onFinish: () => void
  onLeave: () => void
}) {
  const scenario = getScenario(props.placeId)!
  const art = PLACE_ART[props.placeId]
  const [phase, setPhase] = useState<Phase>({ name: 'pick' })
  const [words, setWords] = useState<string[]>(props.initialWords)
  const [earned, setEarned] = useState(0)

  async function generate(chosen: string[]) {
    const req: LessonRequest = { scenarioId: props.placeId, words: chosen, level: props.level }
    setPhase({ name: 'loading' })
    const result = await requestLesson(req)
    setPhase(
      result.ok
        ? { name: 'talk', lesson: result.lesson, isSample: false }
        : { name: 'error', code: result.code, message_vi: result.message_vi },
    )
  }

  const host = (text: string) => (
    <SpeechBubble speaker="" side="host" avatar={art.host}>
      <p>{text}</p>
    </SpeechBubble>
  )

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <span className="text-3xl" aria-hidden>
            {art.sign}
          </span>
          {scenario.name_vi}
          {'lesson' in phase && phase.isSample && <Badge variant="secondary">Bài mẫu</Badge>}
        </h2>
        {phase.name !== 'done' && (
          <Button variant="ghost" size="sm" onClick={props.onLeave}>
            Rời đi
          </Button>
        )}
      </header>

      {phase.name === 'pick' && (
        <div className="space-y-4">
          {host(art.greeting_vi)}
          <WordPicker
            scenarioId={props.placeId}
            initialWords={words}
            submitLabel="Bắt đầu hội thoại"
            onSubmit={(chosen) => {
              setWords(chosen)
              props.onWordsChosen(chosen)
              void generate(chosen)
            }}
          />
        </div>
      )}

      {phase.name === 'loading' && (
        <div role="status">
          <SpeechBubble speaker="" side="host" avatar={art.host}>
            <p className="flex items-center gap-2">
              <span className="inline-flex gap-1" aria-hidden>
                <span className="size-1.5 animate-bounce rounded-full bg-current" />
                <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
              </span>
              Đang chuẩn bị…
            </p>
          </SpeechBubble>
        </div>
      )}

      {phase.name === 'error' && (
        <div className="space-y-4" role="alert">
          {host(phase.message_vi)}
          <div className="flex flex-col gap-2 sm:flex-row">
            {phase.code !== 'bad_request' && <Button onClick={() => generate(words)}>Thử lại</Button>}
            <Button
              variant="outline"
              onClick={() => setPhase({ name: 'talk', lesson: FALLBACK_LESSONS[props.level], isSample: true })}
            >
              Xem bài mẫu
            </Button>
            <Button variant="ghost" onClick={() => setPhase({ name: 'pick' })}>
              Chọn lại từ
            </Button>
          </div>
        </div>
      )}

      {phase.name === 'talk' && (
        <Conversation
          lesson={phase.lesson}
          hostAvatar={art.host}
          playerAvatar={PLAYER_EMOJI}
          onDone={() => setPhase({ ...phase, name: 'notes' })}
        />
      )}

      {phase.name === 'notes' && (
        <WordNotes lesson={phase.lesson} onStartQuiz={() => setPhase({ ...phase, name: 'quiz' })} />
      )}

      {phase.name === 'quiz' && (
        <HostQuiz
          quiz={phase.lesson.quiz}
          hostAvatar={art.host}
          onCorrect={() => {
            setEarned((n) => n + COINS_PER_CORRECT)
            props.onCorrect()
          }}
          onFinish={(r) => setPhase({ name: 'done', ...r })}
        />
      )}

      {phase.name === 'done' && (
        <div className="space-y-4 text-center">
          <p className="text-2xl font-semibold">{`Bạn trả lời đúng ${phase.correct}/${phase.total} câu`}</p>
          <p className="text-lg">{`+${earned} 🪙`}</p>
          <div className="mx-auto flex size-24 animate-[stamp_400ms_ease-out] items-center justify-center rounded-full border-4 border-dashed border-primary text-5xl">
            {art.sign}
          </div>
          <p className="text-sm text-muted-foreground">Bạn đã nhận được con dấu!</p>
          <Button className="w-full" size="lg" onClick={props.onFinish}>
            Về thành phố
          </Button>
        </div>
      )}
    </div>
  )
}

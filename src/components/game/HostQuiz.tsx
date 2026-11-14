import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { scoreQuiz } from '@/lib/quiz'
import { cn } from '@/lib/utils'
import { COINS_PER_CORRECT } from '@/game/state'
import type { QuizQuestion } from '@shared/types.ts'
import { SpeechBubble } from './SpeechBubble'

export function HostQuiz(props: {
  quiz: QuizQuestion[]
  hostAvatar: string
  onCorrect: () => void
  onFinish: (result: { correct: number; total: number }) => void
}) {
  const { quiz } = props
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const q = quiz[index]
  const chosen = answers[index]
  const answered = chosen !== undefined
  const right = answered && chosen === q.answer_index
  const isLast = index === quiz.length - 1

  function choose(i: number) {
    if (answered) return
    setAnswers((a) => Object.assign([...a], { [index]: i }))
    if (i === q.answer_index) props.onCorrect()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{`Câu ${index + 1} / ${quiz.length}`}</p>
        <Progress value={((index + (answered ? 1 : 0)) / quiz.length) * 100} />
      </div>
      <SpeechBubble speaker="" side="host" avatar={props.hostAvatar}>
        <p className="font-medium">{q.question_vi}</p>
      </SpeechBubble>
      <div className="grid gap-2">
        {q.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            disabled={answered}
            onClick={() => choose(i)}
            className={cn(
              'rounded-xl border bg-background p-3 text-left transition-colors disabled:cursor-default',
              !answered && 'hover:bg-muted',
              answered && i === q.answer_index && 'border-green-600 bg-green-600/10',
              answered && i === chosen && i !== q.answer_index && 'border-red-600 bg-red-600/10',
            )}
          >
            {opt}
          </button>
        ))}
      </div>
      {answered && (
        <SpeechBubble speaker="" side="host" avatar={props.hostAvatar}>
          <p className={cn('font-semibold', right ? 'text-green-700' : 'text-red-700')}>
            {right ? 'Đúng rồi!' : 'Chưa đúng.'}
            {right && <span className="ml-2 inline-block animate-bounce text-amber-600">{`+${COINS_PER_CORRECT} 🪙`}</span>}
          </p>
          <p className="text-sm">{q.explanation_vi}</p>
        </SpeechBubble>
      )}
      {answered && (
        <Button
          className="w-full"
          onClick={() => (isLast ? props.onFinish(scoreQuiz(quiz, answers)) : setIndex(index + 1))}
        >
          {isLast ? 'Xem kết quả' : 'Câu tiếp theo'}
        </Button>
      )}
    </div>
  )
}

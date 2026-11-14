import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { scoreQuiz } from '@/lib/quiz'
import { cn } from '@/lib/utils'
import type { QuizQuestion } from '@shared/types.ts'

export function QuizScreen(props: { quiz: QuizQuestion[]; onNewConversation: () => void }) {
  const { quiz } = props
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [finished, setFinished] = useState(false)

  if (finished) {
    const { correct, total } = scoreQuiz(quiz, answers)
    return (
      <div className="space-y-6 text-center">
        <p className="text-2xl font-semibold">{`Bạn trả lời đúng ${correct}/${total} câu`}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            onClick={() => {
              setAnswers([])
              setIndex(0)
              setFinished(false)
            }}
          >
            Thử lại
          </Button>
          <Button onClick={props.onNewConversation}>Hội thoại mới</Button>
        </div>
      </div>
    )
  }

  const q = quiz[index]
  const chosen = answers[index]
  const answered = chosen !== undefined
  const isLast = index === quiz.length - 1

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{`Câu ${index + 1} / ${quiz.length}`}</p>
        <Progress value={((index + (answered ? 1 : 0)) / quiz.length) * 100} />
      </div>
      <p className="text-lg font-medium">{q.question_vi}</p>
      <div className="grid gap-2">
        {q.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            disabled={answered}
            onClick={() => setAnswers((a) => Object.assign([...a], { [index]: i }))}
            className={cn(
              'rounded-xl border p-3 text-left transition-colors disabled:cursor-default',
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
        <Card>
          <CardContent className="space-y-1">
            <p className={cn('font-semibold', chosen === q.answer_index ? 'text-green-700' : 'text-red-700')}>
              {chosen === q.answer_index ? 'Đúng rồi!' : 'Chưa đúng.'}
            </p>
            <p className="text-sm">{q.explanation_vi}</p>
          </CardContent>
        </Card>
      )}
      {answered && (
        <Button className="w-full" onClick={() => (isLast ? setFinished(true) : setIndex(index + 1))}>
          {isLast ? 'Xem kết quả' : 'Câu tiếp theo'}
        </Button>
      )}
    </div>
  )
}

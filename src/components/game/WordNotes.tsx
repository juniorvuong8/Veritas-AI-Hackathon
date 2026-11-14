import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SpeakButton } from '@/components/SpeakButton'
import type { Lesson } from '@shared/types.ts'

export function WordNotes(props: { lesson: Lesson; onStartQuiz: () => void }) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Giải thích từ</h3>
      {props.lesson.vocab.map((v) => (
        <Card key={`${v.input}-${v.word}`}>
          <CardContent className="space-y-1">
            <p className="font-semibold">
              {v.word} <SpeakButton text={v.word} />
              <span className="font-normal text-muted-foreground"> · {v.meaning_vi}</span>
            </p>
            <p className="text-sm">{v.usage_vi}</p>
          </CardContent>
        </Card>
      ))}
      <Button className="w-full" size="lg" onClick={props.onStartQuiz}>
        Làm bài kiểm tra
      </Button>
    </div>
  )
}

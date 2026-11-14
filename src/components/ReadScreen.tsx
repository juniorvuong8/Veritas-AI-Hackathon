import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { splitHighlights } from '@/lib/highlight'
import type { Lesson } from '@shared/types.ts'
import { SpeakButton } from './SpeakButton'

export function ReadScreen(props: { lesson: Lesson; isSample?: boolean; onStartQuiz: () => void }) {
  const { lesson } = props
  const words = lesson.vocab.map((v) => v.word)
  const mapped = lesson.vocab.filter((v) => v.input.toLowerCase() !== v.word.toLowerCase())

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold">{lesson.title_vi}</h2>
        {props.isSample && <Badge variant="secondary">Bài mẫu</Badge>}
      </div>

      {mapped.length > 0 && (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {mapped.map((v) => (
            <li key={v.input}>{`${v.input} → ${v.word}`}</li>
          ))}
        </ul>
      )}

      <Card>
        <CardContent className="space-y-3 leading-relaxed">
          {lesson.lines.map((line, i) => (
            <div key={i}>
              <p>
                <span className="font-semibold">{line.speaker_vi}:</span>{' '}
                {splitHighlights(line.text, words).map((seg, j) =>
                  seg.word ? (
                    <span key={j} className="whitespace-nowrap">
                      <mark className="rounded bg-amber-200/70 px-0.5 font-semibold text-foreground underline decoration-amber-500 dark:bg-amber-400/30">
                        {seg.text}
                      </mark>
                      <SpeakButton text={seg.word} />
                    </span>
                  ) : (
                    <span key={j}>{seg.text}</span>
                  ),
                )}
              </p>
              {line.translation_vi && (
                <p className="text-sm italic text-muted-foreground">{line.translation_vi}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h3 className="font-semibold">Giải thích từ</h3>
        {lesson.vocab.map((v) => (
          <Card key={v.word}>
            <CardContent className="space-y-1">
              <p className="font-semibold">
                {v.word} <SpeakButton text={v.word} />
                <span className="font-normal text-muted-foreground"> · {v.meaning_vi}</span>
              </p>
              <p className="text-sm">{v.usage_vi}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Button className="w-full" size="lg" onClick={props.onStartQuiz}>
        Làm bài kiểm tra
      </Button>
    </div>
  )
}

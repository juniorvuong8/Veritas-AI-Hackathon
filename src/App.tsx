import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ChooseScreen } from '@/components/ChooseScreen'
import { QuizScreen } from '@/components/QuizScreen'
import { ReadScreen } from '@/components/ReadScreen'
import { FALLBACK_LESSONS } from '@/data/fallback-lessons'
import { requestLesson } from '@/lib/api'
import type { Lesson, LessonRequest } from '@shared/types.ts'
import type { LessonResult } from '@/lib/api'

type State =
  | { screen: 'choose' }
  | { screen: 'loading' }
  | { screen: 'error'; code: Extract<LessonResult, { ok: false }>['code']; message_vi: string }
  | { screen: 'read'; lesson: Lesson; isSample: boolean }
  | { screen: 'quiz'; lesson: Lesson }

function App() {
  const [state, setState] = useState<State>({ screen: 'choose' })
  const [request, setRequest] = useState<LessonRequest | undefined>()

  async function generate(req: LessonRequest) {
    setRequest(req)
    setState({ screen: 'loading' })
    const result = await requestLesson(req)
    setState(
      result.ok
        ? { screen: 'read', lesson: result.lesson, isSample: false }
        : { screen: 'error', code: result.code, message_vi: result.message_vi },
    )
  }

  return (
    <main className="mx-auto min-h-svh max-w-2xl px-4 py-6 sm:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Học từ qua hội thoại</h1>
        <p className="text-sm text-muted-foreground">Học tiếng Anh qua những tình huống hằng ngày</p>
      </header>

      {state.screen === 'choose' && <ChooseScreen initial={request} onSubmit={generate} />}

      {state.screen === 'loading' && (
        <div className="flex flex-col items-center gap-4 py-16" role="status">
          <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p>Đang tạo hội thoại…</p>
        </div>
      )}

      {state.screen === 'error' && request && (
        <Card>
          <CardContent className="space-y-4">
            <p role="alert">{state.message_vi}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              {state.code !== 'bad_request' && <Button onClick={() => generate(request)}>Thử lại</Button>}
              <Button
                variant="outline"
                onClick={() =>
                  setState({ screen: 'read', lesson: FALLBACK_LESSONS[request.level], isSample: true })
                }
              >
                Xem bài mẫu
              </Button>
              <Button variant="ghost" onClick={() => setState({ screen: 'choose' })}>
                Chọn lại
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {state.screen === 'read' && (
        <ReadScreen
          lesson={state.lesson}
          isSample={state.isSample}
          onStartQuiz={() => setState({ screen: 'quiz', lesson: state.lesson })}
        />
      )}

      {state.screen === 'quiz' && (
        <QuizScreen quiz={state.lesson.quiz} onNewConversation={() => setState({ screen: 'choose' })} />
      )}
    </main>
  )
}

export default App

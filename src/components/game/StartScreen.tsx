import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Level } from '@shared/types.ts'

const LEVELS: { level: Level; label: string }[] = [
  { level: 1, label: 'Cấp 1: chỉ từ mới bằng tiếng Anh' },
  { level: 2, label: 'Cấp 2: thêm cụm từ tiếng Anh ngắn' },
  { level: 3, label: 'Cấp 3: cả câu tiếng Anh, có dịch' },
]

export function StartScreen(props: { hasSave: boolean; onContinue: () => void; onNewGame: (level: Level) => void }) {
  const [level, setLevel] = useState<Level>(1)
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <p className="text-5xl" aria-hidden>
          🏙️
        </p>
        <h1 className="text-2xl font-bold">Học từ qua hội thoại</h1>
        <p className="text-muted-foreground">
          Đi dạo quanh thành phố, ghé quán cà phê, siêu thị, taxi và phòng khám để học tiếng Anh qua những cuộc trò
          chuyện hằng ngày.
        </p>
      </div>

      {props.hasSave && (
        <Button className="w-full" size="lg" onClick={props.onContinue}>
          Chơi tiếp
        </Button>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Chọn cấp độ</h2>
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
        <p className="text-xs text-muted-foreground">Cấp độ sẽ giữ nguyên cho đến khi bạn hoàn thành cả 4 địa điểm.</p>
      </section>

      <Button
        className="w-full"
        size="lg"
        variant={props.hasSave ? 'outline' : 'default'}
        onClick={() => props.onNewGame(level)}
      >
        {props.hasSave ? 'Chơi mới' : 'Bắt đầu'}
      </Button>
    </div>
  )
}

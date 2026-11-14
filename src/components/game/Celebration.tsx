import { Button } from '@/components/ui/button'
import type { Level } from '@shared/types.ts'

export function Celebration(props: {
  level: Level
  coins: number
  onPlayAgain: () => void
  onLevelUp?: () => void
  onKeepExploring: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-card p-6 text-center shadow-xl">
        <p className="text-5xl" aria-hidden>
          🎉
        </p>
        <h2 id="celebration-title" className="text-xl font-bold">{`Bạn đã hoàn thành cấp ${props.level}!`}</h2>
        <p className="text-lg">{`Tổng cộng: 🪙 ${props.coins}`}</p>
        <div className="grid gap-2">
          {props.onLevelUp && <Button onClick={props.onLevelUp}>{`Lên cấp ${props.level + 1}`}</Button>}
          <Button variant="outline" onClick={props.onPlayAgain}>{`Chơi lại cấp ${props.level}`}</Button>
          <Button variant="ghost" onClick={props.onKeepExploring}>
            Tiếp tục dạo phố
          </Button>
        </div>
      </div>
    </div>
  )
}

import { Button } from '@/components/ui/button'
import { PLACE_ART } from '@/game/art'
import { PLACE_IDS, type GameState } from '@/game/state'
import { getScenario } from '@shared/scenarios.ts'

export function TopBar(props: { state: GameState; onOpenCelebration: () => void }) {
  const { state } = props
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 text-sm">
      <div className="flex items-center gap-3 font-semibold">
        <span>{`Cấp ${state.level}`}</span>
        <span>{`🪙 ${state.coins}`}</span>
      </div>
      <div className="flex items-center gap-1" aria-label="Hộ chiếu">
        {PLACE_IDS.map((id) => {
          const done = state.stamps.includes(id)
          return (
            <span
              key={id}
              aria-label={`${getScenario(id)?.name_vi}: ${done ? 'đã xong' : 'chưa xong'}`}
              className={
                done
                  ? 'flex size-7 items-center justify-center rounded-full border-2 border-primary bg-primary/10'
                  : 'flex size-7 items-center justify-center rounded-full border-2 border-dashed text-muted-foreground'
              }
            >
              {done ? PLACE_ART[id].sign : '·'}
            </span>
          )
        })}
        {state.complete && (
          <Button variant="ghost" size="sm" onClick={props.onOpenCelebration} aria-label="🏆 Xem thành tích">
            🏆
          </Button>
        )}
      </div>
    </div>
  )
}

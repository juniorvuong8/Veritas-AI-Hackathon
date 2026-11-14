import { useCallback, useEffect, useRef, useState } from 'react'
import { PLACE_ART, PLAYER_EMOJI, TILE_EMOJI } from '@/game/art'
import { CITY, samePos, type Pos, type Tile } from '@/game/map'
import { keyToDir, step, type Dir } from '@/game/movement'
import { findPath, resolveTapTarget } from '@/game/path'
import type { GameState } from '@/game/state'
import { cn } from '@/lib/utils'
import { getScenario } from '@shared/scenarios.ts'
import { TopBar } from './TopBar'

export const STEP_MS = 120

const TILE_CLASS: Record<Tile, string> = {
  road: 'bg-stone-300 dark:bg-stone-600',
  grass: 'bg-green-300 dark:bg-green-800',
  tree: 'bg-green-300 dark:bg-green-800',
  water: 'bg-sky-300 dark:bg-sky-800',
  building: 'bg-amber-100 dark:bg-amber-900',
  door: 'bg-amber-100 dark:bg-amber-900',
}

/** The building tile next to each door shows the place sign. */
const SIGN_TILES = new Map<string, string>(
  CITY.doors.flatMap((d) => {
    const around = [
      { x: d.pos.x, y: d.pos.y - 1 },
      { x: d.pos.x, y: d.pos.y + 1 },
    ]
    const sign = around.find((p) => CITY.tiles[p.y]?.[p.x] === 'building')
    return sign ? [[`${sign.x},${sign.y}`, d.placeId] as [string, string]] : []
  }),
)

const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)

export function CityScreen(props: {
  state: GameState
  startPos: Pos
  showHint: boolean
  onEnterPlace: (placeId: string) => void
  onOpenCelebration: () => void
  onMoved: () => void
}) {
  const [pos, setPos] = useState<Pos>(props.startPos)
  const posRef = useRef(pos)
  const walkTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const entered = useRef(false)
  const moved = useRef(false)
  const propsRef = useRef(props)
  propsRef.current = props

  const stopWalk = useCallback(() => {
    if (walkTimer.current) clearInterval(walkTimer.current)
    walkTimer.current = null
  }, [])

  /** Move to an adjacent tile (already known to be walkable) and handle doors. */
  const moveTo = useCallback(
    (next: Pos, enteredPlace?: string) => {
      if (entered.current || samePos(next, posRef.current)) return
      posRef.current = next
      setPos(next)
      if (!moved.current) {
        moved.current = true
        propsRef.current.onMoved()
      }
      if (enteredPlace) {
        entered.current = true
        stopWalk()
        propsRef.current.onEnterPlace(enteredPlace)
      }
    },
    [stopWalk],
  )

  const stepDir = useCallback(
    (dir: Dir) => {
      const r = step(CITY, posRef.current, dir)
      moveTo(r.pos, r.enteredPlace)
    },
    [moveTo],
  )

  const walkTo = useCallback(
    (tapped: Pos) => {
      stopWalk()
      if (entered.current) return
      const target = resolveTapTarget(CITY, tapped)
      const path = target && findPath(CITY, posRef.current, target)
      if (!path || path.length === 0) return
      const queue = [...path]
      walkTimer.current = setInterval(() => {
        const next = queue.shift()
        if (!next) return stopWalk()
        const door = CITY.doors.find((d) => samePos(d.pos, next))
        moveTo(next, door?.placeId)
        if (queue.length === 0) stopWalk()
      }, STEP_MS)
    },
    [moveTo, stopWalk],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return
      const dir = keyToDir(e.key)
      if (!dir) return
      e.preventDefault()
      stopWalk()
      stepDir(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      stopWalk()
    }
  }, [stepDir, stopWalk])

  const pct = (n: number, of: number) => `${(n / of) * 100}%`

  return (
    <div className="space-y-3">
      <TopBar state={props.state} onOpenCelebration={props.onOpenCelebration} />
      {props.showHint && <p className="text-center text-sm text-muted-foreground">Đi đến một địa điểm để bắt đầu</p>}
      <div
        className="relative mx-auto w-full max-w-[480px] overflow-hidden rounded-xl border select-none"
        style={{ aspectRatio: `${CITY.width} / ${CITY.height}` }}
      >
        <div
          className="grid h-full w-full"
          style={{ gridTemplateColumns: `repeat(${CITY.width}, 1fr)`, gridTemplateRows: `repeat(${CITY.height}, 1fr)` }}
        >
          {CITY.tiles.flatMap((row, y) =>
            row.map((tile, x) => {
              const signPlace = SIGN_TILES.get(`${x},${y}`)
              return (
                <div
                  key={`${x},${y}`}
                  data-tile={`${x},${y}`}
                  onClick={() => {
                    walkTo({ x, y })
                  }}
                  className={cn(
                    'relative flex cursor-pointer items-center justify-center text-[min(5vw,1.4rem)]',
                    TILE_CLASS[tile],
                  )}
                  aria-label={signPlace ? `Đi đến ${getScenario(signPlace)?.name_vi}` : undefined}
                >
                  {signPlace ? PLACE_ART[signPlace].sign : TILE_EMOJI[tile]}
                  {signPlace && props.state.stamps.includes(signPlace) && (
                    <span className="absolute right-0 top-0 text-[0.6em]" aria-hidden>
                      ✓
                    </span>
                  )}
                </div>
              )
            }),
          )}
        </div>
        <div
          data-testid="player"
          data-x={pos.x}
          data-y={pos.y}
          aria-label="Bạn"
          className="pointer-events-none absolute flex items-center justify-center text-[min(5.5vw,1.6rem)]"
          style={{
            width: pct(1, CITY.width),
            height: pct(1, CITY.height),
            left: 0,
            top: 0,
            transform: `translate(${pos.x * 100}%, ${pos.y * 100}%)`,
            transition: `transform ${STEP_MS}ms linear`,
          }}
        >
          {PLAYER_EMOJI}
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">Dùng phím mũi tên / WASD hoặc chạm vào bản đồ để đi</p>
    </div>
  )
}

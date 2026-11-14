import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function SpeechBubble(props: {
  speaker: string
  side: 'host' | 'player'
  avatar: string
  children: ReactNode
}) {
  const isHost = props.side === 'host'
  return (
    <div data-side={props.side} className={cn('flex items-end gap-2', !isHost && 'flex-row-reverse')}>
      <span className="text-3xl leading-none" aria-hidden>
        {props.avatar}
      </span>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl border px-4 py-2 shadow-sm',
          isHost ? 'rounded-bl-sm bg-card' : 'rounded-br-sm bg-primary/10',
        )}
      >
        <p className="text-xs font-semibold text-muted-foreground">{props.speaker}</p>
        <div className="leading-relaxed">{props.children}</div>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SpeakButton } from '@/components/SpeakButton'
import { splitHighlights } from '@/lib/highlight'
import type { Lesson } from '@shared/types.ts'
import { SpeechBubble } from './SpeechBubble'

const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'BUTTON'].includes(t.tagName) || t.isContentEditable)

export function HighlightedText({ text, words }: { text: string; words: string[] }) {
  return (
    <>
      {splitHighlights(text, words).map((seg, j) =>
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
    </>
  )
}

export function Conversation(props: { lesson: Lesson; hostAvatar: string; playerAvatar: string; onDone: () => void }) {
  const { lesson } = props
  const [shown, setShown] = useState(1)
  const allShown = shown >= lesson.lines.length
  const words = lesson.vocab.map((v) => v.word)
  const hostSpeaker = lesson.lines[0]?.speaker_vi
  const mapped = lesson.vocab.filter((v) => v.input.toLowerCase() !== v.word.toLowerCase())
  const endRef = useRef<HTMLDivElement>(null)

  const advanceRef = useRef(() => {})
  advanceRef.current = () => (allShown ? props.onDone() : setShown((n) => n + 1))

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === 'Enter' || e.key === ' ') && !isTypingTarget(e.target)) {
        e.preventDefault()
        advanceRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
  }, [shown])

  return (
    <div className="space-y-3">
      {mapped.length > 0 && (
        <ul className="space-y-1 text-sm text-muted-foreground">
          {mapped.map((v) => (
            <li key={v.input}>{`${v.input} → ${v.word}`}</li>
          ))}
        </ul>
      )}
      {lesson.lines.slice(0, shown).map((line, i) => {
        const isHost = line.speaker_vi === hostSpeaker
        return (
          <SpeechBubble
            key={i}
            speaker={line.speaker_vi}
            side={isHost ? 'host' : 'player'}
            avatar={isHost ? props.hostAvatar : props.playerAvatar}
          >
            <p>
              <HighlightedText text={line.text} words={words} />
            </p>
            {line.translation_vi && <p className="text-sm italic text-muted-foreground">{line.translation_vi}</p>}
          </SpeechBubble>
        )
      })}
      {allShown && (
        <SpeechBubble speaker={hostSpeaker ?? ''} side="host" avatar={props.hostAvatar}>
          <p>Cùng xem lại các từ nhé!</p>
        </SpeechBubble>
      )}
      <div ref={endRef} />
      <Button className="w-full" size="lg" onClick={() => advanceRef.current()}>
        Tiếp ▸
      </Button>
    </div>
  )
}

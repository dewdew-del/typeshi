import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ResultsView } from '../components/results/ResultsView'
import { TypingArea, type TypingResult } from '../components/typing/TypingArea'
import { Choice } from '../components/ui/Choice'
import type { KeyStat } from '../../supabase/functions/_shared/scoring'
import { wordFeed } from '../engine/wordFeed'
import { touchStreak } from '../lib/api'
import { useProgress } from '../storage/progressStore'

const ALPHABET = [...'abcdefghijklmnopqrstuvwxyz']
const AUTO = 'auto'
const BY_FREQUENCY = [...'etaoinshrdlcumwfgypbvkjxqz']
const TIMES = [
  { value: '30', label: '30 seconds' },
  { value: '60', label: '1 minute' },
  { value: '120', label: '2 minutes' },
  { value: '300', label: '5 minutes' },
]

/** Adaptive mode (like keybr): start with 6 common letters; add the next one once every unlocked letter is 95%+ accurate over 10+ tries. */
function adaptive(keyStats: Record<string, KeyStat>): { unlocked: string[]; focus: string } {
  const acc = (l: string) => {
    const s = keyStats[l]
    return s && s.attempts >= 10 ? (s.attempts - s.misses) / s.attempts : null
  }
  let n = 6
  while (n < BY_FREQUENCY.length && BY_FREQUENCY.slice(0, n).every((l) => (acc(l) ?? 0) >= 0.95)) n++
  const unlocked = BY_FREQUENCY.slice(0, n)
  // Focus on the least accurate letter; a letter with too few tries counts as new and goes first.
  const focus = [...unlocked].sort((a, b) => (acc(a) ?? -1) - (acc(b) ?? -1))[0]
  return { unlocked, focus }
}

/** Pick one letter, then type words that are full of it. */
export function Letters() {
  const addKeyStats = useProgress((s) => s.addKeyStats)
  // /letters?k=e (from the Progress page) starts on that letter straight away.
  const [params] = useSearchParams()
  const first = params.get('k')?.toLowerCase()
  const initial = first && ALPHABET.includes(first) ? first : null

  const [seconds, setSeconds] = useState('60')
  const [letter, setLetter] = useState<string | null>(initial)
  const [focus, setFocus] = useState(initial ?? '')
  const [unlocked, setUnlocked] = useState<string[]>([])
  const [feed, setFeed] = useState<() => string>(() => (initial ? wordFeed({ [initial]: 1 }) : () => ''))
  const [text, setText] = useState(() => (initial ? feed() : ''))
  const [round, setRound] = useState(0)
  const [result, setResult] = useState<TypingResult | null>(null)

  const start = (l: string) => {
    let f: string
    let next: () => string
    if (l === AUTO) {
      const a = adaptive(useProgress.getState().progress.keyStats)
      setUnlocked(a.unlocked)
      f = a.focus
      next = wordFeed({ [f]: 1 }, new Set(a.unlocked))
    } else {
      f = l
      next = wordFeed({ [l]: 1 })
    }
    setLetter(l)
    setFocus(f)
    setFeed(() => next)
    setText(next() + ' ' + next())
    setResult(null)
    setRound((n) => n + 1)
  }

  const onFinish = useCallback(
    (r: TypingResult) => {
      addKeyStats(r.keyStats)
      void touchStreak()
      setResult(r)
    },
    [addKeyStats],
  )

  // Enter is the shortcut for Practice again on the results screen.
  useEffect(() => {
    if (!result || !letter) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat) return
      if ((e.target as HTMLElement | null)?.closest('a, button, input, select, textarea')) return
      e.preventDefault()
      start(letter)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start only uses setters and the letter
  }, [result, letter])

  if (!letter) {
    return (
      <main className="mx-auto flex max-w-[520px] flex-col items-center gap-4 px-6 pb-12 pt-2">
        <Choice label="Time" value={seconds} onChange={setSeconds} options={TIMES} />
        <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-2">
          {ALPHABET.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => start(l)}
              aria-label={`Practice the letter ${l.toUpperCase()}`}
              className="grid h-11 place-items-center rounded-xl border border-border bg-surface text-lg font-extrabold uppercase text-accent transition hover:border-accent hover:bg-surface-2"
            >
              {l}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => start(AUTO)} className="w-full rounded-xl bg-accent px-6 py-2.5 text-[15px] font-bold text-accent-contrast hover:opacity-90">
          Adaptive practice (we pick the letters)
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-[900px] flex-col gap-6 px-6 pb-16 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{letter === AUTO ? `Adaptive practice: ${focus.toUpperCase()}` : `Practice the letter ${letter.toUpperCase()}`}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Time"
            value={seconds}
            onChange={(e) => { setSeconds(e.target.value); start(letter) }}
            className="rounded-xl border border-border bg-surface px-4 py-2.5 font-semibold"
          >
            {TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button type="button" onClick={() => setLetter(null)} className="rounded-xl border border-border bg-surface px-5 py-2.5 font-bold hover:bg-surface-2">
            Change letter
          </button>
        </div>
      </div>
      {letter === AUTO && (
        <p className="text-sm text-muted">Unlocked letters: <span className="font-bold uppercase text-text">{unlocked.join(' ')}</span>. Get every one to 95% accuracy to unlock the next.</p>
      )}
      {result ? (
        <ResultsView result={result}>
          <div className="flex flex-wrap gap-3 pt-1">
            <button type="button" onClick={() => start(letter)} className="rounded-xl bg-accent px-8 py-3.5 text-[17px] font-bold text-accent-contrast hover:opacity-90">Practice again</button>
            <Link to="/play" className="rounded-xl border border-border bg-surface px-7 py-3.5 text-[17px] font-bold hover:bg-surface-2">Back to menu</Link>
          </div>
        </ResultsView>
      ) : (
        <TypingArea key={round} target={text} showKeyboard timeLimitMs={Number(seconds) * 1000} getMore={feed} onRestart={() => start(letter)} onFinish={onFinish} />
      )}
    </main>
  )
}

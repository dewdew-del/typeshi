import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ResultsView } from '../components/results/ResultsView'
import { TypingArea, type TypingResult } from '../components/typing/TypingArea'
import { Choice } from '../components/ui/Choice'
import type { KeyStat } from '../../supabase/functions/_shared/scoring'
import { wordFeed } from '../engine/wordFeed'
import { touchStreak } from '../lib/api'
import { ALPHABET, PASS_ACCURACY, unlockedCount, useLetters } from '../storage/letterStore'
import { useProgress } from '../storage/progressStore'

const AUTO = 'auto'
const TIMES = [
  { value: '30', label: '30 seconds' },
  { value: '60', label: '1 minute' },
  { value: '120', label: '2 minutes' },
  { value: '300', label: '5 minutes' },
]

/** Adaptive practice (all letters open): drill the least accurate letter; one with under 10 tries counts as new and goes first. */
function weakestLetter(keyStats: Record<string, KeyStat>): string {
  const acc = (l: string) => {
    const s = keyStats[l]
    return s && s.attempts >= 10 ? (s.attempts - s.misses) / s.attempts : -1
  }
  return [...ALPHABET].sort((a, b) => acc(a) - acc(b))[0]
}

/** Pick one letter, then type words that are full of it. */
export function Letters() {
  const addKeyStats = useProgress((s) => s.addKeyStats)
  // /letters?k=e (from the Progress page) starts on that letter straight away.
  const [params, setParams] = useSearchParams()
  const passed = useLetters((s) => s.passed)
  const pass = useLetters((s) => s.pass)
  const open = unlockedCount(passed)
  const first = params.get('k')?.toLowerCase()
  // A locked letter from the link goes to the picker instead.
  const initial = first && ALPHABET.indexOf(first) >= 0 && ALPHABET.indexOf(first) < unlockedCount(useLetters.getState().passed) ? first : null

  const [seconds, setSeconds] = useState('60')
  const [letter, setLetter] = useState<string | null>(initial)
  const [focus, setFocus] = useState(initial ?? '')
  const [feed, setFeed] = useState<() => string>(() => (initial ? wordFeed({ [initial]: 1 }) : () => ''))
  const [text, setText] = useState(() => (initial ? feed() : ''))
  const [round, setRound] = useState(0)
  const [result, setResult] = useState<TypingResult | null>(null)

  const start = (l: string) => {
    let f: string
    let next: () => string
    if (l === AUTO) {
      f = weakestLetter(useProgress.getState().progress.keyStats)
      next = wordFeed({ [f]: 1 })
    } else {
      f = l
      next = wordFeed({ [l]: 1 })
    }
    // The letter goes in the address, so the back button returns to the letter picker.
    if (params.get('k') !== l) setParams({ k: l }, { replace: letter !== null })
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
      // Passing needs a real round (not a few keys) at 95%+.
      if (r.summary.accuracy >= PASS_ACCURACY && r.summary.keystrokes >= 30) pass(focus)
      void touchStreak()
      setResult(r)
    },
    [addKeyStats, pass, focus],
  )

  // Back button (or browser back) removed the letter from the address: show the picker again.
  useEffect(() => {
    if (!params.get('k') && letter) setLetter(null)
  }, [params, letter])

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
          {ALPHABET.map((l, i) => {
            const locked = i >= open
            return (
              <button
                key={l}
                type="button"
                disabled={locked}
                onClick={() => start(l)}
                title={locked ? `Get ${PASS_ACCURACY}% on ${ALPHABET[i - 1].toUpperCase()} to unlock` : undefined}
                aria-label={locked ? `${l.toUpperCase()}, locked. Get ${PASS_ACCURACY}% on ${ALPHABET[i - 1].toUpperCase()} to unlock` : `Practice the letter ${l.toUpperCase()}${passed.includes(l) ? ', passed' : ''}`}
                className={[
                  'relative grid h-11 place-items-center rounded-xl border text-lg font-extrabold uppercase transition',
                  locked ? 'cursor-not-allowed border-border bg-surface-2 text-muted opacity-60' : 'border-border bg-surface text-accent hover:border-accent hover:bg-surface-2',
                ].join(' ')}
              >
                {l}
                {passed.includes(l) && <span aria-hidden="true" className="absolute right-1 top-0.5 text-[10px] text-accent">✓</span>}
                {locked && (
                  <svg className="absolute right-1 top-1" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
        <p className="text-sm text-muted">Get {PASS_ACCURACY}% accuracy on a letter to unlock the next one.</p>
        <button
          type="button"
          disabled={open < ALPHABET.length}
          onClick={() => start(AUTO)}
          title={open < ALPHABET.length ? 'Unlock all letters first' : undefined}
          className="w-full rounded-xl bg-accent px-6 py-2.5 text-[15px] font-bold text-accent-contrast hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Adaptive practice{open < ALPHABET.length ? ' (unlock all letters first)' : ''}
        </button>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-[900px] flex-col gap-6 px-6 pb-16 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Letter {focus.toUpperCase()}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Time"
            value={seconds}
            onChange={(e) => { setSeconds(e.target.value); start(letter) }}
            className="rounded-xl border border-border bg-surface px-4 py-2.5 font-semibold"
          >
            {TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button type="button" onClick={() => setParams({})} className="rounded-xl border border-border bg-surface px-5 py-2.5 font-bold hover:bg-surface-2">
            Change letter
          </button>
        </div>
      </div>
      {result ? (
        <ResultsView result={result}>
          <p className="font-semibold">
            {result.summary.accuracy >= PASS_ACCURACY && result.summary.keystrokes >= 30
              ? `Passed ${focus.toUpperCase()}!${ALPHABET.indexOf(focus) >= 3 && ALPHABET.indexOf(focus) + 1 < ALPHABET.length && letter !== AUTO ? ` ${ALPHABET[ALPHABET.indexOf(focus) + 1].toUpperCase()} is unlocked.` : ''}`
              : `Get ${PASS_ACCURACY}% accuracy to pass ${focus.toUpperCase()}.`}
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <button type="button" onClick={() => start(letter)} className="rounded-xl bg-accent px-8 py-3.5 text-[17px] font-bold text-accent-contrast hover:opacity-90">Practice again</button>
            <Link to="/play" className="rounded-xl border border-border bg-surface px-7 py-3.5 text-[17px] font-bold hover:bg-surface-2">Back to menu</Link>
          </div>
        </ResultsView>
      ) : (
        <TypingArea key={round} target={text} timeLimitMs={Number(seconds) * 1000} getMore={feed} onRestart={() => start(letter)} onFinish={onFinish} />
      )}
    </main>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ResultsView } from '../components/results/ResultsView'
import { TypingArea, type TypingResult } from '../components/typing/TypingArea'
import { keyLabel } from '../engine/stats'
import { weakLetterWeights, wordFeed } from '../engine/wordFeed'
import { touchStreak } from '../lib/api'
import { useProgress } from '../storage/progressStore'

const TIMES = [
  { value: '30', label: '30 seconds' },
  { value: '60', label: '1 minute' },
  { value: '120', label: '2 minutes' },
  { value: '300', label: '5 minutes' },
]

/** A fresh round from the latest stats, so the drill follows you as keys get better or worse. */
function newRound() {
  const weights = weakLetterWeights(useProgress.getState().progress.keyStats)
  const focus = Object.keys(weights).sort((a, b) => weights[b] - weights[a])
  const feed = focus.length > 0 ? wordFeed(weights) : () => ''
  return { focus, feed, text: focus.length > 0 ? feed() + ' ' + feed() : '' }
}

/** Weak-keys practice: real words built around the keys you miss most often (by rate) or type slowest. */
export function Practice() {
  const addKeyStats = useProgress((s) => s.addKeyStats)
  const [seconds, setSeconds] = useState('60')
  const [round, setRound] = useState(newRound)
  const [n, setN] = useState(0)
  const [result, setResult] = useState<TypingResult | null>(null)

  const onFinish = useCallback(
    (r: TypingResult) => {
      addKeyStats(r.keyStats)
      void touchStreak()
      setResult(r)
    },
    [addKeyStats],
  )

  const again = () => {
    setResult(null)
    setRound(newRound())
    setN((x) => x + 1)
  }

  // Enter is the shortcut for Practice again on the results screen.
  useEffect(() => {
    if (!result) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat) return
      if ((e.target as HTMLElement | null)?.closest('a, button, input, select, textarea')) return
      e.preventDefault()
      again()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [result])

  if (round.focus.length === 0) {
    return (
      <main className="mx-auto flex max-w-[680px] flex-col items-center gap-4 px-6 py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Weak-keys practice</h1>
        <p className="text-muted">Type a lesson or a casual test first. We will learn which keys you miss or slow down on and build practice around them.</p>
        <div className="flex gap-3">
          <Link to="/journey" className="rounded-xl bg-accent px-6 py-3 font-bold text-accent-contrast">Go to Journey</Link>
          <Link to="/casual" className="rounded-xl border border-border bg-surface px-6 py-3 font-bold">Casual typing</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex max-w-[900px] flex-col gap-6 px-6 pb-16 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Weak-keys practice</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-2" aria-label="Keys in this practice">
            {round.focus.map((c) => (
              <span key={c} className="grid h-8 min-w-8 place-items-center rounded-lg border-2 bg-surface px-2 text-sm font-extrabold text-accent" style={{ borderColor: 'color-mix(in srgb, var(--accent) 25%, var(--surface))' }}>
                {keyLabel(c)}
              </span>
            ))}
          </div>
          <select
            aria-label="Time"
            value={seconds}
            onChange={(e) => { setSeconds(e.target.value); again() }}
            className="rounded-xl border border-border bg-surface px-4 py-2 font-semibold"
          >
            {TIMES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>
      {result ? (
        <ResultsView result={result}>
          <div className="flex flex-wrap gap-3 pt-1">
            <button type="button" onClick={again} className="rounded-xl bg-accent px-8 py-3.5 text-[17px] font-bold text-accent-contrast hover:opacity-90">Practice again</button>
            <Link to="/play" className="rounded-xl border border-border bg-surface px-7 py-3.5 text-[17px] font-bold hover:bg-surface-2">Back to menu</Link>
          </div>
        </ResultsView>
      ) : (
        <TypingArea key={n} target={round.text} showKeyboard timeLimitMs={Number(seconds) * 1000} getMore={round.feed} onRestart={again} onFinish={onFinish} />
      )}
    </main>
  )
}

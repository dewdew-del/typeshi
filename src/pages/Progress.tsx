import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LESSONS, STAGE_NAMES } from '../content/lessons/catalog'
import { formatAccuracy, keyLabel, slowestKeys, topMissedKeys } from '../engine/stats'
import { getMyRuns } from '../lib/api'
import { useAuth } from '../storage/authStore'
import { personalBests, useHistory } from '../storage/historyStore'
import { useProgress } from '../storage/progressStore'

const ALPHABET = [...'abcdefghijklmnopqrstuvwxyz']

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-5 py-4">
      <div className="text-3xl font-extrabold tracking-tight text-accent">{value}</div>
      <div className="mt-1 text-sm font-semibold text-muted">{label}</div>
    </div>
  )
}

const day = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const when = (t: number) => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** Net WPM of the last 30 attempts on this device: a line with dots, a WPM scale on the left and dates along the bottom. */
function SpeedChart() {
  const points = useHistory((s) => s.points).slice(-30)
  if (points.length < 2) return null
  const W = 640
  const H = 220
  const L = 40 // room for the WPM labels
  const B = 26 // room for the dates
  const top = Math.max(20, Math.ceil(Math.max(...points.map((p) => p.wpm)) / 10) * 10)
  const x = (i: number) => L + 8 + (i / (points.length - 1)) * (W - L - 24)
  const y = (w: number) => 10 + (1 - w / top) * (H - B - 10)
  const ticks = [0, top / 2, top]
  // Dates under the first, middle and last attempt (fewer labels keep them readable).
  const dateAt = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])]
  const first = points[0].wpm
  const last = points[points.length - 1].wpm
  return (
    <section aria-labelledby="speed-h" className="flex flex-col gap-3">
      <h2 id="speed-h" className="text-xl font-bold">Speed over time</h2>
      <p className="text-sm text-muted">Your last {points.length} attempts on this device: {Math.round(first)} WPM at the start, {Math.round(last)} WPM now. Hover a dot for details.</p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Speed from ${Math.round(first)} to ${Math.round(last)} words per minute over ${points.length} attempts`} className="h-auto w-full rounded-2xl border border-border bg-surface">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - 10} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeDasharray={t === 0 ? undefined : '4 4'} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{t}</text>
          </g>
        ))}
        <text x={L - 8} y={H - 6} textAnchor="end" fontSize="10" fill="var(--muted)">WPM</text>
        {dateAt.map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} fontSize="11" fill="var(--muted)">{day(points[i].t)}</text>
        ))}
        <polyline points={points.map((p, i) => `${x(i)},${y(p.wpm)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.wpm)} r="4.5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.5">
            <title>{`${Math.round(p.wpm)} WPM, ${formatAccuracy(p.accuracy)}% accuracy, ${when(p.t)}`}</title>
          </circle>
        ))}
      </svg>
    </section>
  )
}

/** Every time you beat your best speed, newest first. */
function BestHistory({ runs }: { runs: { t: number; wpm: number }[] }) {
  const bests = personalBests(runs).reverse()
  if (bests.length === 0) return null
  return (
    <section aria-labelledby="best-h" className="flex flex-col gap-2">
      <h2 id="best-h" className="text-xl font-bold">Personal bests</h2>
      <ol className="flex flex-col gap-2">
        {bests.map((b, i) => (
          <li key={b.t} className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-2">
            <span className="font-extrabold tabular-nums">
              {Math.round(b.wpm)} WPM
              {i === 0 && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-contrast">Best</span>}
            </span>
            <span className="text-sm text-muted">{when(b.t)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Everything here is read from the progress already saved (lessons and per-key stats); nothing new is stored. */
export function Progress() {
  const { lessons, keyStats } = useProgress((s) => s.progress)

  const records = Object.values(lessons)
  const passed = records.filter((r) => r.passed).length
  const stars = records.reduce((n, r) => n + r.stars, 0)
  const history = useHistory((s) => s.points)
  // Signed in: the leaderboard keeps runs from before this device started saving history.
  const userId = useAuth((s) => s.user?.id)
  const [serverRuns, setServerRuns] = useState<{ t: number; wpm: number }[]>([])
  useEffect(() => {
    if (userId) void getMyRuns(userId).then(setServerRuns)
  }, [userId])
  // Runs on this device plus saved leaderboard runs (a signed-in run can be in both; that never adds a fake best).
  const runs = [...history, ...serverRuns]
  // Fastest of every mode: Journey lessons plus every finished attempt saved for the speed chart (casual, practice, races).
  const bestWpm = Math.max(records.reduce((n, r) => Math.max(n, r.bestWpm), 0), ...runs.map((p) => p.wpm))
  const keys = Object.values(keyStats)
  const attempts = keys.reduce((n, k) => n + k.attempts, 0)
  const misses = keys.reduce((n, k) => n + k.misses, 0)

  if (attempts === 0) {
    return (
      <main className="mx-auto flex max-w-[680px] flex-col items-center gap-4 px-6 py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Your progress</h1>
        <p className="text-muted">Nothing to show yet. Type a lesson or a casual test and your numbers will appear here.</p>
        <Link to="/journey" className="rounded-xl bg-accent px-6 py-3 font-bold text-accent-contrast">Go to Journey</Link>
      </main>
    )
  }

  const stages = STAGE_NAMES.map((name, i) => {
    const inStage = LESSONS.filter((l) => l.stage === i)
    return { name, total: inStage.length, done: inStage.filter((l) => lessons[l.id]?.passed).length }
  }).filter((s) => s.total > 0)

  const missed = topMissedKeys(keyStats, 5)
  const slow = slowestKeys(keyStats, 5)

  return (
    <main className="mx-auto flex max-w-[900px] flex-col gap-8 px-6 pb-16 pt-2">
      <h1 className="text-3xl font-bold tracking-tight">Your progress</h1>

      <section aria-label="Summary" className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        <Tile label="Lessons passed" value={`${passed} / ${LESSONS.length}`} />
        <Tile label="Stars earned" value={String(stars)} />
        <Tile label="Best speed" value={bestWpm ? `${Math.round(bestWpm)} WPM` : '–'} />
        <Tile label="Overall accuracy" value={`${formatAccuracy(((attempts - misses) / attempts) * 100)}%`} />
        <Tile label="Keys typed" value={attempts.toLocaleString()} />
      </section>

      <SpeedChart />

      <BestHistory runs={runs} />

      <section aria-labelledby="stages-h" className="flex flex-col gap-3">
        <h2 id="stages-h" className="text-xl font-bold">Journey stages</h2>
        {stages.map((s) => (
          <div key={s.name} className="flex items-center gap-4">
            <div className="w-40 shrink-0 text-sm font-semibold">{s.name}</div>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent" style={{ width: `${(s.done / s.total) * 100}%` }} />
            </div>
            <div className="w-14 shrink-0 text-right text-sm tabular-nums text-muted">{s.done}/{s.total}</div>
          </div>
        ))}
      </section>

      <section aria-labelledby="keys-h" className="flex flex-col gap-3">
        <h2 id="keys-h" className="text-xl font-bold">Accuracy per letter</h2>
        <p className="text-sm text-muted">Greener is more accurate, redder needs work. Click a letter to practice it.</p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(58px,1fr))] gap-2">
          {ALPHABET.map((l) => {
            const s = keyStats[l]
            const acc = s && s.attempts > 0 ? ((s.attempts - s.misses) / s.attempts) * 100 : null
            // 70% accuracy and below is full red, 100% is full green.
            const hue = acc === null ? 0 : Math.max(0, Math.min(1, (acc - 70) / 30)) * 130
            return (
              <Link
                key={l}
                to={`/letters?k=${l}`}
                aria-label={`${l.toUpperCase()}: ${acc === null ? 'not typed yet' : `${formatAccuracy(acc)}% accurate`}. Practice this letter`}
                className="grid place-items-center rounded-xl border border-border py-2 text-text hover:border-accent"
                style={{ background: acc === null ? 'var(--surface-2)' : `hsl(${hue} 70% 55% / 0.3)` }}
              >
                <span className="text-lg font-extrabold uppercase">{l}</span>
                <span className="text-xs tabular-nums text-muted">{acc === null ? '–' : `${Math.round(acc)}%`}</span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-bold">Most missed</h2>
          {missed.length === 0 ? <p className="text-muted">No misses yet. Nice.</p> : missed.map((k) => (
            <div key={k.char} className="flex justify-between rounded-xl border border-border bg-surface px-4 py-2">
              <span className="font-extrabold">{keyLabel(k.char)}</span>
              <span className="text-muted">{k.misses} misses</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-bold">Slowest keys</h2>
          {slow.length === 0 ? <p className="text-muted">Type a bit more to see this.</p> : slow.map((k) => (
            <div key={k.char} className="flex justify-between rounded-xl border border-border bg-surface px-4 py-2">
              <span className="font-extrabold">{keyLabel(k.char)}</span>
              <span className="text-muted">{Math.round(k.avgMs)} ms</span>
            </div>
          ))}
        </div>
      </section>

      <div>
        <Link to="/practice" className="rounded-xl bg-accent px-7 py-3.5 text-[17px] font-bold text-accent-contrast hover:opacity-90">Practice my weak keys</Link>
      </div>
    </main>
  )
}

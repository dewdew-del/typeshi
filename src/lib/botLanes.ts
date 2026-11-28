import { createRng } from '../engine/rng'

/** How a computer player's progress bar moves (from the room_sync RPC). Times are ms after the start signal. */
export interface BotLane {
  user_id: string
  start_ms: number | null
  end_ms: number | null
  end_pos: number | null
  style: string | null
  seed: number | null
}

type Step = { kind: 'type'; ms: number; chars: number } | { kind: 'pause'; ms: number } | { kind: 'erase'; ms: number; chars: number }

/**
 * The bot's race as a list of steps: typing stretches at changing speeds (some short bursts very fast, some
 * slow), pauses to think, and backspacing a few letters that then get typed again. Most bots start fast and
 * tire ("fader"), some stay even, a few finish strong ("sprinter"). Typing times are scaled so the steps add
 * up to exactly `total` ms and the bot ends on `target` characters.
 */
function plan(seed: number, style: string | null, total: number, target: number): Step[] {
  const rng = createRng(seed).next
  const a = style === 'fader' ? 0.2 + rng() * 0.15 : style === 'sprinter' ? -0.25 : 0
  const pieces = 8 + Math.floor(rng() * 7)
  const typing: { weight: number; speed: number }[] = []
  const between: (Step | null)[] = []
  for (let i = 0; i < pieces; i++) {
    const u = (i + 0.5) / pieces
    const r = rng()
    const mood = r < 0.2 ? 1.7 + rng() * 0.6 : r < 0.35 ? 0.5 + rng() * 0.2 : 0.85 + rng() * 0.3
    typing.push({ weight: 0.5 + rng(), speed: mood * (1 + a * (1 - 2 * u)) })
    if (i === pieces - 1) break
    const e = rng()
    // More hesitation and mistakes later in the race.
    const late = 0.7 + u * 0.6
    if (e < 0.35 * late) between.push({ kind: 'pause', ms: 300 + rng() * 1100 })
    else if (e < 0.6 * late) {
      const chars = 1 + Math.floor(rng() * 7)
      between.push({ kind: 'erase', ms: chars * (55 + rng() * 40), chars })
    } else between.push(null)
  }
  // Pauses and backspacing take at most 35% of the race.
  const extraMs = between.reduce((s, b) => s + (b?.ms ?? 0), 0)
  const squeeze = extraMs > total * 0.35 ? (total * 0.35) / extraMs : 1
  for (const b of between) if (b) b.ms *= squeeze
  const typingMs = total - extraMs * squeeze
  const erased = between.reduce((s, b) => s + (b?.kind === 'erase' ? b.chars : 0), 0)
  const forward = target + erased
  const wTime = typing.reduce((s, t) => s + t.weight, 0)
  const wChars = typing.reduce((s, t) => s + t.weight * t.speed, 0)

  const steps: Step[] = []
  typing.forEach((t, i) => {
    steps.push({ kind: 'type', ms: (t.weight / wTime) * typingMs, chars: (t.weight * t.speed / wChars) * forward })
    const b = between[i]
    if (b) steps.push(b)
  })
  return steps
}

/** Where a bot's bar is `elapsed` ms after the start, and the speed shown next to it. Ends exactly on end_pos at end_ms. */
export function botPosition(lane: BotLane, elapsed: number, textLength: number): { pos: number; wpm: number } {
  const { start_ms: start, end_ms: end, end_pos: endPos } = lane
  if (start == null || end == null || endPos == null || elapsed <= start || textLength <= 0) return { pos: 0, wpm: 0 }
  const target = endPos * textLength
  const t = Math.min(elapsed, end) - start
  let chars = target
  if (elapsed < end) {
    chars = 0
    let left = t
    for (const s of plan(lane.seed ?? 1, lane.style, end - start, target)) {
      const part = Math.min(1, left / s.ms)
      if (s.kind === 'type') chars += s.chars * part
      else if (s.kind === 'erase') chars -= s.chars * part
      left -= s.ms
      if (left <= 0) break
    }
    chars = Math.min(target, Math.max(0, chars))
  }
  const minutes = t / 60000
  return { pos: chars / textLength, wpm: minutes > 0 ? Math.min(400, chars / 5 / minutes) : 0 }
}

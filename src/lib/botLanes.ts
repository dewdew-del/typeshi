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

/**
 * Where a bot's bar is `elapsed` ms after the start: a short reaction delay, then most bots start fast and
 * slow down ("fader"), some stay even, a few speed up at the end ("sprinter"), with small pauses for typos
 * that come more often in the second half. Reaches exactly end_pos at end_ms.
 */
export function botPosition(lane: BotLane, elapsed: number, textLength: number): { pos: number; wpm: number } {
  const { start_ms: start, end_ms: end, end_pos: endPos } = lane
  if (start == null || end == null || endPos == null || elapsed <= start) return { pos: 0, wpm: 0 }
  const total = end - start
  const t = Math.min(elapsed, end) - start
  const rng = createRng(lane.seed ?? 1).next

  // Typo pauses: 1 to 3, each 250-800 ms, at points skewed towards the end.
  const pauses = Array.from({ length: 1 + Math.floor(rng() * 3) }, () => ({ at: Math.pow(rng(), 0.6) * total, ms: 250 + rng() * 550 }))
  const paused = pauses.reduce((s, p) => s + p.ms, 0)
  const typingTotal = Math.max(1, total - paused)
  // Typing time so far: elapsed minus the parts of any pauses already passed.
  const typed = pauses.reduce((tt, p) => tt - Math.max(0, Math.min(p.ms, t - p.at)), t)
  const s = Math.min(1, Math.max(0, typed / typingTotal))

  const a = lane.style === 'fader' ? 0.2 + rng() * 0.15 : lane.style === 'sprinter' ? -0.25 : 0
  // f(s) = s + a(s - s²): speed 1+a at the start, 1-a at the end; f(0) = 0, f(1) = 1.
  const wobble = 0.01 * Math.sin(2 * Math.PI * s * (3 + rng() * 3) + rng() * 6) * 4 * s * (1 - s)
  const f = s >= 1 || elapsed >= end ? 1 : Math.min(1, Math.max(0, s + a * (s - s * s) + wobble))
  const pos = endPos * f
  const minutes = t / 60000
  return { pos, wpm: minutes > 0 ? Math.min(400, (pos * textLength) / 5 / minutes) : 0 }
}

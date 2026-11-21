import type { KeyStat } from '../../supabase/functions/_shared/scoring'
import { COMMON_WORDS } from '../content/words/common'
import { WORDS_EN } from '../content/words/en'

/** About 5,800 real English words (the curated list plus the common-words list). */
export const ALL_WORDS = [...new Set([...WORDS_EN, ...COMMON_WORDS])]

const count = (w: string, l: string) => [...w].filter((c) => c === l).length

/**
 * Endless supply of real English words built around some letters. `weights` says which letters to train and how
 * hard: each word first picks a letter by weight, then takes a word with that letter, so a common letter like "e"
 * can't crowd out the weak ones. Words with more of the letter tend to come first, and a letter's words don't
 * repeat until all of them have been used.
 * `allowed` limits the words to those letters (adaptive mode); with fewer than 25 left it uses any word with the letter.
 */
export function wordFeed(weights: Record<string, number>, allowed?: Set<string>, random = Math.random): () => string {
  const letters = Object.keys(weights).filter((l) => weights[l] > 0)
  const pools: Record<string, string[]> = {}
  for (const l of letters) {
    const all = ALL_WORDS.filter((w) => w.includes(l))
    const fit = allowed ? all.filter((w) => [...w].every((c) => allowed.has(c))) : all
    pools[l] = fit.length >= 25 ? fit : all
  }
  const bags: Record<string, string[]> = {}
  // Lower key first: a random number divided by the letter's share of the word. Popped from the end, so sort high to low.
  const refill = (l: string) => {
    bags[l] = pools[l]
      .map((w) => ({ w, k: random() / (count(w, l) / w.length) }))
      .sort((x, y) => y.k - x.k)
      .map((x) => x.w)
  }
  const total = letters.reduce((n, l) => n + weights[l], 0)
  const pickLetter = () => {
    let r = random() * total
    for (const l of letters) if ((r -= weights[l]) < 0) return l
    return letters[letters.length - 1]
  }
  const recent: string[] = []
  const nextWord = () => {
    const l = pickLetter()
    for (let tries = 0; ; tries++) {
      if (!bags[l]?.length) refill(l)
      const w = bags[l].pop() as string
      // Two letters can share a word; skip one that was just typed (unless the letter has almost no words).
      if (!recent.includes(w) || tries > 5) return w
    }
  }
  return () => {
    const out: string[] = []
    for (let i = 0; i < 20; i++) {
      const w = nextWord()
      out.push(w)
      recent.push(w)
      if (recent.length > 40) recent.shift()
    }
    return out.join(' ')
  }
}

/**
 * The letters to drill, with how much weight each gets. Ranked by miss RATE (not miss count, which always
 * picks common letters like "e"), plus the keys much slower than your usual speed. Needs 5+ tries per letter.
 */
export function weakLetterWeights(stats: Record<string, KeyStat>): Record<string, number> {
  const letters = Object.entries(stats).filter(([c, s]) => /^[a-z]$/.test(c) && s.attempts >= 5)
  const missed = letters
    .map(([c, s]) => ({ c, rate: s.misses / s.attempts }))
    .filter((x) => x.rate >= 0.03)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 4)
  const speeds = letters.map(([c, s]) => ({ c, ms: s.totalMs / s.attempts })).sort((a, b) => a.ms - b.ms)
  const median = speeds.length > 0 ? speeds[Math.floor(speeds.length / 2)].ms : 0
  const slow = speeds
    .filter((x) => x.ms >= median * 1.25 && !missed.some((m) => m.c === x.c))
    .reverse()
    .slice(0, 6 - missed.length)
  const out: Record<string, number> = {}
  for (const m of missed) out[m.c] = 1 + Math.min(2, m.rate * 10) // 10% misses = 2x, 20%+ = 3x
  for (const s of slow) out[s.c] = 1.5
  return out
}

/**
 * Text for casual typing on the leaderboard, chosen by the server: shuffled sentences in English or
 * Filipino. Pool lives in casualPool.ts (generated from src/content). Dependency-free (Deno + browser).
 */

import { EN, FIL } from './casualPool.ts'

/** mulberry32: small seeded PRNG. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Sentences in shuffled order, each used once per pass (no repeats until the pool runs out), until at least `minChars` characters. */
export function casualText(seed: number, lang: 'en' | 'fil', minChars: number): string {
  const pool = lang === 'fil' ? FIL : EN
  const next = rng(seed)
  const out: string[] = []
  let n = 0
  let bag: string[] = []
  while (n < minChars) {
    if (bag.length === 0) {
      bag = pool.slice()
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[bag[i], bag[j]] = [bag[j], bag[i]]
      }
      if (bag[bag.length - 1] === out[out.length - 1]) bag.unshift(bag.pop()!)
    }
    const s = bag.pop()!
    out.push(s)
    n += s.length + 1
  }
  return out.join(' ')
}

/** Casual lengths: seconds (0 = Endless) and how much text each needs (enough for ~200 WPM; Endless for 30 minutes at ~60 WPM). */
export const CASUAL_SECONDS = { '10s': 10, '30s': 30, '1min': 60, '2min': 120, endless: 0 } as const
export type CasualLength = keyof typeof CASUAL_SECONDS
export const CASUAL_CHARS: Record<CasualLength, number> = { '10s': 400, '30s': 700, '1min': 1200, '2min': 2200, endless: 9000 }

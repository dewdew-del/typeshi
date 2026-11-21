import { describe, expect, it } from 'vitest'
import { weakLetterWeights, wordFeed } from './wordFeed'

describe('wordFeed', () => {
  it('only gives real words that contain a focus letter', () => {
    const words = wordFeed({ b: 1 })().split(' ')
    expect(words).toHaveLength(20)
    for (const w of words) expect(w).toContain('b')
  })

  it('does not repeat a word until the list is used up', () => {
    const feed = wordFeed({ z: 1 })
    const words = [feed(), feed()].join(' ').split(' ')
    // z has about 40 words, so the first 40 are all different.
    expect(new Set(words.slice(0, 35)).size).toBe(35)
  })

  it('a common letter does not crowd out the weakest one', () => {
    const feed = wordFeed({ v: 3, e: 1 })
    const words = Array.from({ length: 10 }, feed).join(' ').split(' ')
    const withV = words.filter((w) => w.includes('v')).length
    // v is picked 3 times out of 4; e alone would only give v in a few percent of words.
    expect(withV / words.length).toBeGreaterThan(0.6)
  })

  it('keeps to the allowed letters when there are enough words', () => {
    const allowed = new Set([...'etaoinshr'])
    for (const w of wordFeed({ t: 1 }, allowed)().split(' ')) expect([...w].every((c) => allowed.has(c))).toBe(true)
  })
})

describe('weakLetterWeights', () => {
  const stat = (attempts: number, misses: number, msEach = 200) => ({ attempts, misses, totalMs: attempts * msEach })

  it('ranks by miss rate, not by how many misses', () => {
    const w = weakLetterWeights({ e: stat(500, 15), q: stat(10, 3), a: stat(300, 3) })
    // e: 15 misses but 3%; q: 3 misses but 30%. q must weigh more, a (1%) is left out.
    expect(w.q).toBeGreaterThan(w.e)
    expect(w.a).toBeUndefined()
  })

  it('adds keys that are much slower than usual and ignores keys with too few tries', () => {
    const w = weakLetterWeights({ a: stat(50, 0), s: stat(50, 0), d: stat(50, 0), k: stat(50, 0, 400), x: stat(2, 2) })
    expect(w.k).toBe(1.5)
    expect(w.x).toBeUndefined()
  })
})

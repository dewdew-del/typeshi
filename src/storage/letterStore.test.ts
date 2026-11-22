import { describe, expect, it } from 'vitest'
import { unlockedCount } from './letterStore'

describe('unlockedCount', () => {
  it('starts with A to D', () => expect(unlockedCount([])).toBe(4))
  it('passing D unlocks E, then E unlocks F', () => {
    expect(unlockedCount(['d'])).toBe(5)
    expect(unlockedCount(['d', 'e'])).toBe(6)
  })
  it('a pass further ahead does not skip a locked letter', () => expect(unlockedCount(['a', 'f'])).toBe(4))
  it('all letters after passing D to Y', () => expect(unlockedCount([...'defghijklmnopqrstuvwxy'])).toBe(26))
})

import { describe, expect, it } from 'vitest'
import { personalBests } from './historyStore'

describe('personalBests', () => {
  it('keeps only runs that beat every earlier run, in time order', () => {
    const runs = [{ t: 3, wpm: 50 }, { t: 1, wpm: 40 }, { t: 2, wpm: 35 }, { t: 4, wpm: 50 }, { t: 5, wpm: 68 }]
    expect(personalBests(runs)).toEqual([{ t: 1, wpm: 40 }, { t: 3, wpm: 50 }, { t: 5, wpm: 68 }])
  })
})

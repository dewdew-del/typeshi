import { describe, expect, it } from 'vitest'
import { raceText, RACE_TEXT_TYPES, DIFFICULTIES } from '../../lib/raceText'
import { EXTRA_FIL_SENTENCES, EXTRA_PARAGRAPHS, EXTRA_QUOTES, EXTRA_SENTENCES } from './extra'

describe('extra race texts', () => {
  it('are plain keyboard text', () => {
    for (const t of [EXTRA_SENTENCES, EXTRA_QUOTES, EXTRA_PARAGRAPHS, EXTRA_FIL_SENTENCES])
      for (const s of [...t.easy, ...t.medium, ...t.hard]) expect(s, s).toMatch(/^[ -~]+$/)
  })
  it('every race type and difficulty still gives text', async () => {
    for (const type of RACE_TEXT_TYPES) for (const d of DIFFICULTIES) expect((await raceText(type, d, 7)).length).toBeGreaterThan(20)
  })
})

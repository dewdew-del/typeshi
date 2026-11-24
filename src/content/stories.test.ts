import { describe, expect, it } from 'vitest'
import { targetForChar } from '../layouts/qwerty'
import { STORIES_EN_CASUAL, STORIES_FIL_CASUAL } from './stories'

describe('built-in stories', () => {
  it('has every story from the server, in both languages', () => {
    expect(STORIES_EN_CASUAL.length).toBeGreaterThanOrEqual(100)
    expect(STORIES_FIL_CASUAL.length).toBeGreaterThanOrEqual(100)
  })
  it('only uses characters on the keyboard', () => {
    for (const s of [...STORIES_EN_CASUAL, ...STORIES_FIL_CASUAL]) {
      for (const c of s.body) if (c !== ' ') expect(targetForChar(c), `story ${s.id}: "${c}"`).toBeDefined()
    }
  })
})

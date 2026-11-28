import { describe, expect, it } from 'vitest'
import { botPosition, type BotLane } from './botLanes'

const lane = (style: string, end_pos = 1): BotLane => ({ user_id: 'b', start_ms: 400, end_ms: 40400, end_pos, style, seed: 7 })

describe('botPosition', () => {
  it('waits for the reaction delay, then ends exactly at end_pos', () => {
    expect(botPosition(lane('fader'), 300, 200).pos).toBe(0)
    expect(botPosition(lane('fader'), 40400, 200).pos).toBe(1)
    expect(botPosition(lane('fader'), 99999, 200).pos).toBe(1)
    expect(botPosition(lane('steady', 0.55), 40400, 200).pos).toBeCloseTo(0.55)
  })

  it('never moves backwards', () => {
    for (const style of ['fader', 'steady', 'sprinter']) {
      let prev = 0
      for (let t = 0; t <= 41000; t += 50) {
        const { pos } = botPosition(lane(style), t, 200)
        expect(pos).toBeGreaterThanOrEqual(prev - 1e-9)
        prev = pos
      }
    }
  })

  it('a fader is ahead of a sprinter halfway through', () => {
    expect(botPosition(lane('fader'), 20400, 200).pos).toBeGreaterThan(botPosition(lane('sprinter'), 20400, 200).pos)
  })
})

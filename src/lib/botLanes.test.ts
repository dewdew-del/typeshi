import { describe, expect, it } from 'vitest'
import { botPosition, type BotLane } from './botLanes'

const lane = (style: string, seed = 7, end_pos = 1): BotLane => ({ user_id: 'b', start_ms: 400, end_ms: 40400, end_pos, style, seed })

describe('botPosition', () => {
  it('waits for the reaction delay, then ends exactly at end_pos', () => {
    expect(botPosition(lane('fader'), 300, 200).pos).toBe(0)
    expect(botPosition(lane('fader'), 40400, 200).pos).toBe(1)
    expect(botPosition(lane('fader'), 99999, 200).pos).toBe(1)
    expect(botPosition(lane('steady', 7, 0.55), 40400, 200).pos).toBeCloseTo(0.55)
  })

  it('stays between 0 and end_pos the whole race', () => {
    for (let seed = 1; seed < 40; seed++) {
      for (let t = 0; t <= 41000; t += 100) {
        const { pos } = botPosition(lane('fader', seed, 0.8), t, 200)
        expect(pos).toBeGreaterThanOrEqual(0)
        expect(pos).toBeLessThanOrEqual(0.8 + 1e-9)
      }
    }
  })

  it('is dramatic: stops, backspaces and bursts in at least some races', () => {
    let stood = false
    let wentBack = false
    let burst = false
    for (let seed = 1; seed < 20; seed++) {
      let prev = 0
      for (let t = 500; t <= 40400; t += 100) {
        const { pos } = botPosition(lane('steady', seed), t, 200)
        const step = pos - prev
        if (t > 1000 && Math.abs(step) < 1e-9 && pos < 1) stood = true
        if (step < -1e-9) wentBack = true
        if (step > (1 / 400) * 1.6) burst = true // faster than 1.6x the average pace for a 100 ms tick
        prev = pos
      }
    }
    expect(stood && wentBack && burst).toBe(true)
  })

  it('a fader is usually ahead of a sprinter halfway through', () => {
    let ahead = 0
    for (let seed = 1; seed <= 20; seed++) {
      if (botPosition(lane('fader', seed), 20400, 200).pos > botPosition(lane('sprinter', seed), 20400, 200).pos) ahead++
    }
    expect(ahead).toBeGreaterThan(12)
  })
})

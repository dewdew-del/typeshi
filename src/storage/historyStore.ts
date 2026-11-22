import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export interface HistoryPoint {
  t: number
  wpm: number
  accuracy: number
}

const MAX = 100

/**
 * One point per finished typing attempt, for the speed-over-time chart on the Progress page.
 * shortcut: kept only in this browser/PC (not synced to the account), upgrade if history should follow sign-in.
 */
export const useHistory = create<{ points: HistoryPoint[]; add: (p: HistoryPoint) => void }>()(
  persist(
    (set) => ({ points: [], add: (p) => set((s) => ({ points: [...s.points, p].slice(-MAX) })) }),
    {
      name: 'typeshi.history',
      version: 1,
      storage: createJSONStorage(() => ({
        getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
        setItem: (k, v) => { try { localStorage.setItem(k, v) } catch { /* blocked storage: history just won't persist */ } },
        removeItem: (k) => { try { localStorage.removeItem(k) } catch { /* ignore */ } },
      })),
    },
  ),
)

/** Each time a run beat every run before it, oldest first: the personal-best history. */
export function personalBests(runs: { t: number; wpm: number }[]): { t: number; wpm: number }[] {
  const out: { t: number; wpm: number }[] = []
  for (const r of [...runs].sort((a, b) => a.t - b.t)) {
    if (r.wpm > (out[out.length - 1]?.wpm ?? 0)) out.push(r)
  }
  return out
}

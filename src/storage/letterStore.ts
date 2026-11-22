import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export const ALPHABET = [...'abcdefghijklmnopqrstuvwxyz']
/** A to D are open from the start. */
export const START_UNLOCKED = 4
/** A round on a letter passes it at this accuracy or better, and passing a letter unlocks the next one. */
export const PASS_ACCURACY = 95

/** How many letters (from A) are unlocked: the first four, then one more for each letter passed in a row. */
export function unlockedCount(passed: string[]): number {
  let n = START_UNLOCKED
  while (n < ALPHABET.length && passed.includes(ALPHABET[n - 1])) n++
  return n
}

/**
 * Letters passed in letter practice.
 * shortcut: kept only in this browser/PC (not synced to the account), upgrade if it should follow sign-in.
 */
export const useLetters = create<{ passed: string[]; pass: (l: string) => void }>()(
  persist(
    (set) => ({ passed: [], pass: (l) => set((s) => (s.passed.includes(l) ? s : { passed: [...s.passed, l] })) }),
    {
      name: 'typeshi.letters',
      version: 1,
      storage: createJSONStorage(() => ({
        getItem: (k) => { try { return localStorage.getItem(k) } catch { return null } },
        setItem: (k, v) => { try { localStorage.setItem(k, v) } catch { /* blocked storage: unlocks just won't persist */ } },
        removeItem: (k) => { try { localStorage.removeItem(k) } catch { /* ignore */ } },
      })),
    },
  ),
)

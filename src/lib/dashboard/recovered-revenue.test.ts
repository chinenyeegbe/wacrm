import { describe, expect, it } from 'vitest'
import { startOfMonthIso } from './recovered-revenue'

describe('startOfMonthIso', () => {
  it('returns the first instant of the local month', () => {
    const now = new Date(2026, 6, 15, 13, 45) // 15 July 2026, local
    const iso = startOfMonthIso(now)
    const parsed = new Date(iso)
    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(6)
    expect(parsed.getDate()).toBe(1)
    expect(parsed.getHours()).toBe(0)
  })

  it('is stable across calls within the same month', () => {
    const a = startOfMonthIso(new Date(2026, 3, 1, 0, 0, 1))
    const b = startOfMonthIso(new Date(2026, 3, 30, 23, 59))
    expect(a).toBe(b)
  })
})

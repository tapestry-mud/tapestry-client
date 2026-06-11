import { describe, it, expect } from 'vitest'
import { hungerTierFromValue } from './hungerTier'

describe('hungerTierFromValue', () => {
  it('returns "full" at the full threshold (67)', () => {
    expect(hungerTierFromValue(67)).toBe('full')
  })

  it('returns "full" above the full threshold', () => {
    expect(hungerTierFromValue(100)).toBe('full')
  })

  it('returns "hungry" just below the full threshold', () => {
    expect(hungerTierFromValue(66)).toBe('hungry')
  })

  it('returns "hungry" at the hungry threshold (34)', () => {
    expect(hungerTierFromValue(34)).toBe('hungry')
  })

  it('returns "famished" just below the hungry threshold', () => {
    expect(hungerTierFromValue(33)).toBe('famished')
  })

  it('returns "famished" at zero', () => {
    expect(hungerTierFromValue(0)).toBe('famished')
  })

  it('returns "" when the value is missing (older servers)', () => {
    expect(hungerTierFromValue(undefined)).toBe('')
    expect(hungerTierFromValue(null)).toBe('')
  })
})

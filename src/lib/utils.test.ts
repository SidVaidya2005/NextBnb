import { describe, it, expect } from 'vitest'
import { formatPrice, nightsBetween } from '@/lib/utils'

describe('formatPrice', () => {
  it('formats whole-dollar cents', () => {
    expect(formatPrice(9500)).toBe('$95.00')
  })

  it('formats thousands with a separator', () => {
    expect(formatPrice(123400)).toBe('$1,234.00')
  })

  it('formats zero', () => {
    expect(formatPrice(0)).toBe('$0.00')
  })

  it('formats sub-dollar cents without floating drift', () => {
    expect(formatPrice(7)).toBe('$0.07')
  })
})

describe('nightsBetween', () => {
  it('counts half-open nights [checkIn, checkOut) — checkout day excluded', () => {
    expect(
      nightsBetween(new Date('2026-08-01'), new Date('2026-08-05')),
    ).toBe(4)
  })

  it('is a single night for consecutive days', () => {
    expect(
      nightsBetween(new Date('2026-08-01'), new Date('2026-08-02')),
    ).toBe(1)
  })

  it('is zero when check-in and check-out are the same day', () => {
    expect(
      nightsBetween(new Date('2026-08-01'), new Date('2026-08-01')),
    ).toBe(0)
  })
})

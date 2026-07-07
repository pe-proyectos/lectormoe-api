import { describe, expect, it } from 'bun:test'
import { computePaidPeriodEnd } from './subscription-period'

describe('computePaidPeriodEnd', () => {
  it('sin nextBillingTime usa lastPayment + 1 mes (caso gerakun)', () => {
    const end = computePaidPeriodEnd({
      nextBillingTime: null,
      lastPaymentTime: '2026-06-28T01:05:08Z',
      interval: 'MONTH'
    })
    expect(end.toISOString()).toBe('2026-07-28T01:05:08.000Z')
  })

  it('nextBillingTime presente gana sobre lastPayment', () => {
    const end = computePaidPeriodEnd({
      nextBillingTime: '2026-08-01T00:00:00Z',
      lastPaymentTime: '2026-06-28T01:05:08Z',
      interval: 'MONTH'
    })
    expect(end.toISOString()).toBe('2026-08-01T00:00:00.000Z')
  })

  it('intervalo null usa MONTH por defecto', () => {
    const end = computePaidPeriodEnd({
      lastPaymentTime: '2026-03-15T12:00:00Z',
      interval: null
    })
    expect(end.toISOString()).toBe('2026-04-15T12:00:00.000Z')
  })

  it('YEAR suma un año', () => {
    const end = computePaidPeriodEnd({
      lastPaymentTime: '2026-06-28T00:00:00Z',
      interval: 'YEAR'
    })
    expect(end.toISOString()).toBe('2027-06-28T00:00:00.000Z')
  })

  it('WEEK suma 7 días y DAY suma 1 día', () => {
    expect(
      computePaidPeriodEnd({
        lastPaymentTime: '2026-06-01T00:00:00Z',
        interval: 'WEEK'
      }).toISOString()
    ).toBe('2026-06-08T00:00:00.000Z')
    expect(
      computePaidPeriodEnd({
        lastPaymentTime: '2026-06-01T00:00:00Z',
        interval: 'DAY'
      }).toISOString()
    ).toBe('2026-06-02T00:00:00.000Z')
  })

  it('sin datos devuelve una fecha cercana a ahora sin lanzar', () => {
    const before = Date.now()
    const end = computePaidPeriodEnd({})
    const after = Date.now()
    expect(end.getTime()).toBeGreaterThanOrEqual(before)
    expect(end.getTime()).toBeLessThanOrEqual(after + 1000)
  })
})

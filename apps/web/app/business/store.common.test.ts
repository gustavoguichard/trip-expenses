import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import {
  configureClock,
  documentSchema,
  newId,
  now,
  observeStamp,
  timestampSchema,
  uuidFromBytes,
} from './store.common.ts'

describe('newId', () => {
  it('produces a valid uuid', () => {
    expect(z.uuid().safeParse(newId()).success).toBe(true)
  })
})

describe('timestampSchema', () => {
  it('accepts plain ISO stamps from old versions', () => {
    expect(timestampSchema.safeParse('2026-08-12T10:00:00.000Z').success).toBe(
      true
    )
  })

  it('accepts hybrid-logical-clock stamps', () => {
    expect(
      timestampSchema.safeParse('2026-08-12T10:00:00.000Z~0042~ab12cd34')
        .success
    ).toBe(true)
  })

  it('rejects other shapes', () => {
    expect(timestampSchema.safeParse('2026-08-12').success).toBe(false)
    expect(timestampSchema.safeParse('yesterday').success).toBe(false)
    expect(
      timestampSchema.safeParse('2026-08-12T10:00:00.000Z~42').success
    ).toBe(false)
  })
})

describe('now', () => {
  afterEach(() => {
    vi.useRealTimers()
    configureClock(newId())
  })

  it('emits hybrid stamps that parse and sort after their wall time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-12T10:00:00.000Z'))
    configureClock('aaaa1111-0000-0000-0000-000000000000')

    const stamp = now()
    expect(timestampSchema.safeParse(stamp).success).toBe(true)
    expect(stamp.startsWith('2026-08-12T10:00:00.000Z~')).toBe(true)
    expect(stamp > '2026-08-12T10:00:00.000Z').toBe(true)
    expect(stamp < '2026-08-12T10:00:00.001Z').toBe(true)
  })

  it('stays strictly increasing while wall time stands still', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-12T10:00:00.000Z'))
    configureClock('aaaa1111-0000-0000-0000-000000000000')

    const first = now()
    const second = now()
    const third = now()
    expect(second > first).toBe(true)
    expect(third > second).toBe(true)
  })

  it('outranks observed stamps even when its wall clock runs behind', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-12T10:00:00.000Z'))
    configureClock('aaaa1111-0000-0000-0000-000000000000')

    const fromFasterDevice = '2026-08-12T12:00:00.000Z~0003~ffff9999'
    observeStamp(fromFasterDevice)

    const first = now()
    expect(first > fromFasterDevice).toBe(true)
    expect(first.startsWith('2026-08-12T12:00:00.000Z~')).toBe(true)

    observeStamp('2026-08-12T12:00:00.000Z~0010~ffff9999')
    const second = now()
    expect(second > '2026-08-12T12:00:00.000Z~0010~ffff9999').toBe(true)
    expect(second > first).toBe(true)
  })

  it('treats an observed plain ISO stamp as a clock to outrun', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-12T10:00:00.000Z'))
    configureClock('aaaa1111-0000-0000-0000-000000000000')

    observeStamp('2026-08-12T11:30:00.000Z')
    const stamp = now()
    expect(stamp > '2026-08-12T11:30:00.000Z').toBe(true)
    expect(stamp.startsWith('2026-08-12T11:30:00.000Z~')).toBe(true)
  })
})

describe('documentSchema', () => {
  it('still parses a document written before fieldStamps existed', () => {
    const legacyDocument = {
      version: 1,
      trips: [
        {
          id: '6f9a1c2e-8b4d-4f3a-9c1e-2d7b5a8e4f01',
          name: 'Chapada',
          emoji: '🏞️',
          currency: 'BRL',
          members: [
            {
              id: '3b2e9d4c-1a5f-4e8b-8c7d-6f0a2b9e5d13',
              name: 'Guga',
              emoji: '🧑‍🚀',
              deviceIds: ['device-1'],
              updatedAt: '2026-08-01T12:00:00.000Z',
              deletedAt: null,
            },
          ],
          expenses: [
            {
              id: '9c8b7a6d-5e4f-4a3b-9c1d-0e9f8a7b6c25',
              description: 'Jantar',
              categoryId: 'food',
              amountCents: 4200,
              date: '2026-08-01',
              paidBy: '3b2e9d4c-1a5f-4e8b-8c7d-6f0a2b9e5d13',
              shares: [
                {
                  memberId: '3b2e9d4c-1a5f-4e8b-8c7d-6f0a2b9e5d13',
                  amountCents: 4200,
                },
              ],
              kind: 'expense',
              updatedAt: '2026-08-01T12:05:00.000Z',
              deletedAt: null,
            },
          ],
          updatedAt: '2026-08-01T12:05:00.000Z',
          deletedAt: null,
        },
      ],
    }

    const parsed = documentSchema.safeParse(legacyDocument)
    expect(parsed.success).toBe(true)
    expect(parsed.data?.trips[0]?.fieldStamps).toBeUndefined()
  })
})

describe('uuidFromBytes', () => {
  it('formats random bytes as a valid uuid v4', () => {
    const id = uuidFromBytes(crypto.getRandomValues(new Uint8Array(16)))
    expect(z.uuid().safeParse(id).success).toBe(true)
    expect(id[14]).toBe('4')
    expect(['8', '9', 'a', 'b']).toContain(id[19])
  })
})

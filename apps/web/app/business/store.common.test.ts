import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { documentSchema, newId, uuidFromBytes } from './store.common.ts'

describe('newId', () => {
  it('produces a valid uuid', () => {
    expect(z.uuid().safeParse(newId()).success).toBe(true)
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

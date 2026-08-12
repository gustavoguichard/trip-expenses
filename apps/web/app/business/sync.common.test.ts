import { fromSuccess } from 'composable-functions'
import { describe, expect, it } from 'vitest'

import { compress, decompress } from '../framework/sync-codec.ts'
import { addExpense, deleteExpense, equalShares } from './expenses.common.ts'
import { seedTrip, tripOf } from './fixtures.common.ts'
import { activeExpenses, activeMembers, emptyDocument } from './store.common.ts'
import {
  encodedFromLinkHash,
  importTrip,
  inviteLinkHash,
  makeInvitePayload,
  mergeTrip,
  parseInvitePayload,
  unsharedChanges,
} from './sync.common.ts'
import { claimMember, updateTrip } from './trips.common.ts'

const later = (iso: string) =>
  new Date(new Date(iso).getTime() + 60_000).toISOString()

describe('invite payload', () => {
  it('round-trips through JSON', async () => {
    const { trip, ana } = await seedTrip()
    const payload = makeInvitePayload(trip, ana.id)
    const parsed = parseInvitePayload(JSON.stringify(payload))

    expect(parsed?.trip.id).toBe(trip.id)
    expect(parsed?.inviteMemberId).toBe(ana.id)
  })

  it('rejects garbage', () => {
    expect(parseInvitePayload('not json')).toBeNull()
    expect(parseInvitePayload('{"kind":"other"}')).toBeNull()
  })
})

describe('invite link fragment', () => {
  it('round-trips the encoded payload through the hash', () => {
    expect(encodedFromLinkHash(inviteLinkHash('abc-123_XYZ'))).toBe(
      'abc-123_XYZ'
    )
  })

  it('rejects hashes that do not carry a payload', () => {
    expect(encodedFromLinkHash('')).toBeNull()
    expect(encodedFromLinkHash('#other=abc')).toBeNull()
    expect(encodedFromLinkHash('s=abc')).toBeNull()
  })

  it('carries a full trip from link to payload', async () => {
    const { trip, ana } = await seedTrip()
    const encoded = await compress(
      JSON.stringify(makeInvitePayload(trip, ana.id))
    )
    const hash = inviteLinkHash(encoded)

    const carried = encodedFromLinkHash(hash)
    expect(carried).not.toBeNull()
    const parsed = parseInvitePayload(await decompress(carried ?? ''))

    expect(parsed?.trip.id).toBe(trip.id)
    expect(parsed?.inviteMemberId).toBe(ana.id)
  })
})

describe('mergeTrip', () => {
  it('keeps the newer trip fields and unions expenses', async () => {
    const { document, trip, guga, ana, leo } = await seedTrip()

    const mineResult = await fromSuccess(addExpense)(
      {
        tripId: trip.id,
        description: 'Mine only',
        categoryId: 'food',
        amountCents: 3000,
        date: '2026-08-10',
        paidBy: guga.id,
        shares: equalShares(3000, [guga.id, ana.id]),
      },
      { document }
    )
    const mine = tripOf(mineResult.document, trip.id)

    const renamed = await fromSuccess(updateTrip)(
      { tripId: trip.id, name: 'Chapada dos Veadeiros' },
      { document }
    )
    const theirsResult = await fromSuccess(addExpense)(
      {
        tripId: trip.id,
        description: 'Theirs only',
        categoryId: 'transport',
        amountCents: 2000,
        date: '2026-08-11',
        paidBy: leo.id,
        shares: equalShares(2000, [leo.id, ana.id]),
      },
      { document: renamed.document }
    )
    const theirs = {
      ...tripOf(theirsResult.document, trip.id),
      updatedAt: later(mine.updatedAt),
    }

    const merged = mergeTrip(mine, theirs)

    expect(merged.name).toBe('Chapada dos Veadeiros')
    expect(
      activeExpenses(merged)
        .map((e) => e.description)
        .sort()
    ).toEqual(['Mine only', 'Theirs only'])
  })

  it('lets a newer deletion win over an older edit', async () => {
    const { document, trip, guga, ana } = await seedTrip()
    const added = await fromSuccess(addExpense)(
      {
        tripId: trip.id,
        description: 'Contested',
        categoryId: 'food',
        amountCents: 3000,
        date: '2026-08-10',
        paidBy: guga.id,
        shares: equalShares(3000, [guga.id, ana.id]),
      },
      { document }
    )
    const mine = tripOf(added.document, trip.id)

    const deletedResult = await fromSuccess(deleteExpense)(
      { tripId: trip.id, expenseId: added.expenseId },
      { document: added.document }
    )
    const deletedTrip = tripOf(deletedResult.document, trip.id)
    const theirs = {
      ...deletedTrip,
      expenses: deletedTrip.expenses.map((expense) => ({
        ...expense,
        updatedAt: later(expense.updatedAt),
        deletedAt: later(expense.updatedAt),
      })),
    }

    const merged = mergeTrip(mine, theirs)
    expect(activeExpenses(merged)).toHaveLength(0)
  })

  it('unions device claims across copies', async () => {
    const { document, trip, guga } = await seedTrip()

    const mineClaim = await fromSuccess(claimMember)(
      { tripId: trip.id, memberId: guga.id, deviceId: 'phone' },
      { document }
    )
    const theirsClaim = await fromSuccess(claimMember)(
      { tripId: trip.id, memberId: guga.id, deviceId: 'tablet' },
      { document }
    )

    const merged = mergeTrip(
      tripOf(mineClaim.document, trip.id),
      tripOf(theirsClaim.document, trip.id)
    )
    const member = activeMembers(merged).find((m) => m.id === guga.id)
    expect(member?.deviceIds.sort()).toEqual(['phone', 'tablet'])
  })
})

describe('unsharedChanges', () => {
  it('stays quiet for a never-shared trip without expenses', async () => {
    const { trip } = await seedTrip()
    expect(unsharedChanges(trip, null)).toBe(0)
  })

  it('counts everything once a never-shared trip has expenses', async () => {
    const { document, trip, guga, ana } = await seedTrip()
    const added = await fromSuccess(addExpense)(
      {
        tripId: trip.id,
        description: 'Jantar',
        categoryId: 'food',
        amountCents: 3000,
        date: '2026-08-10',
        paidBy: guga.id,
        shares: equalShares(3000, [guga.id, ana.id]),
      },
      { document }
    )
    const withExpense = tripOf(added.document, trip.id)
    expect(unsharedChanges(withExpense, null)).toBe(5)
  })

  it('counts only entities newer than the share stamp', async () => {
    const { document, trip, guga, ana } = await seedTrip()
    const sharedAt = trip.updatedAt
    expect(unsharedChanges(trip, sharedAt)).toBe(0)

    const added = await fromSuccess(addExpense)(
      {
        tripId: trip.id,
        description: 'Jantar',
        categoryId: 'food',
        amountCents: 3000,
        date: '2026-08-10',
        paidBy: guga.id,
        shares: equalShares(3000, [guga.id, ana.id]),
      },
      { document }
    )
    const edited = tripOf(added.document, trip.id)
    const bumped = {
      ...edited,
      updatedAt: later(sharedAt),
      expenses: edited.expenses.map((expense) => ({
        ...expense,
        updatedAt: later(sharedAt),
      })),
    }
    expect(unsharedChanges(bumped, sharedAt)).toBe(2)
  })

  it('counts a deletion as an unshared change', async () => {
    const { document, trip, guga, ana } = await seedTrip()
    const added = await fromSuccess(addExpense)(
      {
        tripId: trip.id,
        description: 'Jantar',
        categoryId: 'food',
        amountCents: 3000,
        date: '2026-08-10',
        paidBy: guga.id,
        shares: equalShares(3000, [guga.id, ana.id]),
      },
      { document }
    )
    const sharedAt = tripOf(added.document, trip.id).updatedAt

    const deleted = await fromSuccess(deleteExpense)(
      { tripId: trip.id, expenseId: added.expenseId },
      { document: added.document }
    )
    const afterDelete = tripOf(deleted.document, trip.id)
    const tombstoned = {
      ...afterDelete,
      updatedAt: later(sharedAt),
      expenses: afterDelete.expenses.map((expense) => ({
        ...expense,
        updatedAt: later(sharedAt),
        deletedAt: later(sharedAt),
      })),
    }
    expect(unsharedChanges(tombstoned, sharedAt)).toBe(2)
  })
})

describe('importTrip', () => {
  it('adds an unknown trip and merges a known one', async () => {
    const { trip } = await seedTrip()

    const fresh = importTrip(emptyDocument(), trip)
    expect(fresh.trips).toHaveLength(1)

    const again = importTrip(fresh, { ...trip, name: 'Renamed elsewhere' })
    expect(again.trips).toHaveLength(1)
  })
})

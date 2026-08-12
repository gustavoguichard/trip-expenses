import { fromSuccess } from 'composable-functions'
import { describe, expect, it } from 'vitest'

import { addExpense, equalShares } from './expenses.common.ts'
import { seedTrip, tripOf } from './fixtures.common.ts'
import { activeMembers, findTrip } from './store.common.ts'
import {
  addMember,
  claimMember,
  createTrip,
  deleteTrip,
  myMember,
  removeMember,
} from './trips.common.ts'

describe('createTrip', () => {
  it('creates a trip with its founding members', async () => {
    const { document, trip } = await seedTrip()

    expect(document.trips).toHaveLength(1)
    expect(trip.currency).toBe('BRL')
    expect(activeMembers(trip).map((member) => member.name)).toEqual([
      'Guga',
      'Ana',
      'Léo',
    ])
  })

  it('requires at least one member', async () => {
    const result = await createTrip(
      { name: 'Solo', emoji: '🧳', currency: 'USD', members: [] },
      { document: { version: 1, trips: [] } }
    )
    expect(result.success).toBe(false)
  })
})

describe('deleteTrip', () => {
  it('tombstones the trip instead of erasing it', async () => {
    const { document, trip } = await seedTrip()
    const deleted = await fromSuccess(deleteTrip)(
      { tripId: trip.id },
      { document }
    )

    expect(findTrip(deleted.document, trip.id)).toBeNull()
    expect(deleted.document.trips).toHaveLength(1)
    expect(deleted.document.trips[0]?.deletedAt).not.toBeNull()
  })
})

describe('members', () => {
  it('adds a member to an existing trip', async () => {
    const { document, trip } = await seedTrip()
    const added = await fromSuccess(addMember)(
      { tripId: trip.id, name: 'Bia', emoji: '🐙' },
      { document }
    )

    const updated = tripOf(added.document, trip.id)
    expect(activeMembers(updated)).toHaveLength(4)
  })

  it('refuses to remove a member who has expenses', async () => {
    const { document, trip, guga, ana } = await seedTrip()
    const spent = await fromSuccess(addExpense)(
      {
        tripId: trip.id,
        description: 'Boat day',
        categoryId: 'activities',
        amountCents: 9000,
        date: '2026-08-10',
        paidBy: guga.id,
        shares: equalShares(9000, [guga.id, ana.id]),
      },
      { document }
    )

    const result = await removeMember(
      { tripId: trip.id, memberId: ana.id },
      { document: spent.document }
    )
    expect(result.success).toBe(false)
  })

  it('removes an uninvolved member with a tombstone', async () => {
    const { document, trip, leo } = await seedTrip()
    const removed = await fromSuccess(removeMember)(
      { tripId: trip.id, memberId: leo.id },
      { document }
    )

    const updated = tripOf(removed.document, trip.id)
    expect(activeMembers(updated).map((member) => member.name)).toEqual([
      'Guga',
      'Ana',
    ])
  })
})

describe('claimMember', () => {
  it('binds a device to one member at a time', async () => {
    const { document, trip, guga, ana } = await seedTrip()

    const first = await fromSuccess(claimMember)(
      { tripId: trip.id, memberId: guga.id, deviceId: 'device-1' },
      { document }
    )
    const second = await fromSuccess(claimMember)(
      { tripId: trip.id, memberId: ana.id, deviceId: 'device-1' },
      { document: first.document }
    )

    const updated = tripOf(second.document, trip.id)
    expect(myMember(updated, 'device-1')?.id).toBe(ana.id)
    const previous = activeMembers(updated).find(
      (member) => member.id === guga.id
    )
    expect(previous?.deviceIds).toEqual([])
  })
})

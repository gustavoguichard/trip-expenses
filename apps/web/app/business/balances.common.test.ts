import { fromSuccess } from 'composable-functions'
import { describe, expect, it } from 'vitest'

import {
  memberBalances,
  simplifyDebts,
  totalsByCategory,
  totalsByDay,
  totalsByMember,
  tripTotal,
} from './balances.common.ts'
import { addExpense, addSettlement, equalShares } from './expenses.common.ts'
import { seedTrip, tripOf } from './fixtures.common.ts'
import type { Share, TripDocument } from './store.common.ts'

async function seedSpending() {
  const seeded = await seedTrip()
  const { trip, guga, ana, leo } = seeded

  let document: TripDocument = seeded.document
  const spend = async (input: {
    description: string
    categoryId: string
    amountCents: number
    date: string
    paidBy: string
    shares: Share[]
  }) => {
    const result = await fromSuccess(addExpense)(
      { tripId: trip.id, ...input },
      { document }
    )
    document = result.document
  }

  await spend({
    description: 'Pousada',
    categoryId: 'lodging',
    amountCents: 9000,
    date: '2026-08-10',
    paidBy: guga.id,
    shares: equalShares(9000, [guga.id, ana.id, leo.id]),
  })
  await spend({
    description: 'Sandboard rental',
    categoryId: 'activities',
    amountCents: 4000,
    date: '2026-08-11',
    paidBy: ana.id,
    shares: [{ memberId: leo.id, amountCents: 4000 }],
  })

  return { ...seeded, document, trip: tripOf(document, trip.id) }
}

describe('memberBalances', () => {
  it('credits payers and debits shares', async () => {
    const { trip, guga, ana, leo } = await seedSpending()
    const balances = memberBalances(trip)

    expect(balances.get(guga.id)).toBe(6000)
    expect(balances.get(ana.id)).toBe(1000)
    expect(balances.get(leo.id)).toBe(-7000)
  })

  it('zeroes out after settling up', async () => {
    const spending = await seedSpending()
    const { trip, guga, ana, leo } = spending

    let document = spending.document
    for (const [to, amountCents] of [
      [guga.id, 6000],
      [ana.id, 1000],
    ] as const) {
      const result = await fromSuccess(addSettlement)(
        { tripId: trip.id, from: leo.id, to, amountCents, date: '2026-08-12' },
        { document }
      )
      document = result.document
    }

    const balances = memberBalances(tripOf(document, trip.id))
    expect([...balances.values()]).toEqual([0, 0, 0])
  })
})

describe('simplifyDebts', () => {
  it('proposes the fewest transfers to settle', async () => {
    const { trip, guga, ana, leo } = await seedSpending()
    const transfers = simplifyDebts(memberBalances(trip))

    expect(transfers).toEqual([
      { from: leo.id, to: guga.id, amountCents: 6000 },
      { from: leo.id, to: ana.id, amountCents: 1000 },
    ])
  })
})

describe('totals', () => {
  it('sums spending and ignores settlements', async () => {
    const spending = await seedSpending()
    const { trip, guga, ana, leo } = spending

    const settled = await fromSuccess(addSettlement)(
      {
        tripId: trip.id,
        from: leo.id,
        to: guga.id,
        amountCents: 6000,
        date: '2026-08-12',
      },
      { document: spending.document }
    )
    const updated = tripOf(settled.document, trip.id)

    expect(tripTotal(updated)).toBe(13000)
    expect(totalsByCategory(updated)).toEqual([
      { categoryId: 'lodging', amountCents: 9000 },
      { categoryId: 'activities', amountCents: 4000 },
    ])
    expect(totalsByDay(updated)).toEqual([
      { date: '2026-08-10', amountCents: 9000 },
      { date: '2026-08-11', amountCents: 4000 },
    ])
    expect(totalsByMember(updated)).toEqual([
      { memberId: guga.id, paidCents: 9000, shareCents: 3000 },
      { memberId: ana.id, paidCents: 4000, shareCents: 3000 },
      { memberId: leo.id, paidCents: 0, shareCents: 7000 },
    ])
  })
})

import { fromSuccess } from 'composable-functions'
import { describe, expect, it } from 'vitest'

import {
  addExpense,
  addSettlement,
  deleteExpense,
  equalShares,
  parseAmount,
  updateExpense,
} from './expenses.common.ts'
import { seedTrip, tripOf } from './fixtures.common.ts'
import { activeExpenses } from './store.common.ts'

describe('parseAmount', () => {
  it('reads plain and decimal amounts in either locale style', () => {
    expect(parseAmount('12')).toBe(1200)
    expect(parseAmount('12.5')).toBe(1250)
    expect(parseAmount('12,50')).toBe(1250)
    expect(parseAmount('R$ 1.234,56')).toBe(123456)
    expect(parseAmount('1,234.56')).toBe(123456)
  })

  it('rejects empty and non-positive amounts', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('0')).toBeNull()
  })
})

describe('equalShares', () => {
  it('distributes remainder cents to the first people', () => {
    expect(equalShares(1000, ['a', 'b', 'c'])).toEqual([
      { memberId: 'a', amountCents: 334 },
      { memberId: 'b', amountCents: 333 },
      { memberId: 'c', amountCents: 333 },
    ])
  })
})

describe('addExpense', () => {
  it('records who paid and how it splits', async () => {
    const { document, trip, guga, ana, leo } = await seedTrip()
    const added = await fromSuccess(addExpense)(
      {
        tripId: trip.id,
        description: 'Dinner at the river',
        categoryId: 'food',
        amountCents: 9000,
        date: '2026-08-10',
        paidBy: guga.id,
        shares: equalShares(9000, [guga.id, ana.id, leo.id]),
      },
      { document }
    )

    const updated = tripOf(added.document, trip.id)
    const expenses = activeExpenses(updated)
    expect(expenses).toHaveLength(1)
    expect(expenses[0]?.kind).toBe('expense')
  })

  it('rejects a split that does not add up', async () => {
    const { document, trip, guga, ana } = await seedTrip()
    const result = await addExpense(
      {
        tripId: trip.id,
        description: 'Broken split',
        categoryId: 'food',
        amountCents: 9000,
        date: '2026-08-10',
        paidBy: guga.id,
        shares: [{ memberId: ana.id, amountCents: 100 }],
      },
      { document }
    )
    expect(result.success).toBe(false)
  })

  it('rejects people who are not on the trip', async () => {
    const { document, trip, guga } = await seedTrip()
    const result = await addExpense(
      {
        tripId: trip.id,
        description: 'Stranger danger',
        categoryId: 'food',
        amountCents: 1000,
        date: '2026-08-10',
        paidBy: guga.id,
        shares: [{ memberId: crypto.randomUUID(), amountCents: 1000 }],
      },
      { document }
    )
    expect(result.success).toBe(false)
  })
})

describe('updateExpense and deleteExpense', () => {
  it('rewrites an expense in place', async () => {
    const { document, trip, guga, ana } = await seedTrip()
    const added = await fromSuccess(addExpense)(
      {
        tripId: trip.id,
        description: 'Taxi',
        categoryId: 'transport',
        amountCents: 4000,
        date: '2026-08-11',
        paidBy: guga.id,
        shares: equalShares(4000, [guga.id, ana.id]),
      },
      { document }
    )

    const updated = await fromSuccess(updateExpense)(
      {
        tripId: trip.id,
        expenseId: added.expenseId,
        description: 'Taxi to the falls',
        categoryId: 'transport',
        amountCents: 5000,
        date: '2026-08-11',
        paidBy: ana.id,
        shares: equalShares(5000, [guga.id, ana.id]),
      },
      { document: added.document }
    )

    const expense = activeExpenses(tripOf(updated.document, trip.id))[0]
    expect(expense?.description).toBe('Taxi to the falls')
    expect(expense?.paidBy).toBe(ana.id)
  })

  it('tombstones a deleted expense', async () => {
    const { document, trip, guga, ana } = await seedTrip()
    const added = await fromSuccess(addExpense)(
      {
        tripId: trip.id,
        description: 'Oops',
        categoryId: 'other',
        amountCents: 1000,
        date: '2026-08-11',
        paidBy: guga.id,
        shares: equalShares(1000, [guga.id, ana.id]),
      },
      { document }
    )

    const deleted = await fromSuccess(deleteExpense)(
      { tripId: trip.id, expenseId: added.expenseId },
      { document: added.document }
    )

    const updated = tripOf(deleted.document, trip.id)
    expect(activeExpenses(updated)).toHaveLength(0)
    expect(updated?.expenses).toHaveLength(1)
  })
})

describe('addSettlement', () => {
  it('records a payment between two people', async () => {
    const { document, trip, guga, ana } = await seedTrip()
    const settled = await fromSuccess(addSettlement)(
      {
        tripId: trip.id,
        from: ana.id,
        to: guga.id,
        amountCents: 3000,
        date: '2026-08-12',
      },
      { document }
    )

    const expense = activeExpenses(tripOf(settled.document, trip.id))[0]
    expect(expense?.kind).toBe('settlement')
    expect(expense?.paidBy).toBe(ana.id)
    expect(expense?.shares).toEqual([{ memberId: guga.id, amountCents: 3000 }])
  })

  it('refuses to settle with yourself', async () => {
    const { document, trip, guga } = await seedTrip()
    const result = await addSettlement(
      {
        tripId: trip.id,
        from: guga.id,
        to: guga.id,
        amountCents: 3000,
        date: '2026-08-12',
      },
      { document }
    )
    expect(result.success).toBe(false)
  })
})

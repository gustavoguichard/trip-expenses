import { applySchema } from 'composable-functions'
import { z } from 'zod'

import { findCategory, settlementCategory } from './categories.common.ts'
import {
  activeExpenses,
  activeMembers,
  documentContextSchema,
  type Expense,
  findTrip,
  now,
  replaceTrip,
  shareSchema,
  type Trip,
} from './store.common.ts'

function parseAmount(input: string) {
  const normalized = input.trim().replace(/[^\d.,-]/g, '')
  if (!normalized) return null
  const lastSeparator = Math.max(
    normalized.lastIndexOf('.'),
    normalized.lastIndexOf(',')
  )
  const digits = (value: string) => value.replace(/\D/g, '')
  const whole =
    lastSeparator === -1 ? normalized : normalized.slice(0, lastSeparator)
  const fraction =
    lastSeparator === -1 ? '' : digits(normalized.slice(lastSeparator + 1))
  const cents =
    fraction.length > 2
      ? Number(digits(whole) + fraction) * 100
      : Number(digits(whole) || '0') * 100 +
        Number(fraction.padEnd(2, '0') || '0')
  if (!Number.isSafeInteger(cents) || cents <= 0) return null
  return cents
}

function equalShares(amountCents: number, memberIds: string[]) {
  const base = Math.floor(amountCents / memberIds.length)
  const remainder = amountCents - base * memberIds.length
  return memberIds
    .map((memberId, index) => ({
      memberId,
      amountCents: base + (index < remainder ? 1 : 0),
    }))
    .filter((share) => share.amountCents > 0)
}

const expenseInputSchema = z.object({
  tripId: z.uuid(),
  description: z.string().trim().min(1).max(200),
  categoryId: z.string().min(1),
  amountCents: z.number().int().positive(),
  date: z.iso.date(),
  paidBy: z.uuid(),
  shares: z.array(shareSchema).min(1),
})

function validateExpense(
  trip: Trip,
  input: Pick<
    z.infer<typeof expenseInputSchema>,
    'categoryId' | 'amountCents' | 'paidBy' | 'shares'
  >
) {
  if (!findCategory(input.categoryId)) throw new Error('Unknown category')

  const memberIds = new Set(activeMembers(trip).map((member) => member.id))
  const involved = [
    input.paidBy,
    ...input.shares.map((share) => share.memberId),
  ]
  if (involved.some((memberId) => !memberIds.has(memberId))) {
    throw new Error('Everyone on the expense must be a member of the trip')
  }

  const shared = input.shares.reduce(
    (total, share) => total + share.amountCents,
    0
  )
  if (shared !== input.amountCents) {
    throw new Error('The split must add up to the full amount')
  }

  const uniqueMembers = new Set(input.shares.map((share) => share.memberId))
  if (uniqueMembers.size !== input.shares.length) {
    throw new Error('Each person can appear only once in the split')
  }
}

const addExpense = applySchema(
  expenseInputSchema,
  documentContextSchema
)(({ tripId, ...input }, { document }) => {
  const trip = findTrip(document, tripId)
  if (!trip) throw new Error('Trip not found')
  validateExpense(trip, input)

  const timestamp = now()
  const expense: Expense = {
    id: crypto.randomUUID(),
    ...input,
    kind: input.categoryId === settlementCategory.id ? 'settlement' : 'expense',
    updatedAt: timestamp,
    deletedAt: null,
  }

  return {
    document: replaceTrip(document, {
      ...trip,
      expenses: [...trip.expenses, expense],
      updatedAt: timestamp,
    }),
    expenseId: expense.id,
  }
})

const updateExpenseSchema = expenseInputSchema.extend({
  expenseId: z.uuid(),
})

const updateExpense = applySchema(
  updateExpenseSchema,
  documentContextSchema
)(({ tripId, expenseId, ...input }, { document }) => {
  const trip = findTrip(document, tripId)
  if (!trip) throw new Error('Trip not found')

  const expense = activeExpenses(trip).find(
    (candidate) => candidate.id === expenseId
  )
  if (!expense) throw new Error('Expense not found')
  validateExpense(trip, input)

  const timestamp = now()
  const updated: Expense = {
    ...expense,
    ...input,
    kind: input.categoryId === settlementCategory.id ? 'settlement' : 'expense',
    updatedAt: timestamp,
  }

  return { document: replaceTrip(document, withExpense(trip, updated)) }
})

const deleteExpenseSchema = z.object({
  tripId: z.uuid(),
  expenseId: z.uuid(),
})

const deleteExpense = applySchema(
  deleteExpenseSchema,
  documentContextSchema
)(({ tripId, expenseId }, { document }) => {
  const trip = findTrip(document, tripId)
  if (!trip) throw new Error('Trip not found')

  const expense = activeExpenses(trip).find(
    (candidate) => candidate.id === expenseId
  )
  if (!expense) throw new Error('Expense not found')

  const timestamp = now()
  const deleted: Expense = {
    ...expense,
    updatedAt: timestamp,
    deletedAt: timestamp,
  }

  return { document: replaceTrip(document, withExpense(trip, deleted)) }
})

const addSettlementSchema = z.object({
  tripId: z.uuid(),
  from: z.uuid(),
  to: z.uuid(),
  amountCents: z.number().int().positive(),
  date: z.iso.date(),
})

const addSettlement = applySchema(
  addSettlementSchema,
  documentContextSchema
)(async ({ tripId, from, to, amountCents, date }, { document }) => {
  if (from === to) throw new Error('Choose two different people')
  const trip = findTrip(document, tripId)
  if (!trip) throw new Error('Trip not found')

  const payer = activeMembers(trip).find((member) => member.id === from)
  const receiver = activeMembers(trip).find((member) => member.id === to)
  if (!payer || !receiver) throw new Error('Member not found')

  const result = await addExpense(
    {
      tripId,
      description: `${payer.name} paid ${receiver.name}`,
      categoryId: settlementCategory.id,
      amountCents,
      date,
      paidBy: from,
      shares: [{ memberId: to, amountCents }],
    },
    { document }
  )
  if (!result.success) throw new Error('Could not record the payment')
  return result.data
})

function withExpense(trip: Trip, expense: Expense): Trip {
  return {
    ...trip,
    expenses: trip.expenses.map((candidate) =>
      candidate.id === expense.id ? expense : candidate
    ),
    updatedAt: expense.updatedAt,
  }
}

export {
  addExpense,
  addSettlement,
  deleteExpense,
  equalShares,
  parseAmount,
  updateExpense,
}

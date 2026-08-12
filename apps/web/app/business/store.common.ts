import { z } from 'zod'

const timestampSchema = z.iso.datetime()

const shareSchema = z.object({
  memberId: z.uuid(),
  amountCents: z.number().int().positive(),
})

const memberSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(60),
  emoji: z.string().min(1).max(16),
  deviceIds: z.array(z.string()).default([]),
  updatedAt: timestampSchema,
  deletedAt: timestampSchema.nullable().default(null),
})

const expenseSchema = z.object({
  id: z.uuid(),
  description: z.string().trim().min(1).max(200),
  categoryId: z.string().min(1),
  amountCents: z.number().int().positive(),
  date: z.iso.date(),
  paidBy: z.uuid(),
  shares: z.array(shareSchema).min(1),
  kind: z.enum(['expense', 'settlement']).default('expense'),
  updatedAt: timestampSchema,
  deletedAt: timestampSchema.nullable().default(null),
})

const tripSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(80),
  emoji: z.string().min(1).max(16),
  currency: z.string().length(3).toUpperCase(),
  members: z.array(memberSchema).default([]),
  expenses: z.array(expenseSchema).default([]),
  updatedAt: timestampSchema,
  deletedAt: timestampSchema.nullable().default(null),
})

const documentSchema = z.object({
  version: z.literal(1),
  trips: z.array(tripSchema).default([]),
})

const documentContextSchema = z.object({ document: documentSchema })

type Share = z.infer<typeof shareSchema>
type Member = z.infer<typeof memberSchema>
type Expense = z.infer<typeof expenseSchema>
type Trip = z.infer<typeof tripSchema>
type TripDocument = z.infer<typeof documentSchema>

const emptyDocument = (): TripDocument => ({ version: 1, trips: [] })

const now = () => new Date().toISOString()

const isActive = <Entity extends { deletedAt: string | null }>(
  entity: Entity
) => entity.deletedAt === null

const activeTrips = (document: TripDocument) => document.trips.filter(isActive)

const activeMembers = (trip: Trip) => trip.members.filter(isActive)

const activeExpenses = (trip: Trip) => trip.expenses.filter(isActive)

const findTrip = (document: TripDocument, tripId: string) =>
  document.trips.find((trip) => trip.id === tripId && isActive(trip)) ?? null

function replaceTrip(document: TripDocument, trip: Trip): TripDocument {
  return {
    ...document,
    trips: document.trips.map((candidate) =>
      candidate.id === trip.id ? trip : candidate
    ),
  }
}

export type { Expense, Member, Share, Trip, TripDocument }
export {
  activeExpenses,
  activeMembers,
  activeTrips,
  documentContextSchema,
  documentSchema,
  emptyDocument,
  expenseSchema,
  findTrip,
  isActive,
  memberSchema,
  now,
  replaceTrip,
  shareSchema,
  tripSchema,
}

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

const tripFieldStampsSchema = z.object({
  name: timestampSchema.optional(),
  emoji: timestampSchema.optional(),
  currency: timestampSchema.optional(),
})

const tripSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(80),
  emoji: z.string().min(1).max(16),
  currency: z.string().length(3).toUpperCase(),
  members: z.array(memberSchema).default([]),
  expenses: z.array(expenseSchema).default([]),
  fieldStamps: tripFieldStampsSchema.optional(),
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
type TripFieldStamps = z.infer<typeof tripFieldStampsSchema>
type Trip = z.infer<typeof tripSchema>
type TripDocument = z.infer<typeof documentSchema>

const emptyDocument = (): TripDocument => ({ version: 1, trips: [] })

function uuidFromBytes(bytes: Uint8Array): string {
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const newId = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : uuidFromBytes(crypto.getRandomValues(new Uint8Array(16)))

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

export type { Expense, Member, Share, Trip, TripDocument, TripFieldStamps }
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
  newId,
  now,
  replaceTrip,
  shareSchema,
  tripSchema,
  uuidFromBytes,
}

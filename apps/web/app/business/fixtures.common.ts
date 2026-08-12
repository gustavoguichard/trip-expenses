import { fromSuccess } from 'composable-functions'

import { emptyDocument, findTrip, type TripDocument } from './store.common.ts'
import { createTrip } from './trips.common.ts'

function tripOf(document: TripDocument, tripId: string) {
  const trip = findTrip(document, tripId)
  if (!trip) throw new Error('Trip not found in document')
  return trip
}

async function seedTrip(document: TripDocument = emptyDocument()) {
  const created = await fromSuccess(createTrip)(
    {
      name: 'Chapada',
      emoji: '🏞️',
      currency: 'BRL',
      members: [
        { name: 'Guga', emoji: '🧑‍🚀' },
        { name: 'Ana', emoji: '🦊' },
        { name: 'Léo', emoji: '🐸' },
      ],
    },
    { document }
  )

  const trip = created.document.trips.find(
    (candidate) => candidate.id === created.tripId
  )
  if (!trip) throw new Error('Seeded trip missing')

  const [guga, ana, leo] = trip.members
  if (!guga || !ana || !leo) throw new Error('Seeded members missing')

  return { document: created.document, trip, guga, ana, leo }
}

export { seedTrip, tripOf }

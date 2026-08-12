import { readdirSync } from 'node:fs'
import { fromSuccess } from 'composable-functions'
import { describe, expect, it } from 'vitest'
import { addExpense, equalShares } from '../business/expenses.common.ts'
import { seedTrip } from '../business/fixtures.common.ts'
import { deleteTrip } from '../business/trips.common.ts'
import { routes } from '../routes.ts'
import { offlineUrls, screenModuleUrls, warmedUrlLimit } from './offline.ts'

describe('offlineUrls', () => {
  it('lists the static pages for an empty document', async () => {
    const { document } = await seedTrip()
    const deleted = await fromSuccess(deleteTrip)(
      { tripId: document.trips[0]?.id },
      { document }
    )

    expect(offlineUrls(deleted.document)).toEqual([
      routes.home.href(),
      routes.join.href(),
      routes.trips.new.href(),
    ])
  })

  it('lists every screen of every active trip and no per-expense pages', async () => {
    const { document, trip, guga, ana } = await seedTrip()
    const added = await fromSuccess(addExpense)(
      {
        tripId: trip.id,
        description: 'Dinner at the river',
        categoryId: 'food',
        amountCents: 9000,
        date: '2026-08-10',
        paidBy: guga.id,
        shares: equalShares(9000, [guga.id, ana.id]),
      },
      { document }
    )

    const tripId = trip.id
    expect(offlineUrls(added.document)).toEqual([
      routes.home.href(),
      routes.join.href(),
      routes.trips.new.href(),
      routes.trips.show.href({ tripId }),
      routes.trips.newExpense.href({ tripId }),
      routes.trips.balances.href({ tripId }),
      routes.trips.charts.href({ tripId }),
      routes.trips.members.href({ tripId }),
      routes.trips.invite.href({ tripId }),
    ])
  })

  it('caps the list', async () => {
    let { document, trip } = await seedTrip()
    for (let index = 0; index < 40; index += 1) {
      const seeded = await seedTrip(document)
      document = seeded.document
    }

    const urls = offlineUrls(document)
    expect(urls).toHaveLength(warmedUrlLimit)
    expect(urls).toContain(routes.trips.invite.href({ tripId: trip.id }))
  })
})

describe('screenModuleUrls', () => {
  it('resolves every screen module in app/assets to its served asset URL', () => {
    const screenFiles = readdirSync(new URL('.', import.meta.url))
      .filter((file) => file.endsWith('-screen.tsx'))
      .sort()

    expect(screenModuleUrls().sort()).toEqual(
      screenFiles.map((file) =>
        routes.assets.href({ path: `app/assets/${file}` })
      )
    )
  })
})

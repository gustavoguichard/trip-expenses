import { activeTrips, type TripDocument } from '../business/store.common.ts'
import { routes } from '../routes.ts'

const warmedUrlLimit = 200

const screenModuleFiles = [
  'balances-screen.tsx',
  'charts-screen.tsx',
  'expense-form-screen.tsx',
  'expenses-screen.tsx',
  'invite-screen.tsx',
  'join-screen.tsx',
  'members-screen.tsx',
  'trip-new-screen.tsx',
  'trips-screen.tsx',
]

function screenModuleUrls(): string[] {
  return screenModuleFiles.map((file) =>
    routes.assets.href({ path: `app/assets/${file}` })
  )
}

let screenModulesWarmed = false

async function warmScreenModules() {
  if (screenModulesWarmed || !navigator.serviceWorker?.controller) return
  screenModulesWarmed = true
  for (const url of screenModuleUrls()) {
    await import(url).catch(() => {})
  }
}

function offlineUrls(document: TripDocument): string[] {
  const trips = activeTrips(document)
  const urls = [
    routes.home.href(),
    routes.join.href(),
    routes.trips.new.href(),
    ...trips.flatMap(({ id: tripId }) => [
      routes.trips.show.href({ tripId }),
      routes.trips.newExpense.href({ tripId }),
      routes.trips.balances.href({ tripId }),
      routes.trips.charts.href({ tripId }),
      routes.trips.members.href({ tripId }),
      routes.trips.invite.href({ tripId }),
    ]),
  ]
  return urls.slice(0, warmedUrlLimit)
}

function warmOfflineCache(document: TripDocument) {
  const controller = navigator.serviceWorker?.controller
  if (!controller) return
  controller.postMessage({ type: 'warm-routes', urls: offlineUrls(document) })
}

export {
  offlineUrls,
  screenModuleUrls,
  warmedUrlLimit,
  warmOfflineCache,
  warmScreenModules,
}

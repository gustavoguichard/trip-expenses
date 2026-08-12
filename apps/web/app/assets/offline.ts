import {
  activeExpenses,
  activeTrips,
  type TripDocument,
} from '../business/store.common.ts'
import { routes } from '../routes.ts'

const warmedUrlLimit = 200

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
    ...trips.flatMap((trip) =>
      activeExpenses(trip).map((expense) =>
        routes.trips.expense.href({ tripId: trip.id, expenseId: expense.id })
      )
    ),
  ]
  return urls.slice(0, warmedUrlLimit)
}

function warmOfflineCache(document: TripDocument) {
  const controller = navigator.serviceWorker?.controller
  if (!controller) return
  controller.postMessage({ type: 'warm-routes', urls: offlineUrls(document) })
}

export { offlineUrls, warmedUrlLimit, warmOfflineCache }

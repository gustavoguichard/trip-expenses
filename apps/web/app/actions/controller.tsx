import { createController } from 'remix/router'
import { JoinScreen } from '../assets/join-screen.tsx'
import { TripsScreen } from '../assets/trips-screen.tsx'
import { assetServer } from '../assets.ts'
import { routes } from '../routes.ts'
import { AppShell } from '../ui/app-shell.tsx'

export default createController(routes, {
  actions: {
    async assets(context) {
      return (
        (await assetServer.fetch(context.request)) ??
        new Response('Not Found', { status: 404 })
      )
    },
    home(context) {
      return context.render(
        <AppShell>
          <TripsScreen />
        </AppShell>
      )
    },
    join(context) {
      return context.render(
        <AppShell title="Escanear código — Trip Expenses">
          <JoinScreen />
        </AppShell>
      )
    },
  },
})

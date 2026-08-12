import type { Handle } from 'remix/ui'
import { clientEntry } from 'remix/ui'

import { tripTotal } from '../business/balances.common.ts'
import {
  activeMembers,
  activeTrips,
  type Trip,
} from '../business/store.common.ts'
import { routes } from '../routes.ts'
import { formatCents } from './money.ts'
import { bindDocument } from './store.ts'
import { Loading } from './trip-chrome.tsx'
import { Avatar, buttonGhost, buttonPrimary } from './widgets.tsx'

function TripCard(handle: Handle<{ trip: Trip }>) {
  return () => {
    const { trip } = handle.props
    const members = activeMembers(trip)

    return (
      <a
        href={routes.trips.show.href({ tripId: trip.id })}
        class="group flex items-center gap-4 rounded-2xl border border-line bg-panel px-4 py-4 transition-colors hover:border-amber/60"
      >
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line-bright bg-raised text-[22px]">
          {trip.emoji}
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-[16px] font-semibold tracking-tight">
            {trip.name}
          </span>
          <span class="mt-1.5 flex items-center">
            {members.slice(0, 6).map((member, index) => (
              <span
                key={member.id}
                class={index === 0 ? '' : '-ml-2'}
                title={member.name}
              >
                <Avatar emoji={member.emoji} size="sm" />
              </span>
            ))}
            {members.length > 6 ? (
              <span class="mono-caption ml-2 text-faint">
                +{members.length - 6}
              </span>
            ) : null}
          </span>
        </span>
        <span class="text-right">
          <span class="tabular block text-[15px] font-semibold text-amber">
            {formatCents(tripTotal(trip), trip.currency)}
          </span>
          <span class="mono-caption text-faint">total</span>
        </span>
      </a>
    )
  }
}

function EmptyState() {
  return () => (
    <div class="relative overflow-hidden rounded-2xl border border-line bg-panel px-6 py-16 text-center">
      <svg
        viewBox="0 0 600 200"
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 h-full w-full opacity-40"
        preserveAspectRatio="none"
      >
        <path
          d="M-20 170 C 120 170, 150 40, 300 40 S 480 140, 620 60"
          fill="none"
          stroke="var(--color-amber)"
          stroke-width="2"
          stroke-linecap="round"
          stroke-dasharray="0.1 12"
          opacity="0.5"
        />
      </svg>
      <p class="relative text-[26px]">🏕️</p>
      <h2 class="relative mt-3 text-[20px] font-bold tracking-tight">
        Divida as contas, mantenha os amigos
      </h2>
      <p class="mono-caption relative mx-auto mt-2 max-w-sm text-muted">
        Tudo fica neste aparelho — sem contas, sem servidores. Comece uma viagem
        ou escaneie o código de um amigo para entrar na dele.
      </p>
      <div class="relative mt-7 flex flex-wrap justify-center gap-3">
        <a href={routes.trips.new.href()} class={buttonPrimary}>
          Começar uma viagem
        </a>
        <a href={routes.join.href()} class={buttonGhost}>
          Escanear um código
        </a>
      </div>
    </div>
  )
}

export const TripsScreen = clientEntry(
  import.meta.url,
  function TripsScreen(handle: Handle) {
    const data = bindDocument(handle)

    return () => {
      if (!data.ready()) {
        return (
          <div mix={data.mount}>
            <Loading />
          </div>
        )
      }

      const trips = activeTrips(data.document())

      return (
        <div mix={data.mount}>
          <div class="mb-5 flex items-center justify-between">
            <h1 class="text-[22px] font-bold tracking-tight">Viagens</h1>
            {trips.length > 0 ? (
              <a href={routes.trips.new.href()} class={buttonPrimary}>
                + Nova viagem
              </a>
            ) : null}
          </div>
          {trips.length === 0 ? (
            <EmptyState />
          ) : (
            <div class="grid gap-3">
              {trips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          )}
        </div>
      )
    }
  }
)

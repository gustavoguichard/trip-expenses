import type { Handle } from 'remix/ui'

import { tripTotal } from '../business/balances.common.ts'
import { activeMembers, type Trip } from '../business/store.common.ts'
import { unsharedChanges } from '../business/sync.common.ts'
import { routes } from '../routes.ts'
import { formatCents } from './money.ts'
import { lastSharedAt } from './store.ts'

type TabKey = 'expenses' | 'balances' | 'charts' | 'people'

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'expenses', label: 'Despesas' },
  { key: 'balances', label: 'Saldos' },
  { key: 'charts', label: 'Gráficos' },
  { key: 'people', label: 'Pessoas' },
]

function tabHref(tab: TabKey, tripId: string) {
  if (tab === 'balances') return routes.trips.balances.href({ tripId })
  if (tab === 'charts') return routes.trips.charts.href({ tripId })
  if (tab === 'people') return routes.trips.members.href({ tripId })
  return routes.trips.show.href({ tripId })
}

function UnsharedBadge(handle: Handle<{ trip: Trip }>) {
  return () => {
    const { trip } = handle.props
    const count = unsharedChanges(trip, lastSharedAt(trip.id))
    if (count === 0) return null
    return (
      <span class="mono-caption mt-0.5 block text-faint">
        {count === 1
          ? '1 alteração não compartilhada'
          : `${count} alterações não compartilhadas`}
      </span>
    )
  }
}

function TripChrome(handle: Handle<{ trip: Trip; active: TabKey }>) {
  return () => {
    const { trip, active } = handle.props
    const members = activeMembers(trip)

    return (
      <div class="mb-6">
        <a
          href={routes.home.href()}
          class="mono-label mb-5 inline-flex items-center gap-1.5 text-faint transition-colors hover:text-ink"
        >
          <span aria-hidden="true">←</span> Viagens
        </a>
        <div class="flex items-center gap-4">
          <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-line-bright bg-panel text-[26px]">
            {trip.emoji}
          </span>
          <div class="min-w-0 flex-1">
            <h1 class="truncate text-[22px] font-bold tracking-tight">
              {trip.name}
            </h1>
            <p class="mono-caption mt-0.5 text-muted">
              <span class="tabular text-amber">
                {formatCents(tripTotal(trip), trip.currency)}
              </span>
              {' · '}
              {members.length} {members.length === 1 ? 'pessoa' : 'pessoas'}
            </p>
            <UnsharedBadge trip={trip} />
          </div>
          <a
            href={routes.trips.invite.href({ tripId: trip.id })}
            aria-label="Convidar alguém"
            class="flex h-11 w-11 items-center justify-center rounded-lg border border-line-bright text-muted transition-colors hover:border-amber hover:text-ink"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentcolor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <path d="M1.5 5 V1.5 H5 M11 1.5 H14.5 V5 M14.5 11 V14.5 H11 M5 14.5 H1.5 V11" />
              <rect x="5.4" y="5.4" width="5.2" height="5.2" rx="1" />
            </svg>
            <span class="sr-only">Convidar alguém</span>
          </a>
        </div>
        <nav class="mt-5 grid grid-cols-4 gap-1 rounded-xl border border-line bg-panel p-1">
          {tabs.map((tab) => (
            <a
              key={tab.key}
              href={tabHref(tab.key, trip.id)}
              aria-current={tab.key === active ? 'page' : undefined}
              class={`mono-label rounded-lg py-3 text-center transition-colors ${
                tab.key === active
                  ? 'bg-raised text-amber'
                  : 'text-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </a>
          ))}
        </nav>
      </div>
    )
  }
}

function TripMissing() {
  return () => (
    <div class="rounded-2xl border border-line bg-panel px-6 py-14 text-center">
      <p class="text-[17px] font-semibold">
        Esta viagem não está neste aparelho
      </p>
      <p class="mono-caption mx-auto mt-2 max-w-sm text-muted">
        Peça para alguém da viagem mostrar o código de convite e escaneie a
        partir da tela inicial.
      </p>
      <a
        href={routes.home.href()}
        class="mono-label mt-6 inline-flex rounded-lg border border-line-bright px-4 py-3 text-muted transition-colors hover:border-amber hover:text-ink"
      >
        Voltar às viagens
      </a>
    </div>
  )
}

function Loading() {
  return () => (
    <div class="space-y-3" aria-hidden="true">
      <div class="h-14 animate-pulse rounded-2xl bg-panel" />
      <div class="h-40 animate-pulse rounded-2xl bg-panel" />
    </div>
  )
}

export type { TabKey }
export { Loading, TripChrome, TripMissing, UnsharedBadge }

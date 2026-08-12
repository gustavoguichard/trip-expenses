import type { Handle } from 'remix/ui'
import { clientEntry, navigate, on } from 'remix/ui'

import { totalsByMember } from '../business/balances.common.ts'
import { activeMembers, findTrip, type Trip } from '../business/store.common.ts'
import {
  addMember,
  claimMember,
  deleteTrip,
  myMember,
  removeMember,
} from '../business/trips.common.ts'
import { routes } from '../routes.ts'
import { formatCents } from './money.ts'
import { bindDocument, deviceId, mutateDocument } from './store.ts'
import { Loading, TripChrome, TripMissing } from './trip-chrome.tsx'
import {
  Avatar,
  buttonDanger,
  buttonGhost,
  buttonPrimary,
  ErrorNote,
  emojiChoices,
  inputClass,
  randomOf,
  SectionLabel,
} from './widgets.tsx'

export const MembersScreen = clientEntry(
  import.meta.url,
  function MembersScreen(handle: Handle<{ tripId: string }>) {
    const data = bindDocument(handle)
    let error = ''
    let newName = ''
    let newEmoji = '😎'
    let addRound = 0
    let confirmingDelete = false

    async function run(mutation: Promise<{ error: string | null }>) {
      error = ''
      const result = await mutation
      if (result.error !== null) error = result.error
      handle.update()
    }

    async function add(trip: Trip) {
      await run(
        mutateDocument(addMember, {
          tripId: trip.id,
          name: newName,
          emoji: newEmoji,
        })
      )
      if (!error) {
        newName = ''
        newEmoji = randomOf(emojiChoices)
        addRound += 1
        handle.update()
      }
    }

    async function removeTrip(trip: Trip) {
      const result = await mutateDocument(deleteTrip, { tripId: trip.id })
      if (result.error !== null) {
        error = result.error
        handle.update()
        return
      }
      navigate(routes.home.href())
    }

    return () => {
      if (!data.ready()) {
        return (
          <div mix={data.mount}>
            <Loading />
          </div>
        )
      }

      const trip = findTrip(data.document(), handle.props.tripId)
      if (!trip) {
        return (
          <div mix={data.mount}>
            <TripMissing />
          </div>
        )
      }

      const members = activeMembers(trip)
      const me = myMember(trip, deviceId())
      const totals = totalsByMember(trip)

      return (
        <div mix={data.mount}>
          <TripChrome trip={trip} active="people" />

          <div class="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-amber/30 bg-amber-wash px-4 py-3.5">
            <p class="mono-caption text-muted">
              Viajando juntos? Coloque a viagem no celular deles também.
            </p>
            <a
              href={routes.trips.invite.href({ tripId: trip.id })}
              class={buttonPrimary}
            >
              Convidar
            </a>
          </div>

          <SectionLabel>Nessa viagem</SectionLabel>
          <div class="divide-y divide-line rounded-2xl border border-line bg-panel">
            {members.map((member) => {
              const total = totals.find(
                (candidate) => candidate.memberId === member.id
              )
              return (
                <div
                  key={member.id}
                  class="flex items-center gap-3.5 px-4 py-3.5"
                >
                  <Avatar emoji={member.emoji} />
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-[15px] font-medium">
                      {member.name}
                      {member.id === me?.id ? (
                        <span class="mono-caption ml-2 text-amber">você</span>
                      ) : null}
                    </p>
                    <p class="mono-caption text-faint">
                      pagou {formatCents(total?.paidCents ?? 0, trip.currency)}{' '}
                      · parte{' '}
                      {formatCents(total?.shareCents ?? 0, trip.currency)}
                    </p>
                  </div>
                  {member.id === me?.id ? null : (
                    <button
                      type="button"
                      class="mono-label cursor-pointer rounded-lg border border-line-bright px-3 py-2 text-muted transition-colors hover:border-amber hover:text-ink"
                      mix={on('click', () =>
                        run(
                          mutateDocument(claimMember, {
                            tripId: trip.id,
                            memberId: member.id,
                            deviceId: deviceId(),
                          })
                        )
                      )}
                    >
                      Sou eu
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Remover ${member.name}`}
                    class="mono-label cursor-pointer px-2 py-2 text-faint transition-colors hover:text-red"
                    mix={on('click', () =>
                      run(
                        mutateDocument(removeMember, {
                          tripId: trip.id,
                          memberId: member.id,
                        })
                      )
                    )}
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>

          <div class="mt-7">
            <SectionLabel>Adicionar pessoa</SectionLabel>
            <form
              class="flex items-center gap-2.5"
              mix={on('submit', (event) => {
                event.preventDefault()
                add(trip)
              })}
            >
              <button
                type="button"
                aria-label="Trocar avatar"
                class="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line-bright bg-panel text-[18px] transition-colors hover:border-amber"
                mix={on('click', () => {
                  newEmoji = randomOf(emojiChoices)
                  handle.update()
                })}
              >
                {newEmoji}
              </button>
              <input
                key={`add-${addRound}`}
                class={inputClass}
                placeholder="Nome"
                defaultValue={newName}
                mix={on('input', (event) => {
                  newName = (event.currentTarget as HTMLInputElement).value
                })}
              />
              <button type="submit" class={buttonGhost}>
                Adicionar
              </button>
            </form>
          </div>

          <div class="mt-4">
            <ErrorNote message={error} />
          </div>

          <div class="mt-12 border-t border-line pt-6">
            {confirmingDelete ? (
              <div class="flex flex-wrap items-center gap-3">
                <p class="mono-caption flex-1 text-muted">
                  Excluir “{trip.name}” deste aparelho? Amigos que sincronizaram
                  continuam com a cópia.
                </p>
                <button
                  type="button"
                  class={buttonDanger}
                  mix={on('click', () => removeTrip(trip))}
                >
                  Sim, excluir
                </button>
                <button
                  type="button"
                  class={buttonGhost}
                  mix={on('click', () => {
                    confirmingDelete = false
                    handle.update()
                  })}
                >
                  Manter
                </button>
              </div>
            ) : (
              <button
                type="button"
                class="mono-label cursor-pointer text-faint transition-colors hover:text-red"
                mix={on('click', () => {
                  confirmingDelete = true
                  handle.update()
                })}
              >
                Excluir esta viagem
              </button>
            )}
          </div>
        </div>
      )
    }
  }
)

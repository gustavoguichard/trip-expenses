import type { Handle } from 'remix/ui'
import { clientEntry, navigate, on, ref } from 'remix/ui'

import { findTrip } from '../business/store.common.ts'
import { claimMember, createTrip } from '../business/trips.common.ts'
import { routes } from '../routes.ts'
import { deviceId, mutateDocument } from './store.ts'
import {
  BottomBar,
  buttonGhost,
  buttonPrimary,
  EmojiPicker,
  ErrorNote,
  emojiChoices,
  inputClass,
  randomOf,
  SectionLabel,
  tripEmojiChoices,
} from './widgets.tsx'

const currencies = [
  'BRL',
  'USD',
  'EUR',
  'GBP',
  'ARS',
  'CLP',
  'COP',
  'MXN',
  'PEN',
  'CAD',
  'CHF',
  'JPY',
  'AUD',
  'NZD',
  'THB',
  'IDR',
  'VND',
  'ZAR',
  'INR',
]

type MemberDraft = { key: string; name: string; emoji: string }

let draftCount = 0

function newDraft(emoji: string): MemberDraft {
  draftCount += 1
  return { key: `draft-${draftCount}`, name: '', emoji }
}

export const TripNewScreen = clientEntry(
  import.meta.url,
  function TripNewScreen(handle: Handle) {
    let tripEmoji = '🏖️'
    let name = ''
    let currency = 'BRL'
    let members: MemberDraft[] = [newDraft('😎')]
    let pendingFocusKey = ''
    let error = ''
    let saving = false
    let fieldErrors: { name?: string; members?: string } = {}

    const randomizeTripEmoji = ref(() => {
      tripEmoji = randomOf(tripEmojiChoices)
      handle.update()
    })

    async function save(form: HTMLFormElement) {
      if (saving) return

      const fields = new FormData(form)
      const fieldValue = (fieldName: string, fallback: string) => {
        const value = fields.get(fieldName)
        return typeof value === 'string' ? value : fallback
      }
      const tripName = fieldValue('tripName', name).trim()
      const namedMembers = members
        .map((member) => ({
          ...member,
          name: fieldValue(`member-${member.key}`, member.name).trim(),
        }))
        .filter((member) => member.name !== '')

      fieldErrors = {
        ...(tripName === '' ? { name: 'Dê um nome à viagem.' } : {}),
        ...(namedMembers.length === 0
          ? { members: 'Adicione pelo menos uma pessoa com nome.' }
          : {}),
      }
      if (fieldErrors.name || fieldErrors.members) {
        handle.update()
        return
      }

      saving = true
      error = ''
      handle.update()

      const created = await mutateDocument(createTrip, {
        name: tripName,
        emoji: tripEmoji,
        currency,
        members: namedMembers,
      })
      if (created.error !== null) {
        error = created.error
        saving = false
        handle.update()
        return
      }

      const { document, tripId } = created.data
      const firstMember = findTrip(document, tripId)?.members[0]
      if (firstMember) {
        await mutateDocument(claimMember, {
          tripId,
          memberId: firstMember.id,
          deviceId: deviceId(),
        })
      }
      navigate(routes.trips.show.href({ tripId }))
    }

    return () => (
      <div mix={randomizeTripEmoji}>
        <a
          href={routes.home.href()}
          class="mono-label mb-5 inline-flex items-center gap-1.5 text-faint transition-colors hover:text-ink"
        >
          <span aria-hidden="true">←</span> Viagens
        </a>
        <h1 class="mb-6 text-[22px] font-bold tracking-tight">Nova viagem</h1>

        <form
          class="space-y-7"
          mix={on('submit', (event) => {
            event.preventDefault()
            save(event.currentTarget as HTMLFormElement)
          })}
        >
          <div>
            <SectionLabel>Nome da viagem</SectionLabel>
            <div class="flex items-center gap-3">
              <EmojiPicker
                value={tripEmoji}
                options={tripEmojiChoices}
                label="Escolher o emoji da viagem"
                onPick={(emoji) => {
                  tripEmoji = emoji
                  handle.update()
                }}
              />
              <input
                class={inputClass}
                name="tripName"
                placeholder="Chapada dos Veadeiros"
                defaultValue={name}
                mix={on('input', (event) => {
                  name = (event.currentTarget as HTMLInputElement).value
                  if (fieldErrors.name) {
                    fieldErrors = { ...fieldErrors, name: undefined }
                    handle.update()
                  }
                })}
              />
            </div>
            {fieldErrors.name ? (
              <p class="mono-caption mt-2 text-red">{fieldErrors.name}</p>
            ) : null}
          </div>

          <div>
            <SectionLabel>Moeda</SectionLabel>
            <div class="relative">
              <select
                class={`${inputClass} cursor-pointer appearance-none pr-10`}
                mix={on('change', (event) => {
                  currency = (event.currentTarget as HTMLSelectElement).value
                })}
              >
                {currencies.map((code) => (
                  <option key={code} value={code} selected={code === currency}>
                    {code}
                  </option>
                ))}
              </select>
              <svg
                class="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-muted"
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentcolor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M2.5 4.5 L6 8 L9.5 4.5" />
              </svg>
            </div>
          </div>

          <div>
            <SectionLabel>Quem vai?</SectionLabel>
            <div class="space-y-2.5">
              {members.map((member, index) => (
                <div key={member.key} class="flex items-center gap-2.5">
                  <EmojiPicker
                    value={member.emoji}
                    options={emojiChoices}
                    label={`Trocar o avatar de ${member.name || 'quem vai'}`}
                    shape="circle"
                    onPick={(emoji) => {
                      members[index] = { ...member, emoji }
                      handle.update()
                    }}
                  />
                  <input
                    class={inputClass}
                    name={`member-${member.key}`}
                    placeholder={index === 0 ? 'Seu nome' : 'Nome de quem vai'}
                    defaultValue={member.name}
                    mix={[
                      ref((node) => {
                        if (member.key !== pendingFocusKey) return
                        pendingFocusKey = ''
                        ;(node as HTMLInputElement).focus()
                      }),
                      on('input', (event) => {
                        members[index] = {
                          ...member,
                          name: (event.currentTarget as HTMLInputElement).value,
                        }
                        if (fieldErrors.members) {
                          fieldErrors = { ...fieldErrors, members: undefined }
                          handle.update()
                        }
                      }),
                    ]}
                  />
                  {members.length > 1 ? (
                    <button
                      type="button"
                      aria-label="Remover pessoa"
                      class="mono-label flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center text-faint transition-colors hover:text-red"
                      mix={on('click', () => {
                        members = members.filter((_, i) => i !== index)
                        handle.update()
                      })}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {fieldErrors.members ? (
              <p class="mono-caption mt-2 text-red">{fieldErrors.members}</p>
            ) : null}
            <p class="mono-caption mt-2 text-faint">
              A primeira pessoa é você. Toque no avatar para escolher outro.
            </p>
            <button
              type="button"
              class={`${buttonGhost} mt-3`}
              mix={on('click', () => {
                const draft = newDraft(randomOf(emojiChoices))
                pendingFocusKey = draft.key
                members = [...members, draft]
                handle.update()
              })}
            >
              + Adicionar pessoa
            </button>
          </div>

          <ErrorNote message={error} />

          <BottomBar>
            <button
              type="submit"
              class={`${buttonPrimary} flex-1`}
              disabled={saving}
            >
              {saving ? 'Criando…' : 'Criar viagem'}
            </button>
          </BottomBar>
        </form>
      </div>
    )
  }
)

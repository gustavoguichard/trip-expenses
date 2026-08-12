import type { Handle, RemixNode } from 'remix/ui'
import { on } from 'remix/ui'
import * as popover from 'remix/ui/popover'

const emojiChoices = [
  '😎',
  '🤠',
  '🥸',
  '🤓',
  '😺',
  '🦊',
  '🐸',
  '🐼',
  '🐨',
  '🦁',
  '🐯',
  '🐙',
  '🦉',
  '🦄',
  '🐳',
  '🦜',
  '🌞',
  '🌙',
  '⭐',
  '🔥',
  '🌊',
  '🌵',
  '🍄',
  '🍕',
  '🍩',
  '🍺',
  '☕',
  '🎸',
  '🎧',
  '🎲',
  '🏄',
  '🚴',
  '🧗',
  '⛺',
  '🎒',
  '🧭',
  '🗺️',
  '✈️',
  '🚀',
  '🛵',
  '⛵',
  '🎈',
  '🎯',
  '🏆',
  '💎',
  '🪩',
]

const tripEmojiChoices = [
  '🏖️',
  '🏔️',
  '🏝️',
  '🏜️',
  '🌋',
  '🗻',
  '🏙️',
  '🌆',
  '🛶',
  '⛺',
  '🚞',
  '⛷️',
  '🏄',
  '🤿',
  '🚐',
  '🛳️',
  '✈️',
  '🎡',
  '🥾',
  '🍜',
  '🍷',
  '🎪',
  '🗿',
  '🕌',
  '⛩️',
  '🏰',
  '🌴',
  '🌺',
  '❄️',
  '🌅',
]

const inputClass =
  'w-full rounded-lg border border-line-bright bg-panel px-3.5 py-2.5 text-[16px] text-ink placeholder:text-faint outline-none transition-colors focus:border-amber'

const buttonPrimary =
  'mono-label inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-amber px-4 py-3 text-canvas transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-40'

const buttonGhost =
  'mono-label inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-line-bright px-4 py-3 text-muted transition-colors hover:border-amber hover:text-ink'

const buttonDanger =
  'mono-label inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-red/40 px-4 py-3 text-red transition-colors hover:bg-red-wash'

function Avatar(handle: Handle<{ emoji: string; size?: 'sm' | 'md' | 'lg' }>) {
  const sizes = {
    sm: 'h-7 w-7 text-[14px]',
    md: 'h-9 w-9 text-[17px]',
    lg: 'h-12 w-12 text-[22px]',
  }
  return () => (
    <span
      class={`inline-flex shrink-0 items-center justify-center rounded-full border border-line-bright bg-raised ${sizes[handle.props.size ?? 'md']}`}
    >
      {handle.props.emoji}
    </span>
  )
}

function SectionLabel(handle: Handle<{ children: RemixNode }>) {
  return () => (
    <p class="mono-label mb-2.5 text-faint">{handle.props.children}</p>
  )
}

function ErrorNote(handle: Handle<{ message: string }>) {
  return () =>
    handle.props.message ? (
      <p class="mono-caption rounded-lg border border-red/40 bg-red-wash px-3 py-2.5 text-red">
        {handle.props.message}
      </p>
    ) : null
}

type PickerOption = { value: string; emoji: string; label?: string }

function EmojiPicker(
  handle: Handle<{
    value: string
    options: Array<string | PickerOption>
    onPick: (value: string) => void
    label: string
    shape?: 'square' | 'circle'
  }>
) {
  let open = false

  function toggle(next: boolean) {
    open = next
    handle.update()
  }

  function pick(value: string) {
    handle.props.onPick(value)
    toggle(false)
  }

  return () => {
    const { value, label, shape = 'square' } = handle.props
    const options = handle.props.options.map((option) =>
      typeof option === 'string' ? { value: option, emoji: option } : option
    )
    const current = options.find((option) => option.value === value)
    const labeled = options.some((option) => option.label)

    return (
      <popover.Context>
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          class={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border border-line-bright bg-panel text-[18px] transition-colors hover:border-amber ${
            shape === 'circle' ? 'rounded-full' : 'rounded-xl'
          }`}
          mix={[
            popover.anchor({ placement: 'bottom-start', offsetY: 6 }),
            popover.focusOnHide(),
            on('click', () => toggle(true)),
          ]}
        >
          {current?.emoji ?? value}
        </button>
        <div
          class="m-0 max-h-96 overflow-y-auto rounded-2xl border border-line-bright bg-panel p-2 shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
          mix={popover.surface({ open, onHide: () => toggle(false) })}
        >
          {labeled ? (
            <div class="flex w-52 flex-col gap-0.5">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={option.value === value}
                  class={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    option.value === value
                      ? 'border-amber bg-amber-wash text-ink'
                      : 'border-transparent text-muted hover:bg-raised hover:text-ink'
                  }`}
                  mix={[
                    ...(option.value === value ? [popover.focusOnShow()] : []),
                    on('click', () => pick(option.value)),
                  ]}
                >
                  <span class="text-[17px]">{option.emoji}</span>
                  <span class="text-[13px] font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div class="grid grid-cols-6 gap-1">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={option.value === value}
                  class={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border text-[17px] transition-colors ${
                    option.value === value
                      ? 'border-amber bg-amber-wash'
                      : 'border-transparent hover:border-line-bright'
                  }`}
                  mix={[
                    ...(option.value === value ? [popover.focusOnShow()] : []),
                    on('click', () => pick(option.value)),
                  ]}
                >
                  {option.emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </popover.Context>
    )
  }
}

function BottomBar(handle: Handle<{ children: RemixNode }>) {
  return () => (
    <div>
      <div aria-hidden="true" class="h-10 sm:hidden" />
      <div class="pointer-events-none fixed inset-x-0 bottom-0 z-30 sm:static">
        <div class="h-8 bg-linear-to-t from-canvas to-transparent sm:hidden" />
        <div class="pointer-events-auto border-t border-line bg-chrome/90 backdrop-blur sm:border-t-0 sm:bg-transparent sm:backdrop-blur-none">
          <div class="mx-auto flex w-full max-w-3xl gap-3 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-0 sm:pt-4 sm:pb-0">
            {handle.props.children}
          </div>
        </div>
      </div>
    </div>
  )
}

function randomOf(choices: string[]) {
  return choices[Math.floor(Math.random() * choices.length)] ?? '🎒'
}

export {
  Avatar,
  BottomBar,
  buttonDanger,
  buttonGhost,
  buttonPrimary,
  EmojiPicker,
  ErrorNote,
  emojiChoices,
  inputClass,
  randomOf,
  SectionLabel,
  tripEmojiChoices,
}

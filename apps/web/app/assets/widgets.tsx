import type { Handle, RemixNode } from 'remix/ui'
import { on } from 'remix/ui'

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

function EmojiPicker(
  handle: Handle<{
    value: string
    choices?: string[]
    onPick: (emoji: string) => void
  }>
) {
  return () => (
    <div class="flex flex-wrap gap-1.5">
      {(handle.props.choices ?? emojiChoices).map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-pressed={emoji === handle.props.value}
          class={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border text-[17px] transition-colors ${
            emoji === handle.props.value
              ? 'border-amber bg-amber-wash'
              : 'border-transparent hover:border-line-bright'
          }`}
          mix={on('click', () => handle.props.onPick(emoji))}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

function randomOf(choices: string[]) {
  return choices[Math.floor(Math.random() * choices.length)] ?? '🎒'
}

export {
  Avatar,
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

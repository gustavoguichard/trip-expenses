import type { Handle } from 'remix/ui'

export function Wordmark(handle: Handle<{ compact?: boolean }>) {
  return () => (
    <span class="inline-flex items-center gap-2.5">
      <svg
        width="22"
        height="22"
        viewBox="0 0 32 32"
        aria-hidden="true"
        class="block"
      >
        <path
          d="M6 22 C 11 22, 12 9, 18 9 L 22 9"
          fill="none"
          stroke="var(--color-amber)"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-dasharray="0.1 4.4"
        />
        <circle cx="7" cy="22" r="2.4" fill="var(--color-amber)" />
        <path d="M20 5.5 L 27 9 L 20 12.5 Z" fill="var(--color-ink)" />
      </svg>
      {handle.props.compact ? null : (
        <span class="mono-label text-[11px] text-ink">
          trip<span class="text-amber">·</span>expenses
        </span>
      )}
    </span>
  )
}

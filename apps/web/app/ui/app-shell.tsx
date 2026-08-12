import type { Handle, RemixNode } from 'remix/ui'

import { routes } from '../routes.ts'
import { Wordmark } from './brand.tsx'
import { Document } from './document.tsx'

type AppShellProps = {
  children: RemixNode
  title?: string
}

export function AppShell(handle: Handle<AppShellProps>) {
  return () => (
    <Document title={handle.props.title}>
      <div class="flex min-h-dvh flex-col">
        <header class="sticky top-0 z-40 border-b border-line bg-chrome/90 pt-[env(safe-area-inset-top)] backdrop-blur">
          <div class="mx-auto flex h-13 w-full max-w-3xl items-center justify-between px-4">
            <a
              href={routes.home.href()}
              class="rounded-md outline-amber transition-opacity hover:opacity-80"
              aria-label="Todas as viagens"
            >
              <Wordmark />
            </a>
            <a
              href={routes.join.href()}
              class="mono-label inline-flex items-center gap-2 rounded-lg border border-line-bright px-3 py-2 text-muted transition-colors hover:border-amber hover:text-ink"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentcolor"
                stroke-width="1.6"
                aria-hidden="true"
              >
                <path d="M1.5 5 V1.5 H5 M11 1.5 H14.5 V5 M14.5 11 V14.5 H11 M5 14.5 H1.5 V11" />
                <path d="M4.5 8 H11.5" stroke-linecap="round" />
              </svg>
              Escanear
            </a>
          </div>
        </header>
        <main class="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-24">
          {handle.props.children}
        </main>
      </div>
    </Document>
  )
}

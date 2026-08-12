import type { Handle, RemixNode } from 'remix/ui'

import { routes } from '../routes.ts'

const serviceWorkerRegistration = `if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') navigator.serviceWorker.register('/service-worker.js')`

export type DocumentProps = {
  children?: RemixNode
  title?: string
  description?: string
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    const { children, title = 'Trip Expenses', description } = handle.props

    return (
      <html lang="pt-BR" class="[color-scheme:dark]">
        <head>
          <meta charSet="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
          />
          <meta name="theme-color" content="#0B0A08" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta
            name="apple-mobile-web-app-status-bar-style"
            content="black-translucent"
          />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <link rel="manifest" href="/manifest.webmanifest" />
          <link
            rel="preload"
            href="/fonts/inter-variable.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
          <link
            rel="preload"
            href="/fonts/jetbrains-mono-variable.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
          <link rel="stylesheet" href="/styles.css" />
          <title>{title}</title>
          {description ? (
            <meta name="description" content={description} />
          ) : null}
        </head>
        <body class="m-0 min-h-dvh bg-canvas font-sans text-ink">
          {children}
          <script
            type="module"
            src={routes.assets.href({ path: 'app/assets/entry.ts' })}
          />
          <script innerHTML={serviceWorkerRegistration} />
        </body>
      </html>
    )
  }
}

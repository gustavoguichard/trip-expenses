import type { Handle, RemixNode } from 'remix/ui'

import { routes } from '../routes.ts'

const serviceWorkerRegistration = `if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
  navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' })
  const hadController = Boolean(navigator.serviceWorker.controller)
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true
    location.reload()
  })
}`

const appleStartupImages = [
  {
    deviceWidth: 440,
    deviceHeight: 956,
    pixelRatio: 3,
    href: '/splash/1320x2868.png',
  },
  {
    deviceWidth: 430,
    deviceHeight: 932,
    pixelRatio: 3,
    href: '/splash/1290x2796.png',
  },
  {
    deviceWidth: 428,
    deviceHeight: 926,
    pixelRatio: 3,
    href: '/splash/1284x2778.png',
  },
  {
    deviceWidth: 414,
    deviceHeight: 896,
    pixelRatio: 3,
    href: '/splash/1242x2688.png',
  },
  {
    deviceWidth: 414,
    deviceHeight: 896,
    pixelRatio: 2,
    href: '/splash/828x1792.png',
  },
  {
    deviceWidth: 414,
    deviceHeight: 736,
    pixelRatio: 3,
    href: '/splash/1242x2208.png',
  },
  {
    deviceWidth: 402,
    deviceHeight: 874,
    pixelRatio: 3,
    href: '/splash/1206x2622.png',
  },
  {
    deviceWidth: 393,
    deviceHeight: 852,
    pixelRatio: 3,
    href: '/splash/1179x2556.png',
  },
  {
    deviceWidth: 390,
    deviceHeight: 844,
    pixelRatio: 3,
    href: '/splash/1170x2532.png',
  },
  {
    deviceWidth: 375,
    deviceHeight: 812,
    pixelRatio: 3,
    href: '/splash/1125x2436.png',
  },
  {
    deviceWidth: 375,
    deviceHeight: 667,
    pixelRatio: 2,
    href: '/splash/750x1334.png',
  },
  {
    deviceWidth: 320,
    deviceHeight: 568,
    pixelRatio: 2,
    href: '/splash/640x1136.png',
  },
]

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
          {appleStartupImages.map(
            ({ deviceWidth, deviceHeight, pixelRatio, href }) => (
              <link
                key={href}
                rel="apple-touch-startup-image"
                media={`(device-width: ${deviceWidth}px) and (device-height: ${deviceHeight}px) and (-webkit-device-pixel-ratio: ${pixelRatio}) and (orientation: portrait)`}
                href={href}
              />
            )
          )}
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

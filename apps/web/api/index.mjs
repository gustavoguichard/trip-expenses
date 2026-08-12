import 'remix/node-tsx'

import 'composable-functions'
import 'qr/decode.js'
import 'remix/assets'
import 'remix/middleware/render'
import 'remix/middleware/static'
import 'remix/response/html'
import 'remix/router'
import 'remix/routes'
import 'remix/ui'
import 'remix/ui/jsx-runtime'
import 'remix/ui/server'
import 'uqr'
import 'zod'

import { fileURLToPath } from 'node:url'

process.chdir(fileURLToPath(new URL('..', import.meta.url)))

const { router } = await import('../app/router.ts')

export const config = { useWebApi: true, supportsResponseStreaming: true }

export default function handler(request) {
  return router.fetch(request)
}

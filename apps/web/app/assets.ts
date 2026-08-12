import { fileURLToPath } from 'node:url'
import { createAssetServer } from 'remix/assets'

const rootDir = fileURLToPath(new URL('../../..', import.meta.url))
const nodeEnv = process.env.NODE_ENV ?? 'development'
const isDevelopment = nodeEnv === 'development'

export const assetServer = createAssetServer({
  basePath: '/assets',
  rootDir,
  fileMap: {
    'app/*path': 'apps/web/app/*path',
    'node_modules/*path': 'node_modules/*path',
  },
  allow: [
    'apps/web/app/assets/**',
    'apps/web/app/business/**',
    'apps/web/app/framework/**',
    'apps/web/app/routes.ts',
    'node_modules/**',
  ],
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: !isDevelopment,
  watch: false,
})

import { readFileSync, writeFileSync } from 'node:fs'

const serviceWorkerPath = new URL(
  '../public/service-worker.js',
  import.meta.url
)
const version = process.env.VERCEL_GIT_COMMIT_SHA

if (!version) {
  console.log('VERCEL_GIT_COMMIT_SHA not set, leaving service worker unstamped')
  process.exit(0)
}

const source = readFileSync(serviceWorkerPath, 'utf8')
const placeholder = "'__BUILD_VERSION__'"

if (!source.includes(placeholder)) {
  console.error(`${placeholder} not found in service-worker.js`)
  process.exit(1)
}

writeFileSync(serviceWorkerPath, source.replace(placeholder, `'${version}'`))
console.log(`Stamped service worker with build version ${version}`)

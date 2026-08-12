import { router } from '../app/router.ts'

export default function handler(request: Request) {
  return router.fetch(request)
}

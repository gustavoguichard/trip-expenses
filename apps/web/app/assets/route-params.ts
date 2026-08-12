import { RoutePattern } from 'remix/route-pattern'
import { createMultiMatcher } from 'remix/route-pattern/match'

import { routes } from '../routes.ts'

type RouteParams = { tripId?: string; expenseId?: string }

const matcher = createMultiMatcher()

function register(node: unknown) {
  if (node === null || typeof node !== 'object') return
  if ('pattern' in node && node.pattern instanceof RoutePattern) {
    matcher.add(node.pattern, null)
    return
  }
  for (const value of Object.values(node)) register(value)
}

register(routes)

function paramsFromPathname(pathname: string): RouteParams {
  const match = matcher.match(new URL(pathname, 'https://localhost'))
  return match ? (match.params as RouteParams) : {}
}

function routeParams(): RouteParams {
  return paramsFromPathname(window.location.pathname)
}

export { paramsFromPathname, routeParams }

// Proves the two structural guarantees this server has to keep:
//
//  1. Statelessness / read-only (CLAUDE.md, Session Isolation) — there is no
//     route capable of writing draft-related data, established by
//     enumerating what's actually registered rather than guessing at
//     endpoints that don't exist.
//  2. An unreachable database produces a clear 5xx, not a hang or a crash.

import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'

import { API_MOUNTS, createApp, isDatabaseUnreachable } from './app'
import { createPool, pool } from './db/pool'

const app = createApp(pool)

// Points at a port nothing listens on, to exercise the failure path without
// touching the real container.
const unreachablePool = createPool('postgresql://nobody:nobody@127.0.0.1:59999/nothing')
const unreachableApp = createApp(unreachablePool)

afterAll(async () => {
  await Promise.all([pool.end(), unreachablePool.end()])
})

// Minimal structural view of Express's router internals — enough to walk it
// without depending on the full Layer type.
interface RouteLayer {
  name?: string
  route?: { path: string; methods: Record<string, boolean> }
  handle?: { stack?: RouteLayer[] }
}

function routerStack(): RouteLayer[] {
  return (app as unknown as { router: { stack: RouteLayer[] } }).router.stack
}

function collectRoutes(stack: RouteLayer[], prefix = ''): string[] {
  const routes: string[] = []
  // Sub-routers are mounted in API_MOUNTS order, which is how each one's
  // full path is recovered (Express 5 layers don't carry it statically).
  let mountIndex = 0

  for (const layer of stack) {
    if (layer.route) {
      const path = layer.route.path === '/' ? prefix : `${prefix}${layer.route.path}`
      for (const [method, enabled] of Object.entries(layer.route.methods)) {
        if (enabled) routes.push(`${method.toUpperCase()} ${path || '/'}`)
      }
    } else if (layer.handle?.stack) {
      routes.push(...collectRoutes(layer.handle.stack, API_MOUNTS[mountIndex]?.path ?? '(unknown mount)'))
      mountIndex += 1
    }
  }

  return routes
}

describe('statelessness / read-only guarantees', () => {
  it('registers only GET routes — no write route exists anywhere in the app', () => {
    const routes = collectRoutes(routerStack())

    // Surfaced in the test output as the enumeration proof.
    console.log('Registered routes:', routes)

    // The entire API surface, pinned: two GETs and nothing else. A new route
    // of any kind fails here until it's deliberately added to this list.
    expect(routes).toEqual(['GET /api/players', 'GET /api/league-formats'])
    expect(routes.some((route) => /^(POST|PUT|PATCH|DELETE)/.test(route))).toBe(false)
  })

  it('mounts no body parser, since the server accepts no request bodies', () => {
    const names = routerStack().map((layer) => layer.name ?? '')
    expect(names.some((name) => /json|urlencoded|body/i.test(name))).toBe(false)
  })

  it.each([
    ['post', '/api/players'],
    ['put', '/api/players'],
    ['patch', '/api/players'],
    ['delete', '/api/players'],
    ['post', '/api/league-formats'],
    ['delete', '/api/league-formats'],
  ] as const)('rejects %s %s — no draft state can be written', async (method, path) => {
    const response = await request(app)[method](path)
    expect(response.status).toBe(404)
    expect(response.body.error).toBe('not_found')
  })

  it('serves identical payloads across repeated requests (no accumulated state)', async () => {
    const first = await request(app).get('/api/players')
    const second = await request(app).get('/api/players')
    expect(first.body).toEqual(second.body)
  })
})

describe('unknown routes', () => {
  it('returns a JSON 404, not Express’s default HTML', async () => {
    const response = await request(app).get('/api/nope')
    expect(response.status).toBe(404)
    expect(response.headers['content-type']).toMatch(/application\/json/)
    expect(response.body.message).toMatch(/read-only/)
  })
})

describe('database unreachable', () => {
  it('fails GET /api/players with 503 and an actionable message', async () => {
    const response = await request(unreachableApp).get('/api/players')

    expect(response.status).toBe(503)
    expect(response.body.error).toBe('database_unavailable')
    expect(response.body.message).toMatch(/Cannot reach the database/)
    expect(response.body.message).toMatch(/docker compose up -d/)
  })

  it('fails GET /api/league-formats with 503 as well', async () => {
    const response = await request(unreachableApp).get('/api/league-formats')
    expect(response.status).toBe(503)
    expect(response.body.error).toBe('database_unavailable')
  })

  // Regression guard: these are real pg failure signatures, and the first
  // one has no `code` at all — it's what a running server actually throws
  // when the container is stopped underneath it. Classifying it by code
  // alone reported a misleading 500.
  it.each([
    'Connection terminated unexpectedly',
    'timeout exceeded when trying to connect',
    'Client has encountered a connection error and is not queryable',
    'server closed the connection unexpectedly',
  ])('classifies codeless pg failure %j as unreachable, not an internal error', (message) => {
    expect(isDatabaseUnreachable(new Error(message))).toBe(true)
  })

  it('does not misclassify a genuine query error as a connection failure', () => {
    const queryError = Object.assign(new Error('column "nope" does not exist'), { code: '42703' })
    expect(isDatabaseUnreachable(queryError)).toBe(false)
  })

  it('leaves the process alive and still able to serve a working database', async () => {
    await request(unreachableApp).get('/api/players')
    // Reaching this line at all means the earlier failure didn't take the
    // process down; the healthy app still answering proves recovery.
    const response = await request(app).get('/api/league-formats')
    expect(response.status).toBe(200)
  })
})

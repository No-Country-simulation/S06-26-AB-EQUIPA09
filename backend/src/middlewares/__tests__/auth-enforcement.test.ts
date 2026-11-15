import { describe, it, expect } from 'vitest'
import { Elysia } from 'elysia'
import { staffAuthMiddleware } from '../staff-auth.middleware'
import { authMiddleware } from '../auth.middleware'
import { rateLimitMiddleware } from '../rate-limit.middleware'
import { resultMiddleware } from '../result.middleware'
import { staffController } from '@/modules/staff/infrastructure/http/controllers/staff.controller'
import { ingestionController } from '@/modules/ingestion/infrastructure/http/controllers/ingestion.controller'
import { agentStaffController } from '@/modules/agent/infrastructure/http/controllers/agent-staff.controller'
import { staffIndicatorController } from '@/modules/indicators/infrastructure/http/controllers/staff-indicator.controller'
import { staffProgramController } from '@/modules/programs/infrastructure/http/controllers/staff-program.controller'
import { agentController } from '@/modules/agent/infrastructure/http/controllers/agent.controller'
import { regionsController } from '@/modules/regions/infrastructure/http/controllers/region.controller'
import { coverageController } from '@/modules/coverage/infrastructure/http/controllers/coverage.controller'

const req = (path: string, init?: RequestInit) => new Request(`http://localhost${path}`, init)

describe('regressão: onBeforeHandle "local" não protegia as rotas do consumidor', () => {
  it('staffAuthMiddleware bloqueia rotas do app que o usa (sem cookie → 401)', async () => {
    const app = new Elysia().use(resultMiddleware()).use(staffAuthMiddleware()).get('/secret', () => ({ ok: true }))
    expect((await app.handle(req('/secret'))).status).toBe(401)
  })

  it('authMiddleware bloqueia rotas do app que o usa (sem cookie → 401)', async () => {
    const app = new Elysia().use(resultMiddleware()).use(authMiddleware()).get('/secret', () => ({ ok: true }))
    expect((await app.handle(req('/secret'))).status).toBe(401)
  })

  it('token inválido também é recusado', async () => {
    const app = new Elysia().use(resultMiddleware()).use(staffAuthMiddleware()).get('/secret', () => ({ ok: true }))
    const res = await app.handle(req('/secret', { headers: { cookie: 'staff_token=abc.def.ghi' } }))
    expect(res.status).toBe(401)
  })
})

describe('controllers reais exigem autenticação', () => {
  const app = new Elysia()
    .use(resultMiddleware())
    .use(staffController).use(ingestionController).use(agentStaffController)
    .use(staffIndicatorController).use(staffProgramController)
    .use(agentController).use(regionsController).use(coverageController)

  it.each([
    '/staff/members', '/staff/query-logs', '/staff/activity-log', '/staff/data-sources',
    '/staff/indicators/', '/staff/me', '/agent/history', '/regions/', '/coverage/',
  ])('GET %s sem cookie → 401', async path => {
    expect((await app.handle(req(path))).status).toBe(401)
  })

  it('POST /agent/query sem login → 401 (antes era público)', async () => {
    const res = await app.handle(req('/agent/query', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'quais regiões têm pior cobertura?' }),
    }))
    expect(res.status).toBe(401)
  })

  it('POST /staff/members sem login → 401', async () => {
    const res = await app.handle(req('/staff/members', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'x@example.com', name: 'X', password: 'Password123!' }),
    }))
    expect(res.status).toBe(401)
  })

  it('o login staff continua público (falha por credenciais, não por falta de sessão)', async () => {
    const res = await app.handle(req('/staff/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nao-existe@example.com', password: 'wrong-password' }),
    }))
    const body = await res.json() as { error?: { message?: string } }
    expect(body.error?.message ?? '').not.toBe('Autenticação necessária')
  })
})

describe('rate limit aplica-se às rotas do consumidor', () => {
  it('devolve 429 depois de exceder o limite', async () => {
    const app = new Elysia()
      .use(resultMiddleware())
      .use(rateLimitMiddleware({ windowMs: 60_000, maxRequests: 3, keyPrefix: `test-${Math.random()}:` }))
      .get('/ping', () => ({ ok: true }))
    const statuses: number[] = []
    for (let i = 0; i < 5; i++) statuses.push((await app.handle(req('/ping'))).status)
    expect(statuses).toEqual([200, 200, 200, 429, 429])
  })
})

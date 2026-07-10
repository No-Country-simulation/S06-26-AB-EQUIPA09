import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import { elysiaHelmet } from 'elysiajs-helmet'
import { env } from '@/config/env'
import { logger } from '@/shared/logger/logger'
import { resultMiddleware } from '@/middlewares/result.middleware'
import { staffController } from './modules/staff/infrastructure/http/controllers/staff.controller'
import { authController } from './modules/auth/infrastructure/http/controllers/auth.controller'
import { usersController } from './modules/users/infrastructure/http/controllers/user.controller'
import { regionsController } from './modules/regions/infrastructure/http/controllers/region.controller'
import { ingestionController } from './modules/ingestion/infrastructure/http/controllers/ingestion.controller'
import { coverageController } from './modules/coverage/infrastructure/http/controllers/coverage.controller'
import { indicatorController } from './modules/indicators/infrastructure/http/controllers/indicator.controller'
import { staffIndicatorController } from './modules/indicators/infrastructure/http/controllers/staff-indicator.controller'
import { programController } from './modules/programs/infrastructure/http/controllers/program.controller'
import { staffProgramController } from './modules/programs/infrastructure/http/controllers/staff-program.controller'
import { alertController } from './modules/alerts/infrastructure/http/controllers/alert.controller'
import { agentController } from './modules/agent/infrastructure/http/controllers/agent.controller'
import { agentStaffController } from './modules/agent/infrastructure/http/controllers/agent-staff.controller'
import { notificationController } from './modules/notifications/infrastructure/http/controllers/notification.controller'
import { createStaffService } from './modules/staff/application/services/staff.service'
import { createStaffRepository } from './modules/staff/infrastructure/persistence/staff.repository'
import { createStaffSessionRepository } from './modules/staff/infrastructure/persistence/staff-session.repository'
import { createStaffActivityLogRepository } from './modules/staff/infrastructure/persistence/staff-activity-log.repository'
import { createStaffSessionService } from './modules/staff/application/services/staff-session.service'
import { db } from '@/db'

const app = new Elysia()
.use(
  cors({
    origin: (request) => {
      const origin = request.headers.get('origin')
      if (!origin) return true
      
      if (env.CORS_ORIGINS.includes('*')) return true
      
      if (env.CORS_ORIGINS.includes(origin)) return true
      
      for (const allowed of env.CORS_ORIGINS) {
        if (allowed.includes('*')) {
          const pattern = allowed.replace(/\*/g, '.*')
          const regex = new RegExp(`^${pattern}$`)
          if (regex.test(origin)) {
            return true
          }
        }
      }
      
      return false
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
)

  .use(
    elysiaHelmet({
      frameOptions: 'DENY',
      xssProtection: true,
      dnsPrefetch: false,
      referrerPolicy: 'strict-origin-when-cross-origin',
      hsts: { maxAge: 31536000, includeSubDomains: true },
      corp: 'cross-origin',
      csp: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    })
  )

  // A documentação é publicada para permitir a verificação do serviço em produção.
  .use(
    swagger({
          documentation: {
            info: {
              title: 'BiT B2G API',
              version: '1.0.0',
              description: 'Plataforma de dados para gestão pública municipal',
            },
            tags: [
              { name: 'health', description: 'Health check' },
              { name: 'staff-auth', description: 'Autenticação de staff' },
              { name: 'staff', description: 'Gestão de staff' },
              { name: 'staff-activity', description: 'Activity log do staff' },
              { name: 'staff-agent', description: 'Query logs do agente' },
              { name: 'staff-indicators', description: 'Gestão de indicadores (staff)' },
              { name: 'staff-programs', description: 'Gestão de programas (staff)' },
              { name: 'auth', description: 'Autenticação de utilizadores' },
              { name: 'users', description: 'Gestão de perfil' },
              { name: 'regions', description: 'Regiões e estações base' },
              { name: 'ingestion', description: 'Fontes de dados e ingestão CDRView' },
              { name: 'coverage', description: 'Cobertura de rede' },
              { name: 'indicators', description: 'Indicadores e data points' },
              { name: 'programs', description: 'Programas públicos' },
              { name: 'alerts', description: 'Alertas e configurações' },
              { name: 'agent', description: 'Agente NL-to-SQL' },
              { name: 'notifications', description: 'Notificações' },
            ],
          },
          path: '/docs',
        })
  )

  .use(resultMiddleware())

  .get(
    '/health',
    () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }),
    { detail: { tags: ['health'], summary: 'Health check' } }
  )

  // Modules
  .use(staffController)
  .use(ingestionController)
  .use(agentStaffController)
  .use(staffIndicatorController)
  .use(staffProgramController)
  .use(authController)
  .use(usersController)
  .use(regionsController)
  .use(coverageController)
  .use(indicatorController)
  .use(programController)
  .use(alertController)
  .use(agentController)
  .use(notificationController)

  .onStart(async () => {
    logger.info(`chronus API running on http://localhost:${env.PORT}`)
    logger.info(`Swagger docs: http://localhost:${env.PORT}/docs`)

    try {
      const staffRepo = createStaffRepository(db)
      const staffSessionRepo = createStaffSessionRepository(db)
      const activityLogRepo = createStaffActivityLogRepository(db)
      const staffSessionSvc = createStaffSessionService(staffSessionRepo)
      const staffSvc = createStaffService(staffRepo, staffSessionSvc, activityLogRepo)
      await staffSvc.seed()
    } catch (error) {
      logger.error({ err: error }, 'Staff seed failed on startup')
    }
  })
  .onStop(() => {
    logger.info('Server stopped gracefully')
  })

  // Error handler global - previne stack traces em produção
  .onError(({ request, error, code }) => {
    const isProduction = env.NODE_ENV === 'production'
    
    const errorObj = error instanceof Error 
      ? { name: error.name, message: error.message, stack: error.stack }
      : { name: 'Unknown', message: String(error) }
    
    logger.error(
      {
        method: request.method,
        url: request.url,
        code,
        error: isProduction 
          ? { name: errorObj.name, message: errorObj.message }
          : errorObj,
      },
      'Unhandled error'
    )

    if (isProduction) {
      return {
        success: false,
        error: {
          type: 'INTERNAL_SERVER_ERROR',
          message: 'Erro interno do servidor',
          timestamp: new Date().toISOString(),
        },
      }
    }
    
    return error
  })

  .listen({
    hostname: '0.0.0.0',
    port: env.PORT,
  })

export type App = typeof app

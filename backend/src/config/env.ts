import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  METRICS_PORT: z.string().transform(Number).default('9091'),
  JWT_SECRET: z.string().min(32),
  DATABASE_URL: z.string().optional(),
  DB_USER: z.string().optional(),
  DB_HOST: z.string().optional(),
  DB_DATABASE: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_PORT: z.string().transform(Number).default('5432'),
  DB_SSL: z.string().optional(),
  DB_MAX_CONNECTIONS: z.string().optional(),
  COOKIE_DOMAIN: z.string().optional(),
  APP_URL: z.string(),
  CORS_ORIGINS: z
    .string()
    .transform((val) => (val === '*' ? ['*'] : val.split(',').map((o) => o.trim()))),
  ENCRYPTION_KEY: z.string().min(1),
  CORS_CREDENTIALS: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
  TRUSTED_PROXY: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  SIGNED_URL_SECRET: z.string(),
  STORAGE_DRIVER: z.string().default('local')
})

// Require either a full `DATABASE_URL` or the DB_* components
envSchema.superRefine((env, ctx) => {
  const hasUrl = typeof env.DATABASE_URL === 'string' && env.DATABASE_URL.length > 0
  const hasParts = env.DB_USER && env.DB_HOST && env.DB_DATABASE && env.DB_PASSWORD
  if (!hasUrl && !hasParts) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Either DATABASE_URL or DB_USER, DB_HOST, DB_DATABASE and DB_PASSWORD must be provided'
    })
  }
})

export type Env = z.infer<typeof envSchema>

function validateEnv(): Env {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((e) => {
        const path = e.path.join('.')
        const message = e.message
        return `${path}: ${message}`
      })

      console.error('Invalid environment variables:')
      errors.forEach((err) => console.error(`  - ${err}`))

      throw new Error(`Missing or invalid environment variables:\n${errors.join('\n')}`)
    }
    throw error
  }
}

export const env = validateEnv()

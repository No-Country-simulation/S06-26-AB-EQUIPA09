import { Elysia } from 'elysia'
import { ErrorFactory } from '@/shared/result/factory'
import { Err } from '@/shared/result/types'
import { logger } from '@/shared/logger/logger'

interface RateLimitEntry {
  count: number
  ttl: number
  expiresAt: number
}

const store = new Map<string, RateLimitEntry>()

const CLEANUP_INTERVAL = 60_000
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) {
      store.delete(key)
    }
  }
}, CLEANUP_INTERVAL).unref()

function getEntry(key: string, windowSeconds: number): RateLimitEntry {
  const now = Date.now()
  const existing = store.get(key)
  if (existing && existing.expiresAt > now) {
    return existing
  }
  const entry: RateLimitEntry = {
    count: 0,
    ttl: windowSeconds,
    expiresAt: now + windowSeconds * 1000,
  }
  store.set(key, entry)
  return entry
}

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyPrefix?: string
}

export const RateLimitPresets = {
  AUTH:     { windowMs: 15 * 60 * 1000, maxRequests: 5,  keyPrefix: 'auth:' },
  AUTH_FAIL:{ windowMs: 60 * 60 * 1000, maxRequests: 5,  keyPrefix: 'auth_fail:' },
  API:      { windowMs: 60 * 1000,      maxRequests: 60, keyPrefix: 'api:' },
  PUBLIC:   { windowMs: 60 * 1000,      maxRequests: 120,keyPrefix: 'public:' },
  CRITICAL: { windowMs: 60 * 60 * 1000, maxRequests: 10, keyPrefix: 'critical:' },
} as const

export const recordAuthFailure = async (email: string, ip: string): Promise<void> => {
  const baseKey = `ratelimit:auth_fail:${ip}:${email.slice(0, 4)}`
  try {
    const entry = getEntry(baseKey, 3600)
    entry.count++
  } catch (err) {
    logger.error({ err, email, ip }, 'Failed to record auth failure')
  }
}

export const rateLimitMiddleware = (config: RateLimitConfig) =>
  new Elysia({ name: 'rate-limit' }).onBeforeHandle(async ({ request, set }) => {
    const ip = getClientIp(request)
    const key = `ratelimit:${config.keyPrefix || ''}${ip}`
    const windowSeconds = Math.ceil(config.windowMs / 1000)

    try {
      const entry = getEntry(key, windowSeconds)
      entry.count++

      const remaining = Math.max(0, config.maxRequests - entry.count)
      const resetTime = entry.expiresAt

      set.headers['X-RateLimit-Limit'] = config.maxRequests.toString()
      set.headers['X-RateLimit-Remaining'] = remaining.toString()
      set.headers['X-RateLimit-Reset'] = new Date(resetTime).toISOString()

      if (entry.count > config.maxRequests) {
        const retryAfter = Math.ceil((entry.expiresAt - Date.now()) / 1000)
        set.headers['Retry-After'] = retryAfter.toString()

        logger.warn(
          { ip, path: new URL(request.url).pathname, count: entry.count, limit: config.maxRequests },
          'Rate limit exceeded'
        )

        return Err(
          ErrorFactory.tooManyRequests(
            `Too many requests. Try again in ${retryAfter} seconds.`,
            retryAfter,
            'RateLimitMiddleware'
          )
        )
      }

      return undefined
    } catch (error) {
      logger.error({ error, ip, key }, 'Rate limit check error - allowing request')
      return undefined
    }
  })

const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/

function isValidIpv4(ip: string): boolean {
  if (!IPV4_REGEX.test(ip)) return false
  const parts = ip.split('.').map(Number)
  return parts.every((part) => part >= 0 && part <= 255)
}

function getClientIp(request: Request): string {
  const isProduction = process.env.NODE_ENV === 'production'
  const trustProxy = isProduction

  if (trustProxy) {
    const cfConnectingIp = request.headers.get('cf-connecting-ip')
    if (cfConnectingIp && isValidIpv4(cfConnectingIp)) {
      return cfConnectingIp
    }

    const forwarded = request.headers.get('x-forwarded-for')
    if (forwarded) {
      const firstIp = forwarded.split(',')[0].trim()
      if (isValidIpv4(firstIp)) {
        return firstIp
      }
    }

    const realIp = request.headers.get('x-real-ip')
    if (realIp && isValidIpv4(realIp)) {
      return realIp
    }
  }

  return 'unknown'
}

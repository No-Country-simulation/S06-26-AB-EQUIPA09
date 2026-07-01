import { eq, isNull, count, asc, and } from 'drizzle-orm'
import type { InferSelectModel } from 'drizzle-orm'
import type { Database } from '@/db'
import { users } from '@/db/schema'
import type { IUserRepository } from '../../application/ports/user.port'
import { toPublicUser, type UserResponseDTO } from '../../application/dtos/user.dto'
import { encryptFields, decryptFields, createCryptoConfig } from '@/shared/crypto/crypto-fields'
import { getEncryption } from '@/shared/crypto/encryption.service'
import { dbExec } from '@/db/db-exec'

type UserSelect = InferSelectModel<typeof users>

const CRYPTO_CONFIG = createCryptoConfig(['email', 'name', 'phone'])

const toUserResponseDTO = (row: UserSelect): UserResponseDTO => {
  const d = decryptFields(row, CRYPTO_CONFIG)
  return toPublicUser({
    id:        row.id,
    email:     d.email    as string,
    name:      d.name     as string,
    phone:     d.phone    as string | null ?? null,
    avatar:    row.avatar ?? null,
    locale:    row.locale ?? 'pt',
    timezone:  row.timezone ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })
}

export const createUserRepository = (db: Database): IUserRepository => {
  const encryption = getEncryption()

  return {
    async create(data, tx) {
      return dbExec('create', 'UserRepository', async () => {
        const conn = (tx ?? db) as Database
        const encrypted = encryptFields(data, CRYPTO_CONFIG)

        const [row] = await conn
          .insert(users)
          .values({
            email:        encrypted.email        as string,
            emailHash:    data.emailHash         ?? (data.email ? encryption.hash(data.email) : ''),
            name:         encrypted.name         as string,
            phone:        encrypted.phone        as string | undefined,
            passwordHash: data.passwordHash      ?? '',
            googleId:     data.googleId,
            avatar:       data.avatar,
            locale:       data.locale            ?? 'pt',
            timezone:     data.timezone,
          })
          .returning()

        return toUserResponseDTO(row)
      })
    },

    async findById(id) {
      return dbExec('findById', 'UserRepository', async () => {
        const [row] = await db
          .select()
          .from(users)
          .where(and(eq(users.id, id), isNull(users.deletedAt)))
          .limit(1)
        return row ? toUserResponseDTO(row) : null
      })
    },

    async findByEmailHash(emailHash) {
      return dbExec('findByEmailHash', 'UserRepository', async () => {
        const [row] = await db
          .select()
          .from(users)
          .where(and(eq(users.emailHash, emailHash), isNull(users.deletedAt)))
          .limit(1)

        if (!row) return null
        return {
          ...toUserResponseDTO(row),
          passwordHash: row.passwordHash ?? null,
        }
      })
    },

    async findByGoogleId(googleId) {
      return dbExec('findByGoogleId', 'UserRepository', async () => {
        const [row] = await db
          .select()
          .from(users)
          .where(and(eq(users.googleId, googleId), isNull(users.deletedAt)))
          .limit(1)
        return row ? toUserResponseDTO(row) : null
      })
    },

    async list(page, perPage, _filters) {
      return dbExec('list', 'UserRepository', async () => {
        const offset = (page - 1) * perPage

        const conditions = [isNull(users.deletedAt)]
        const where = and(...conditions)

        const [data, totalResult] = await Promise.all([
          db
            .select()
            .from(users)
            .where(where)
            .orderBy(asc(users.createdAt))
            .limit(perPage)
            .offset(offset),
          db.select({ count: count() }).from(users).where(where),
        ])

        const totalItems = totalResult[0].count
        return {
          data: data.map(toUserResponseDTO),
          pagination: {
            currentPage: page,
            perPage,
            totalItems,
            totalPages: Math.ceil(totalItems / perPage),
          },
        }
      })
    },

    async update(id, data, tx) {
      return dbExec('update', 'UserRepository', async () => {
        const conn = (tx ?? db) as Database
        const updatePayload: Record<string, unknown> = { updatedAt: new Date() }

        if (data.name)      updatePayload.name         = encryption.encrypt(data.name)
        if (data.phone)     updatePayload.phone        = encryption.encrypt(data.phone)
        if (data.googleId)  updatePayload.googleId     = data.googleId
        if (data.passwordHash !== undefined) updatePayload.passwordHash = data.passwordHash
        if (data.avatar   !== undefined) updatePayload.avatar   = data.avatar
        if (data.locale   !== undefined) updatePayload.locale   = data.locale
        if (data.timezone !== undefined) updatePayload.timezone = data.timezone

        const [row] = await conn
          .update(users)
          .set(updatePayload)
          .where(eq(users.id, id))
          .returning()

        return toUserResponseDTO(row)
      })
    },

    async softDelete(id, tx) {
      return dbExec('softDelete', 'UserRepository', async () => {
        const conn = (tx ?? db) as Database
        await conn
          .update(users)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(users.id, id))
      })
    },
  }
}

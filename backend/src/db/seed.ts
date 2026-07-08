import { hash } from '@node-rs/argon2'
import { count } from 'drizzle-orm'
import { db, closeDatabaseConnection } from './index'
import { staffUsers } from './schema'
import { getEncryption } from '../shared/crypto/encryption.service'

const ARGON2_CONFIG = {
  memoryCost: 19456,
  timeCost:   2,
  parallelism: 1,
} as const

const DEFAULT_STAFF_EMAIL = 'admin@sqlens.ao'
const DEFAULT_STAFF_PASSWORD = 'Admin@2025!'
const DEFAULT_STAFF_NAME = 'Admin'

async function seedStaffUser() {
  const [{ total }] = await db.select({ total: count() }).from(staffUsers)

  if (total > 0) {
    console.log(`Seed ignorado: já existe(m) ${total} staff user(s).`)
    return
  }

  const email = process.env.STAFF_SEED_EMAIL ?? DEFAULT_STAFF_EMAIL
  const password = process.env.STAFF_SEED_PASSWORD ?? DEFAULT_STAFF_PASSWORD
  const name = process.env.STAFF_SEED_NAME ?? DEFAULT_STAFF_NAME

  const encryption = getEncryption()
  const passwordHash = await hash(password, ARGON2_CONFIG)

  const inserted = await db.insert(staffUsers).values({
    email:        encryption.encrypt(email),
    emailHash:    encryption.hash(email),
    name:         encryption.encrypt(name),
    passwordHash,
    isActive:     true,
  }).onConflictDoNothing({ target: staffUsers.emailHash }).returning({ id: staffUsers.id })

  if (inserted.length === 0) {
    console.log('Seed ignorado: staff user já existe.')
    return
  }

  console.log(`Staff seed criado com sucesso: ${email}`)
}

seedStaffUser()
  .catch((error) => {
    console.error('Falha ao executar seed da base de dados:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await closeDatabaseConnection()
    process.exit(process.exitCode ?? 0)
  })

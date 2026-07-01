import { z } from 'zod'
import { users } from '@/db/schema'

// ─────────────────────────────────────────────
// Response
// ─────────────────────────────────────────────

export type UserResponseDTO = {
  id:        string
  email:     string
  name:      string
  phone:     string | null
  avatar:    string | null
  locale:    string
  timezone:  string | null
  createdAt: Date
  updatedAt: Date
}

type PublicUserShape = Pick<
  typeof users.$inferSelect,
  'id' | 'avatar' | 'locale' | 'timezone' | 'createdAt' | 'updatedAt'
> & {
  email: string
  name: string
  phone: string | null
}

export const toPublicUser = (user: PublicUserShape): UserResponseDTO => ({
  id:        user.id,
  email:     user.email,
  name:      user.name,
  phone:     user.phone,
  avatar:    user.avatar,
  locale:    user.locale ?? 'pt',
  timezone:  user.timezone ?? null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
})

// ─────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────

export type UpdateProfileDTO = {
  name?:     string
  phone?:    string
  locale?:   string
  timezone?: string
  avatar?:   string
}

// ─────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────

export const updateProfileSchema = z.object({
  name:     z.string().min(2,   'Nome deve ter pelo menos 2 caracteres').optional(),
  phone:    z.string().min(7,   'Telefone inválido').optional(),
  locale:   z.string().max(10,  'Locale inválido').optional(),
  timezone: z.string().max(100, 'Timezone inválida').optional(),
  avatar:   z.string().optional(),
})

export const userIdSchema = z.object({
  id: z.string().uuid('ID inválido'),
})

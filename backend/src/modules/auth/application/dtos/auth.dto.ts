import { z } from 'zod'
import type { UserResponseDTO } from '@/modules/users/application/dtos/user.dto'

// ─────────────────────────────────────────────
// User auth
// ─────────────────────────────────────────────

export type RegisterDTO = {
  email:    string
  password: string
  name:     string
}

export type LoginDTO = {
  email:    string
  password: string
}

export type AuthResponseDTO = {
  accessToken:  string
  refreshToken: string
  user:         UserResponseDTO
}

export type RefreshTokenDTO = {
  refreshToken: string
}

// ─────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────

const strongPassword = z.string().min(6, 'Password deve ter pelo menos 6 caracteres')

export const registerSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: strongPassword,
  name:     z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
})

export const loginSchema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(1, 'Password obrigatória'),
})

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token obrigatório'),
})



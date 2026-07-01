import type { Result } from '@/shared/result/types'
import type { AppError } from '@/shared/result/errors'
import type { DbOrTx } from '@/db/transaction'
import type { UserResponseDTO, UpdateProfileDTO } from '../dtos/user.dto'

// ─────────────────────────────────────────────
// Shared pagination wrapper (reuse pattern do staff)
// ─────────────────────────────────────────────

export interface ListResponse<T> {
  data: T
  pagination: {
    currentPage: number
    perPage:     number
    totalItems:  number
    totalPages:  number
  }
}

// ─────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────

export interface IUserRepository {
  create(data: {
    email?:        string
    emailHash?:    string
    passwordHash?: string | null
    googleId?:     string
    name?:         string
    avatar?:       string
    roles?:        Array<'buyer' | 'seller'>
    phone?:        string
    locale?:       string
    timezone?:     string
  }, db?: DbOrTx): Promise<UserResponseDTO>

  findById(id: string): Promise<UserResponseDTO | null>

  findByEmailHash(
    emailHash: string
  ): Promise<(UserResponseDTO & { passwordHash: string | null }) | null>

  findByGoogleId(googleId: string): Promise<UserResponseDTO | null>

  list(
    page:    number,
    perPage: number,
    filters?: { role?: 'buyer' | 'seller' }
  ): Promise<ListResponse<UserResponseDTO[]>>

  update(
    id:   string,
    data: Partial<UpdateProfileDTO & { googleId?: string; passwordHash?: string }>,
    db?:  DbOrTx
  ): Promise<UserResponseDTO>

  softDelete(id: string, db?: DbOrTx): Promise<void>
}

// ─────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────

export interface IUserService {
  getById(userId: string): Promise<Result<UserResponseDTO, AppError>>
  updateProfile(
    userId: string,
    data:   UpdateProfileDTO
  ): Promise<Result<UserResponseDTO, AppError>>
  deleteAccount(userId: string): Promise<Result<void, AppError>>
}

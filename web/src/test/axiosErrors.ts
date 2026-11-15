import { AxiosError, type AxiosResponse } from 'axios'

/** Cria um AxiosError como o que o backend produz: { success: false, error: { type, message } }. */
export function apiError(status: number, message?: string): AxiosError {
  const data = message === undefined
    ? undefined
    : { success: false, error: { type: 'ERROR', message, timestamp: '2026-01-01T00:00:00.000Z' } }
  return new AxiosError(
    `Request failed with status code ${status}`,
    'ERR_BAD_REQUEST',
    undefined,
    undefined,
    { status, data, statusText: '', headers: {}, config: {} as never } as AxiosResponse,
  )
}

/** Erro de rede: sem resposta do servidor. */
export const networkError = () => new AxiosError('Network Error', 'ERR_NETWORK')

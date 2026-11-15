import axios from 'axios'

/**
 * Extrai uma mensagem legível de um erro de API. O backend responde com
 * `{ success: false, error: { type, message } }`; quando há resposta usamos a `message`
 * dele, e só recorremos a textos genéricos quando não há (rede em baixo, 5xx sem corpo, etc.).
 */
export function getApiErrorMessage(err: unknown, fallback = 'Não foi possível concluir o pedido. Tente novamente.'): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return 'Sem ligação ao servidor. Verifique a sua rede e tente novamente.'
    const { status, data } = err.response
    const serverMessage: unknown = data?.error?.message ?? data?.message
    if (status === 429) return 'Demasiados pedidos. Aguarde um momento e tente novamente.'
    if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage
    if (status === 401) return 'A sua sessão expirou. Inicie sessão novamente.'
  }
  return fallback
}

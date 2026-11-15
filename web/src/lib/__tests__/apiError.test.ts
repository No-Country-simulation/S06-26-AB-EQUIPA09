import { describe, it, expect } from 'vitest'
import { getApiErrorMessage } from '../apiError'
import { apiError, networkError } from '../../test/axiosErrors'

describe('getApiErrorMessage', () => {
  it('usa a mensagem do servidor quando existe', () => {
    expect(getApiErrorMessage(apiError(401, 'Credenciais inválidas'))).toBe('Credenciais inválidas')
    expect(getApiErrorMessage(apiError(502, 'O assistente de IA não está disponível neste ambiente.')))
      .toBe('O assistente de IA não está disponível neste ambiente.')
  })

  // regressão: o objeto `error` da API era renderizado como filho React e quebrava a página de login
  it('devolve sempre uma string, nunca o objeto de erro', () => {
    const msg = getApiErrorMessage(apiError(400, 'Dados inválidos'))
    expect(typeof msg).toBe('string')
  })

  it('429 tem mensagem em português, mesmo que o servidor responda em inglês', () => {
    expect(getApiErrorMessage(apiError(429, 'Too many requests. Try again in 539 seconds.')))
      .toBe('Demasiados pedidos. Aguarde um momento e tente novamente.')
  })

  it('401 sem corpo indica sessão expirada', () => {
    expect(getApiErrorMessage(apiError(401))).toBe('A sua sessão expirou. Inicie sessão novamente.')
  })

  it('sem resposta (rede em baixo) indica falha de ligação', () => {
    expect(getApiErrorMessage(networkError())).toMatch(/Sem ligação ao servidor/)
  })

  it('usa o texto de recurso para 5xx sem corpo e para erros que não são do axios', () => {
    expect(getApiErrorMessage(apiError(500), 'Falhou')).toBe('Falhou')
    expect(getApiErrorMessage(new Error('boom'), 'Falhou')).toBe('Falhou')
    expect(getApiErrorMessage('x')).toMatch(/Não foi possível concluir/)
  })
})

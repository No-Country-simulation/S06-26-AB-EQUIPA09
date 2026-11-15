import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AIQueryBar from '../AIQueryBar'
import { useAppStore } from '../../../store'
import { apiError } from '../../../test/axiosErrors'

const post = vi.fn()
vi.mock('../../../hooks/useAuth', () => ({ api: { post: (...a: unknown[]) => post(...a), get: vi.fn() } }))

function renderBar(props: { compact?: boolean; onResposta?: () => void } = {}) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AIQueryBar {...props} />
    </QueryClientProvider>,
  )
}

async function ask(text: string) {
  const user = userEvent.setup()
  await user.type(screen.getByPlaceholderText(/Faça uma pergunta/), text)
  await user.click(screen.getByRole('button', { name: /Consultar/ }))
}

describe('AIQueryBar', () => {
  beforeEach(() => {
    post.mockReset()
    useAppStore.setState({ consultaAtual: '', ultimaResposta: null })
  })

  it('o botão fica desativado sem texto', () => {
    renderBar()
    expect(screen.getByRole('button', { name: /Consultar/ })).toBeDisabled()
  })

  it('envia a pergunta ao agente e mostra a resposta com as fontes', async () => {
    post.mockResolvedValue({ data: { aiResponse: 'CENTRO_HISTORICO: 0.25', result: [{ name: 'CENTRO_HISTORICO', network_coverage_score: 0.25 }] } })
    const onResposta = vi.fn()
    renderBar({ onResposta })
    await ask('quais as regiões com menor cobertura?')

    expect(post).toHaveBeenCalledWith('/agent/query', { query: 'quais as regiões com menor cobertura?', filters: {} })
    expect(await screen.findByText('CENTRO_HISTORICO: 0.25')).toBeInTheDocument()
    expect(screen.getByText(/Fontes: Vísent CDRView/)).toBeInTheDocument()
    expect(onResposta).toHaveBeenCalledOnce()
  })

  it('o Enter também envia', async () => {
    post.mockResolvedValue({ data: { aiResponse: 'ok', result: [] } })
    renderBar()
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/Faça uma pergunta/), 'olá{Enter}')
    expect(post).toHaveBeenCalledOnce()
  })

  // regressão: o front mostrava sempre "Não foi possível processar a consulta" e deixava uma rejeição por tratar
  it('mostra a mensagem real do servidor quando o agente falha', async () => {
    post.mockRejectedValue(apiError(502, 'O assistente de IA não está disponível neste ambiente. Contacte a equipa técnica.'))
    renderBar()
    await ask('qualquer pergunta')
    expect(await screen.findByRole('alert')).toHaveTextContent('O assistente de IA não está disponível neste ambiente.')
  })

  it('mostra o aviso de rate limit em português', async () => {
    post.mockRejectedValue(apiError(429, 'Too many requests'))
    renderBar()
    await ask('pergunta')
    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados pedidos')
  })

  it('os exemplos preenchem o campo (modo normal) e não aparecem em modo compacto', async () => {
    const { unmount } = renderBar()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Onde faltam programas de formação/ }))
    expect(screen.getByPlaceholderText(/Faça uma pergunta/)).toHaveValue('Onde faltam programas de formação para jovens de baixa renda?')
    unmount()
    renderBar({ compact: true })
    expect(screen.queryByRole('button', { name: /Onde faltam programas/ })).not.toBeInTheDocument()
  })
})

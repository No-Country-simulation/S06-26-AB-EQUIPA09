import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import LoginPage from '../Login'
import { apiError, networkError } from '../../test/axiosErrors'

const loginMutate = vi.fn()
const registerMutate = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
  useLogin: () => ({ mutateAsync: loginMutate, isPending: false }),
  useRegister: () => ({ mutateAsync: registerMutate, isPending: false }),
}))

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app" element={<p>DASHBOARD</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function submitCredentials() {
  const user = userEvent.setup()
  await user.type(screen.getByPlaceholderText('gestor@orgao.gov.br'), 'gestor@orgao.gov.br')
  await user.type(screen.getByPlaceholderText('••••••••'), 'Senha12345!')
  // há dois botões "Entrar": o separador do modo e o de submissão (o último)
  const buttons = screen.getAllByRole('button', { name: 'Entrar' })
  await user.click(buttons[buttons.length - 1])
}

describe('Login', () => {
  beforeEach(() => { loginMutate.mockReset(); registerMutate.mockReset() })

  it('mostra o branding de Florianópolis, sem referências a Luanda/Angola', () => {
    renderLogin()
    expect(screen.getByText(/Florianópolis/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Luanda|Angola/)
  })

  it('autentica e navega para /app', async () => {
    loginMutate.mockResolvedValue({})
    renderLogin()
    await submitCredentials()
    expect(loginMutate).toHaveBeenCalledWith({ email: 'gestor@orgao.gov.br', password: 'Senha12345!' })
    expect(await screen.findByText('DASHBOARD')).toBeInTheDocument()
  })

  it('credenciais inválidas: mostra a mensagem do servidor e continua na página', async () => {
    loginMutate.mockRejectedValue(apiError(401, 'Email ou password incorretos'))
    renderLogin()
    await submitCredentials()
    expect(await screen.findByText('Email ou password incorretos')).toBeInTheDocument()
    expect(screen.queryByText('DASHBOARD')).not.toBeInTheDocument()
  })

  // regressão: a API devolve `error` como objeto { type, message }; renderizá-lo quebrava a página (React child inválido)
  it('rate limit (429): mostra texto em português em vez de quebrar a página', async () => {
    loginMutate.mockRejectedValue(apiError(429, 'Too many requests. Try again in 539 seconds.'))
    renderLogin()
    await submitCredentials()
    expect(await screen.findByText(/Demasiados pedidos/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('gestor@orgao.gov.br')).toBeInTheDocument()
  })

  it('servidor inacessível: mensagem de ligação', async () => {
    loginMutate.mockRejectedValue(networkError())
    renderLogin()
    await submitCredentials()
    expect(await screen.findByText(/Sem ligação ao servidor/)).toBeInTheDocument()
  })

  it('alterna para o formulário de registo (mais campos de texto)', async () => {
    renderLogin()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Registar' }))
    expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(2)
  })
})

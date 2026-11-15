import { test, expect } from '@playwright/test'

const email = process.env.E2E_STAFF_EMAIL
const password = process.env.E2E_STAFF_PASSWORD

test.describe('login staff', () => {
  test('rotas /staff/* sem sessão redirecionam para o login', async ({ page }) => {
    await page.goto('/staff/dashboard')
    await expect(page).toHaveURL(/\/staff\/login$/)
    await expect(page.getByText('Staff Login')).toBeVisible()
  })

  test('credenciais erradas mostram o erro e não entram', async ({ page }) => {
    await page.goto('/staff/login')
    await page.getByPlaceholder('admin@sqlens.com.br').fill('nao-existe@example.com')
    await page.getByPlaceholder('••••••••').fill('senha-errada-123')
    await page.getByRole('button', { name: 'Entrar' }).click()

    // a página tem de continuar viva (regressão: o erro era um objeto e quebrava a renderização)
    await expect(page.locator('p.text-status-bad').last()).not.toBeEmpty()
    await expect(page).toHaveURL(/\/staff\/login$/)
    await expect(page.getByPlaceholder('admin@sqlens.com.br')).toBeVisible()
  })

  test('entra no painel staff, mantém a sessão ao recarregar e consegue sair', async ({ page }) => {
    test.skip(!email || !password, 'defina E2E_STAFF_EMAIL e E2E_STAFF_PASSWORD')

    await page.goto('/staff/login')
    await page.getByPlaceholder('admin@sqlens.com.br').fill(email!)
    await page.getByPlaceholder('••••••••').fill(password!)
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page).toHaveURL(/\/staff\/dashboard$/)
    await expect(page.getByRole('button', { name: 'Terminar sessão' })).toBeVisible()

    // a sessão vive num cookie httpOnly: sobrevive ao reload e dá acesso às outras áreas staff
    await page.reload()
    await expect(page).toHaveURL(/\/staff\/dashboard$/)
    await page.goto('/staff/indicadores')
    await expect(page).toHaveURL(/\/staff\/indicadores$/)
    await expect(page.getByText('Taxa de emprego formal').first()).toBeVisible()

    await page.getByRole('button', { name: 'Terminar sessão' }).click()
    await expect(page).toHaveURL(/\/staff\/login$/)

    // depois de sair, o painel volta a ficar protegido
    await page.goto('/staff/dashboard')
    await expect(page).toHaveURL(/\/staff\/login$/)
  })
})

import { test, expect } from '@playwright/test'

const email = process.env.E2E_USER_EMAIL
const password = process.env.E2E_USER_PASSWORD

test.describe('fluxo do utilizador', () => {
  test('rotas /app sem sessão redirecionam para o login', async ({ page }) => {
    await page.goto('/app')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText(/Florianópolis/)).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/Luanda|Angola/)
  })

  test('login → dashboard com regiões e indicadores reais → mapa', async ({ page }) => {
    test.skip(!email || !password, 'defina E2E_USER_EMAIL e E2E_USER_PASSWORD')

    await page.goto('/login')
    await page.getByPlaceholder('gestor@orgao.gov.br').fill(email!)
    await page.getByPlaceholder('••••••••').fill(password!)
    await page.getByRole('button', { name: 'Entrar' }).last().click()
    await expect(page).toHaveURL(/\/app$/)

    // Regiões analisadas > 0 e ranking de prioridade presente
    await expect(page.getByText('Regiões analisadas')).toBeVisible()
    await expect(page.getByText('Prioridade de investimento')).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/Luanda|Angola/)

    await page.getByRole('link', { name: /Mapa de Cobertura/ }).click()
    await expect(page).toHaveURL(/\/app\/mapa$/)
    await expect(page.locator('.leaflet-container')).toBeVisible()
    await expect(page.locator('path.leaflet-interactive').first()).toBeVisible()
  })
})

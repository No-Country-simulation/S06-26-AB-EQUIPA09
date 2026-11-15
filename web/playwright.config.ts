import { defineConfig, devices } from '@playwright/test'

/**
 * Testes E2E contra a stack local já a correr (backend :3001 + front :5173):
 *   docker compose -f infra/docker-compose.yml up -d && ./run-backend.sh && (cd web && npm run dev)
 *
 * Credenciais por variáveis de ambiente (nunca no código):
 *   E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD   utilizador staff (o do seed)
 *   E2E_USER_EMAIL  / E2E_USER_PASSWORD    utilizador comum já registado
 * Os testes que precisam delas são ignorados se faltarem.
 *
 * Atenção: o login tem rate limit de 5 tentativas / 15 min por IP, em memória (reinicie o backend para zerar).
 * A suíte faz no máximo 3 tentativas de login por execução.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})

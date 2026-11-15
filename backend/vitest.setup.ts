// Defaults só para testes — nunca sobrescrevem variáveis já definidas (ex.: via .env / CI).
const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-jwt-secret-with-at-least-32-characters',
  APP_URL: 'http://localhost:3001',
  CORS_ORIGINS: 'http://localhost:5173',
  ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  SIGNED_URL_SECRET: 'test-signed-url-secret',
  LOG_LEVEL: 'fatal',
  LOG_PRETTY: 'false',
  DB_USER: 'edgar',
  DB_HOST: 'localhost',
  DB_DATABASE: 'postgres',
  DB_PASSWORD: '123456',
}
for (const [k, v] of Object.entries(defaults)) {
  if (!process.env[k]) process.env[k] = v
}

// ENCRYPTION_KEY tem de ser 32 bytes em hex (64 caracteres). Um valor inválido vindo do ambiente (ex.: CI)
// faria qualquer teste que importe o módulo de criptografia falhar ao carregar.
if (!/^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY ?? '')) {
  process.env.ENCRYPTION_KEY = defaults.ENCRYPTION_KEY
}

/**
 * Resolve qual provedor de LLM (API compatível com OpenAI /chat/completions) o agente usa.
 *
 * Ordem: LLM_PROVIDER força a escolha; senão usa Groq se GROQ_API_KEY existir, senão Cohere
 * se COHERE_API_KEY existir. Nenhum provedor configurado → null.
 */
export type LlmProviderName = 'groq' | 'cohere'

export interface LlmConfig {
  provider: LlmProviderName
  label: string
  url: string
  apiKey: string
  model: string
  /** Nome da variável de ambiente da chave (para mensagens de erro). */
  keyEnvVar: string
}

const PROVIDERS: Record<LlmProviderName, Omit<LlmConfig, 'apiKey' | 'model'> & { defaultModel: string; modelEnvVar: string }> = {
  groq: {
    provider: 'groq',
    label: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    keyEnvVar: 'GROQ_API_KEY',
    modelEnvVar: 'GROQ_MODEL',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  cohere: {
    provider: 'cohere',
    label: 'Cohere',
    url: 'https://api.cohere.ai/compatibility/v1/chat/completions',
    keyEnvVar: 'COHERE_API_KEY',
    modelEnvVar: 'COHERE_MODEL',
    defaultModel: 'command-a-03-2025',
  },
}

export const resolveLlmConfig = (env: NodeJS.ProcessEnv = process.env): LlmConfig | null => {
  const forced = env.LLM_PROVIDER?.trim().toLowerCase()
  const order: LlmProviderName[] =
    forced === 'groq' || forced === 'cohere' ? [forced] : ['groq', 'cohere']

  for (const name of order) {
    const p = PROVIDERS[name]
    const apiKey = env[p.keyEnvVar]?.trim()
    if (apiKey) {
      return {
        provider: p.provider,
        label: p.label,
        url: p.url,
        apiKey,
        model: env[p.modelEnvVar]?.trim() || p.defaultModel,
        keyEnvVar: p.keyEnvVar,
      }
    }
  }
  return null
}

/** Mensagem para o utilizador final (sem detalhes de configuração). */
export const LLM_NOT_CONFIGURED_MESSAGE = 'O assistente de IA não está disponível neste ambiente. Contacte a equipa técnica.'

/** Dica para os logs do servidor. */
export const LLM_NOT_CONFIGURED_HINT = 'Nenhum provedor de IA configurado: defina GROQ_API_KEY (ou COHERE_API_KEY) no .env do backend'

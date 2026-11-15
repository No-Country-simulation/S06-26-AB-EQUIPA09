import { describe, it, expect } from 'vitest'
import { resolveLlmConfig } from '../application/services/llm-provider'

describe('resolveLlmConfig', () => {
  it('sem chaves → null', () => {
    expect(resolveLlmConfig({})).toBeNull()
    expect(resolveLlmConfig({ GROQ_API_KEY: '  ' })).toBeNull()
  })
  it('usa Groq por omissão quando tem chave', () => {
    const c = resolveLlmConfig({ GROQ_API_KEY: 'g', COHERE_API_KEY: 'c' })
    expect(c?.provider).toBe('groq')
    expect(c?.model).toBe('llama-3.3-70b-versatile')
  })
  it('cai para Cohere se só existir COHERE_API_KEY', () => {
    const c = resolveLlmConfig({ COHERE_API_KEY: 'c', COHERE_MODEL: 'command-x' })
    expect(c).toMatchObject({ provider: 'cohere', model: 'command-x', apiKey: 'c' })
    expect(c?.url).toContain('cohere')
  })
  it('LLM_PROVIDER força o provedor e não faz fallback para outro', () => {
    expect(resolveLlmConfig({ LLM_PROVIDER: 'cohere', GROQ_API_KEY: 'g', COHERE_API_KEY: 'c' })?.provider).toBe('cohere')
    expect(resolveLlmConfig({ LLM_PROVIDER: 'cohere', GROQ_API_KEY: 'g' })).toBeNull()
  })
  it('GROQ_MODEL sobrepõe o modelo por omissão', () => {
    expect(resolveLlmConfig({ GROQ_API_KEY: 'g', GROQ_MODEL: 'm' })?.model).toBe('m')
  })
})

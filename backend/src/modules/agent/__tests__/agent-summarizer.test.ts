import { describe, it, expect } from 'bun:test'
import { summarizeRows, buildSummaryMessages } from '../application/services/agent-summarizer'
import type { LlmConfig } from '../application/services/llm-provider'

const llm: LlmConfig = {
  provider: 'cohere',
  label: 'Cohere',
  url: 'https://llm.test/v1/chat/completions',
  apiKey: 'k',
  model: 'm',
  keyEnvVar: 'COHERE_API_KEY',
}
const ok = (content: unknown) => async () =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })

describe('summarizeRows', () => {
  it('devolve o texto do modelo sem espaços nas pontas', async () => {
    const out = await summarizeRows(llm, 'q', [{ regiao: 'A', cobertura: 0.65 }], ok('  Resumo.  '))
    expect(out).toBe('Resumo.')
  })

  it('devolve null sem linhas, sem chamar o modelo', async () => {
    let called = false
    const out = await summarizeRows(llm, 'q', [], async () => {
      called = true
      return new Response('{}')
    })
    expect(out).toBeNull()
    expect(called).toBe(false)
  })

  it('devolve null se o provedor responde erro, resposta inválida ou lança', async () => {
    expect(
      await summarizeRows(llm, 'q', [{ a: 1 }], async () => new Response('x', { status: 500 }))
    ).toBeNull()
    expect(await summarizeRows(llm, 'q', [{ a: 1 }], ok(42))).toBeNull()
    expect(
      await summarizeRows(llm, 'q', [{ a: 1 }], async () => {
        throw new Error('rede')
      })
    ).toBeNull()
  })

  it('envia no máximo 20 linhas e corta células longas', () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ n: i, t: 'x'.repeat(500) }))
    const user = buildSummaryMessages('q', rows)[1].content
    expect(user).toContain('20 de 50 linhas')
    expect(user.length).toBeLessThan(20 * 200)
  })
})

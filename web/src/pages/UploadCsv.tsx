import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '../hooks/useAuth'

type UploadMode = 'csv' | 'xlsx'

const REQUIRED_FILES = [
  { name: 'antenas_flp.csv', label: 'Antenas / Estações Base', required: true },
  { name: 'tensor_concentracao.csv', label: 'Concentração de Dados', required: true },
]

const OPTIONAL_FILES = [
  { name: 'tensor_fluxo_vias.csv', label: 'Fluxo de Vias' },
  { name: 'tensor_od.csv', label: 'Matriz Origem-Destino' },
  { name: 'tensor_tempo_deslocamento.csv', label: 'Tempo de Deslocamento' },
  { name: 'trajetos_comuns.csv', label: 'Trajetos Comuns' },
  { name: 'sumario_kanon.csv', label: 'Sumário K-Anonimato' },
]

export default function UploadCsv() {
  const [mode, setMode] = useState<UploadMode>('csv')
  const [files, setFiles] = useState<File[]>([])
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  const upload = useMutation({
    mutationFn: async (payload: FormData) => {
      const { data } = await api.post('/api/upload/csv', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
  })

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    if (selected.length === 0) return
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name))
      const unique = selected.filter(f => !existing.has(f.name))
      return [...prev, ...unique]
    })
  }

  function removeFile(name: string) {
    setFiles(prev => prev.filter(f => f.name !== name))
  }

  async function handleUpload() {
    if (files.length === 0) return
    setMessage('')
    setSuccess(false)
    try {
      const formData = new FormData()
      files.forEach(f => formData.append('files', f))
      await upload.mutateAsync(formData)
      setMessage('Upload concluído com sucesso.')
      setSuccess(true)
      setFiles([])
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? 'Falha no upload.')
      setSuccess(false)
    }
  }

  const accept = mode === 'csv' ? '.csv,text/csv' : '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

  return (
    <div className="p-7 max-w-3xl mx-auto">
      <div className="bg-ink-900 rounded-2xl border border-ink-border-soft p-6">
        <h1 className="text-[20px] font-semibold text-mist-50 mb-1">Upload de Dados</h1>
        <p className="text-[13px] text-mist-500 mb-6">Envie os seus ficheiros CSV ou Excel para análise.</p>

        <div className="flex gap-2 mb-6">
          {(['csv', 'xlsx'] as UploadMode[]).map(key => (
            <button
              key={key}
              type="button"
              onClick={() => { setMode(key); setFiles([]); setMessage(''); setSuccess(false) }}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                mode === key
                  ? 'bg-signal-500 text-ink-950'
                  : 'bg-ink-850 text-mist-400 border border-ink-border hover:border-signal-500/50'
              }`}
            >
              {key === 'csv' ? 'CSV' : 'Excel'}
            </button>
          ))}
        </div>

        {mode === 'csv' && (
          <div className="mb-6 space-y-4">
            <div className="rounded-xl border border-ink-border bg-ink-850 p-4">
              <h2 className="text-[14px] font-semibold text-mist-50 mb-2">
                Ingestão CVSS — Dados de Telecomunicações
              </h2>
              <p className="text-[12px] text-mist-400 leading-relaxed mb-3">
                Esta funcionalidade importa dados de operadoras de telecomunicações para análise
                de cobertura, qualidade e indicadores de rede. O sistema identifica cada ficheiro
                pelo nome para processar as colunas corretamente.
              </p>

              <h3 className="text-[12px] font-semibold text-mist-300 mb-2">
                Ficheiros obrigatórios
              </h3>
              <ul className="space-y-1.5 mb-3">
                {REQUIRED_FILES.map(f => (
                  <li key={f.name} className="flex items-center gap-2 text-[12px]">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-status-bad" />
                    <code className="text-signal-400 font-mono">{f.name}</code>
                    <span className="text-mist-500">— {f.label}</span>
                  </li>
                ))}
              </ul>

              <h3 className="text-[12px] font-semibold text-mist-300 mb-2">
                Ficheiros opcionais
              </h3>
              <ul className="space-y-1.5">
                {OPTIONAL_FILES.map(f => (
                  <li key={f.name} className="flex items-center gap-2 text-[12px]">
                    <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-mist-700" />
                    <code className="text-mist-400 font-mono">{f.name}</code>
                    <span className="text-mist-500">— {f.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-ink-border bg-ink-850 p-4">
              <h3 className="text-[12px] font-semibold text-mist-300 mb-2">Como fazer</h3>
              <ol className="space-y-1.5 text-[12px] text-mist-400 list-decimal list-inside">
                <li>Os ficheiros devem ter os <strong className="text-mist-300">nomes exatos</strong> listados acima</li>
                <li>Selecione os ficheiros da pasta <code className="text-signal-400 font-mono">cvss/</code> do projeto</li>
                <li>Envie pelo menos os dois obrigatórios em simultâneo</li>
                <li>O sistema processa e armazena os dados automaticamente</li>
              </ol>
            </div>
          </div>
        )}

        <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-signal-500 hover:bg-signal-400 text-ink-950 text-[13px] font-medium px-4 py-2 mb-4">
          {upload.isPending ? 'A enviar…' : 'Selecionar ficheiros'}
          <input
            type="file"
            accept={accept}
            multiple
            className="hidden"
            disabled={upload.isPending}
            onChange={handleFileSelect}
          />
        </label>

        {files.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-[12px] text-mist-600 font-mono">{files.length} ficheiro(s)</p>
            <div className="flex flex-wrap gap-2">
              {files.map(f => (
                <div key={f.name} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink-850 border border-ink-border text-[12px] text-mist-300">
                  <span className="truncate max-w-[200px]">{f.name}</span>
                  <span className="text-mist-600">({(f.size / 1024).toFixed(0)}KB)</span>
                  <button type="button" onClick={() => removeFile(f.name)} className="text-status-bad hover:text-status-bad/80 ml-1" disabled={upload.isPending}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleUpload}
          disabled={upload.isPending || files.length === 0}
          className="rounded-lg bg-signal-500 hover:bg-signal-400 text-ink-950 text-[13px] font-medium px-5 py-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {upload.isPending ? 'A enviar…' : `Enviar ${files.length} ficheiro(s)`}
        </button>

        {message && (
          <p className={`text-[13px] mt-4 ${success ? 'text-status-good' : 'text-status-bad'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  )
}

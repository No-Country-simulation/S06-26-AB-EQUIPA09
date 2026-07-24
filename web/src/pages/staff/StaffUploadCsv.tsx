import { useState } from 'react'
import { useUploadCvssCSVs, useStaffDataSources, type CvssIngestionResult } from '../../hooks/useStaffApi'
import StaffShell from '../../components/staff/StaffShell'

type UploadMode = 'cvss' | 'datasource'

const MODE_LABEL: Record<UploadMode, string> = {
  cvss: 'CVSS (antenas_flp.csv + tensor_concentracao.csv)',
  datasource: 'Data Source específico',
}

export default function StaffUploadCsv() {
  const [mode, setMode] = useState<UploadMode>('cvss')
  const [files, setFiles] = useState<File[]>([])
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<CvssIngestionResult | null>(null)

  const uploadCvss = useUploadCvssCSVs()
  const { data: sources = [] } = useStaffDataSources()

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
    setResult(null)
    try {
      if (mode === 'cvss') {
        const response = await uploadCvss.mutateAsync(files)
        setResult(response)
        setMessage('Ingestão concluída com sucesso.')
        setFiles([])
      }
    } catch (err: any) {
      setMessage(err?.response?.data?.error?.message ?? err?.response?.data?.message ?? 'Falha na ingestão.')
    }
  }

  const isPending = uploadCvss.isPending

  return (
    <StaffShell title="Upload CSV">
      <div className="space-y-6">
        {/* Selecção do modo */}
        <section className="bg-ink-900 rounded-2xl border border-ink-border-soft p-5">
          <h2 className="text-[15px] font-semibold text-mist-50 mb-3">Modo de ingestão</h2>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(MODE_LABEL) as [UploadMode, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => { setMode(key); setFiles([]); setMessage(''); setResult(null) }}
                className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  mode === key
                    ? 'bg-signal-500 text-ink-950'
                    : 'bg-ink-850 text-mist-400 border border-ink-border hover:border-signal-500/50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Upload area */}
        <section className="bg-ink-900 rounded-2xl border border-ink-border-soft p-5">
          <h2 className="text-[15px] font-semibold text-mist-50 mb-1">Ficheiros CSV</h2>
          <p className="text-[13px] text-mist-500 mb-4">
            {mode === 'cvss'
              ? 'Envie os ficheiros antenas_flp.csv e/ou tensor_concentracao.csv.'
              : 'Selecione um data source e envie o ficheiro CSV correspondente.'}
          </p>

          {mode === 'cvss' && (
            <>
              <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-signal-500 hover:bg-signal-400 text-ink-950 text-[13px] font-medium px-4 py-2 mb-4">
                {isPending ? 'A processar…' : 'Selecionar CSVs'}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  multiple
                  className="hidden"
                  disabled={isPending}
                  onChange={handleFileSelect}
                />
              </label>

              {files.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-[12px] text-mist-600 font-mono">{files.length} ficheiro(s) selecionado(s)</p>
                  <div className="flex flex-wrap gap-2">
                    {files.map(f => (
                      <div key={f.name} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink-850 border border-ink-border text-[12px] text-mist-300">
                        <span className="truncate max-w-[200px]">{f.name}</span>
                        <span className="text-mist-600">({(f.size / 1024).toFixed(0)}KB)</span>
                        <button
                          type="button"
                          onClick={() => removeFile(f.name)}
                          className="text-status-bad hover:text-status-bad/80 ml-1"
                          disabled={isPending}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleUpload}
                disabled={isPending || files.length === 0}
                className="rounded-lg bg-signal-500 hover:bg-signal-400 text-ink-950 text-[13px] font-medium px-5 py-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? 'A ingerir…' : `Ingerir ${files.length} ficheiro(s)`}
              </button>
            </>
          )}

          {mode === 'datasource' && (
            <p className="text-[13px] text-mist-500">
              A ingestão por data source está disponível na página{' '}
              <a href="/staff/ingestao" className="text-signal-400 hover:underline">Ingestão de Dados</a>.
            </p>
          )}
        </section>

        {/* Mensagem de feedback */}
        {message && (
          <div className={`rounded-2xl border p-5 ${
            result
              ? 'bg-status-good-soft/10 border-status-good/30 text-status-good'
              : 'bg-status-bad-soft/10 border-status-bad/30 text-status-bad'
          }`}>
            <p className="text-[14px] font-medium">{message}</p>
          </div>
        )}

        {/* Resultado CVSS */}
        {result && (
          <section className="bg-ink-900 rounded-2xl border border-ink-border-soft p-5">
            <h2 className="text-[15px] font-semibold text-mist-50 mb-4">Resultado da ingestão</h2>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="rounded-lg border border-ink-border bg-ink-850 px-3 py-2">
                <p className="text-[11px] text-mist-600">Registos</p>
                <p className="text-[16px] font-semibold text-mist-50">{result.recordsInserted}</p>
              </div>
              <div className="rounded-lg border border-ink-border bg-ink-850 px-3 py-2">
                <p className="text-[11px] text-mist-600">Regiões</p>
                <p className="text-[16px] font-semibold text-mist-50">{result.regionsUpserted}</p>
              </div>
              <div className="rounded-lg border border-ink-border bg-ink-850 px-3 py-2">
                <p className="text-[11px] text-mist-600">Estações</p>
                <p className="text-[16px] font-semibold text-mist-50">{result.stationsUpserted}</p>
              </div>
              <div className="rounded-lg border border-ink-border bg-ink-850 px-3 py-2">
                <p className="text-[11px] text-mist-600">Coberturas</p>
                <p className="text-[16px] font-semibold text-mist-50">{result.coverageRowsUpserted}</p>
              </div>
              <div className="rounded-lg border border-ink-border bg-ink-850 px-3 py-2">
                <p className="text-[11px] text-mist-600">Fontes</p>
                <p className="text-[16px] font-semibold text-mist-50">{result.registeredSources}</p>
              </div>
            </div>
            {result.filesProcessed.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] text-mist-600 font-mono mb-1">Ficheiros processados:</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.filesProcessed.map(f => (
                    <span key={f} className="text-[11px] px-2 py-0.5 rounded-full bg-ink-850 text-mist-400 font-mono border border-ink-border">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </StaffShell>
  )
}
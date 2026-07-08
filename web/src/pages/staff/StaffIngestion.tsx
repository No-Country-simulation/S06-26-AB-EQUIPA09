import { useMemo, useState } from 'react'
import StaffShell from '../../components/staff/StaffShell'
import { type DataSource, useCreateDataSource, useStaffDataSources, useUploadCSV } from '../../hooks/useStaffApi'

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function DataSourceRow({ source }: { source: DataSource }) {
  const upload = useUploadCSV(source.id)
  const [message, setMessage] = useState('')

  async function handleFile(file?: File) {
    if (!file) return
    setMessage('')
    try {
      await upload.mutateAsync(file)
      setMessage('Upload concluído.')
    } catch (err: any) {
      setMessage(err?.response?.data?.message ?? 'Falha no upload CSV.')
    }
  }

  return (
    <div className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-4 hover:bg-ink-850">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-[14px] font-medium text-mist-100 truncate">{source.name}</p>
          <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
            source.isActive
              ? 'bg-status-good-soft text-status-good border-status-good/30'
              : 'bg-ink-800 text-mist-600 border-ink-border'
          }`}>
            {source.isActive ? 'activo' : 'inactivo'}
          </span>
        </div>
        <p className="text-[12px] text-mist-600 mb-1">{source.description ?? 'Sem descrição'}</p>
        <p className="text-[11px] font-mono text-mist-600">
          {source.type} · criado em {source.createdAt ? new Date(source.createdAt).toLocaleDateString('pt-AO') : '—'}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <label className="cursor-pointer rounded-lg bg-signal-500 hover:bg-signal-400 text-ink-950 text-[12px] font-medium px-3 py-2">
          {upload.isPending ? 'A enviar…' : 'Upload CSV'}
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={upload.isPending}
            onChange={e => handleFile(e.target.files?.[0])}
          />
        </label>
        {message && <span className="text-[11px] text-mist-500 max-w-[160px]">{message}</span>}
      </div>
    </div>
  )
}

export default function StaffIngestion() {
  const { data: sources = [], isLoading } = useStaffDataSources()
  const createSource = useCreateDataSource()
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', type: 'csv', description: '' })

  const generatedSlug = useMemo(() => slugify(form.name || 'data-source'), [form.name])

  async function handleCreate() {
    setError('')
    try {
      await createSource.mutateAsync({
        slug: generatedSlug,
        name: form.name,
        type: form.type,
        description: form.description || null,
      })
      setForm({ name: '', type: 'csv', description: '' })
      setShowForm(false)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Não foi possível criar o data source.')
    }
  }

  return (
    <StaffShell title="Ingestão de Dados">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-[13px] text-mist-400">Fontes registadas para pipelines de ingestão.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(v => !v)}
          className="rounded-lg bg-signal-500 hover:bg-signal-400 text-ink-950 text-[13px] font-medium px-4 py-2"
        >
          Novo data source
        </button>
      </div>

      {showForm && (
        <div className="bg-ink-900 rounded-2xl border border-ink-border-soft p-5 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-3 mb-3">
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nome"
              className="px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 outline-none focus:border-signal-500"
            />
            <input
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              placeholder="csv"
              className="px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 outline-none focus:border-signal-500"
            />
          </div>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Descrição"
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 outline-none focus:border-signal-500 mb-3"
          />
          {error && <p className="text-[13px] text-status-bad mb-3">{error}</p>}
          <button
            type="button"
            onClick={handleCreate}
            disabled={createSource.isPending || !form.name}
            className="rounded-lg bg-signal-500 hover:bg-signal-400 text-ink-950 text-[13px] font-medium px-4 py-2 disabled:bg-ink-border disabled:text-mist-600"
          >
            {createSource.isPending ? 'A criar…' : 'Criar data source'}
          </button>
        </div>
      )}

      <section className="bg-ink-900 rounded-2xl border border-ink-border-soft overflow-hidden">
        {isLoading && <div className="px-5 py-6 text-[13px] text-mist-600">A carregar data sources…</div>}
        {!isLoading && sources.length === 0 && <div className="px-5 py-6 text-[13px] text-mist-600">Nenhum data source registado.</div>}
        <div className="divide-y divide-ink-border-soft">
          {sources.map(source => <DataSourceRow key={source.id} source={source} />)}
        </div>
      </section>
    </StaffShell>
  )
}

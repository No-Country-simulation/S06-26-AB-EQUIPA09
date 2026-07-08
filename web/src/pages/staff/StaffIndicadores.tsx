import { useState } from 'react'
import StaffShell from '../../components/staff/StaffShell'
import {
  type Indicator,
  useAddIndicadorData,
  useCreateIndicador,
  useStaffIndicadores,
} from '../../hooks/useStaffApi'

function AddDataModal({ indicator, onClose }: { indicator: Indicator; onClose: () => void }) {
  const addData = useAddIndicadorData()
  const [error, setError] = useState('')
  const [form, setForm] = useState({ regionId: '', value: '', period: new Date().toISOString().slice(0, 10) })

  async function handleSubmit() {
    setError('')
    try {
      await addData.mutateAsync({
        indicatorId: indicator.id,
        regionId: form.regionId,
        value: Number(form.value),
        period: form.period,
      })
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Não foi possível adicionar dados.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-[460px] bg-ink-900 border border-ink-border-soft rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-mist-600">Adicionar dados</p>
            <h2 className="text-[18px] font-medium text-mist-50">{indicator.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-mist-500 hover:text-mist-100 text-[20px]">×</button>
        </div>
        <div className="space-y-3">
          <input
            value={form.regionId}
            onChange={e => setForm(f => ({ ...f, regionId: e.target.value }))}
            placeholder="regionId"
            className="w-full px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 outline-none focus:border-signal-500"
          />
          <input
            type="number"
            value={form.value}
            onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
            placeholder="value"
            className="w-full px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 outline-none focus:border-signal-500"
          />
          <input
            type="date"
            value={form.period}
            onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
            className="w-full px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 outline-none focus:border-signal-500"
          />
        </div>
        {error && <p className="text-[13px] text-status-bad mt-3">{error}</p>}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={addData.isPending || !form.regionId || !form.value || !form.period}
          className="w-full mt-5 rounded-lg bg-signal-500 hover:bg-signal-400 text-ink-950 text-[13px] font-medium px-4 py-2 disabled:bg-ink-border disabled:text-mist-600"
        >
          {addData.isPending ? 'A guardar…' : 'Guardar dados'}
        </button>
      </div>
    </div>
  )
}

export default function StaffIndicadores() {
  const { data: indicators = [], isLoading } = useStaffIndicadores()
  const createIndicator = useCreateIndicador()
  const [selected, setSelected] = useState<Indicator | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ slug: '', name: '', unit: '', description: '' })

  async function handleCreate() {
    setError('')
    try {
      await createIndicator.mutateAsync({
        ...form,
        category: 'training',
        description: form.description || undefined,
      })
      setForm({ slug: '', name: '', unit: '', description: '' })
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Não foi possível criar o indicador.')
    }
  }

  return (
    <StaffShell title="Indicadores">
      <div className="bg-ink-900 rounded-2xl border border-ink-border-soft p-5 mb-5">
        <h2 className="text-[14px] font-medium text-mist-100 mb-4">Criar indicador</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <input
            value={form.slug}
            onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
            placeholder="slug"
            className="px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 outline-none focus:border-signal-500"
          />
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="name"
            className="px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 outline-none focus:border-signal-500"
          />
          <input
            value={form.unit}
            onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
            placeholder="unit"
            className="px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 outline-none focus:border-signal-500"
          />
        </div>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="description"
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 outline-none focus:border-signal-500 mb-3"
        />
        {error && <p className="text-[13px] text-status-bad mb-3">{error}</p>}
        <button
          type="button"
          onClick={handleCreate}
          disabled={createIndicator.isPending || !form.slug || !form.name || !form.unit}
          className="rounded-lg bg-signal-500 hover:bg-signal-400 text-ink-950 text-[13px] font-medium px-4 py-2 disabled:bg-ink-border disabled:text-mist-600"
        >
          {createIndicator.isPending ? 'A criar…' : 'Criar indicador'}
        </button>
      </div>

      <section className="bg-ink-900 rounded-2xl border border-ink-border-soft overflow-hidden">
        {isLoading && <div className="px-5 py-6 text-[13px] text-mist-600">A carregar indicadores…</div>}
        {!isLoading && indicators.length === 0 && <div className="px-5 py-6 text-[13px] text-mist-600">Nenhum indicador registado.</div>}
        <div className="divide-y divide-ink-border-soft">
          {indicators.map(indicator => (
            <div key={indicator.id} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-ink-850">
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-mist-100 truncate">{indicator.name}</p>
                <p className="text-[12px] text-mist-600">{indicator.slug} · {indicator.unit}</p>
                <p className="text-[12px] text-mist-500 mt-1">{indicator.description ?? 'Sem descrição'}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(indicator)}
                className="shrink-0 rounded-lg border border-ink-border bg-ink-800 hover:bg-ink-700 text-[12px] text-mist-200 px-3 py-2"
              >
                Adicionar dados
              </button>
            </div>
          ))}
        </div>
      </section>

      {selected && <AddDataModal indicator={selected} onClose={() => setSelected(null)} />}
    </StaffShell>
  )
}

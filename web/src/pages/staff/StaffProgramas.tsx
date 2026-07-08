import { useState } from 'react'
import StaffShell from '../../components/staff/StaffShell'
import {
  type Program,
  useCreatePrograma,
  useDeletePrograma,
  useStaffProgramas,
  useStaffRegions,
  useUpdatePrograma,
} from '../../hooks/useStaffApi'

const CATEGORIES = [
  'training',
  'employability',
  'structured_experiences',
  'mentorships',
  'mental_health',
]

type ProgramForm = {
  id?: string
  name: string
  description: string
  category: string
  regionId: string
  startDate: string
  endDate: string
  url: string
}

const emptyForm: ProgramForm = {
  name: '',
  description: '',
  category: 'training',
  regionId: '',
  startDate: '',
  endDate: '',
  url: '',
}

const toPayload = (form: ProgramForm) => ({
  name: form.name,
  description: form.description || undefined,
  category: form.category,
  regionId: form.regionId || undefined,
  startsAt: form.startDate ? new Date(`${form.startDate}T00:00:00.000Z`).toISOString() : undefined,
  endsAt: form.endDate ? new Date(`${form.endDate}T23:59:59.000Z`).toISOString() : undefined,
  url: form.url || '',
})

export default function StaffProgramas() {
  const { data: programs = [], isLoading } = useStaffProgramas()
  const { data: regions = [] } = useStaffRegions()
  const createProgram = useCreatePrograma()
  const updateProgram = useUpdatePrograma()
  const deleteProgram = useDeletePrograma()
  const [form, setForm] = useState<ProgramForm>(emptyForm)
  const [error, setError] = useState('')

  const isEditing = Boolean(form.id)

  async function handleSubmit() {
    setError('')
    try {
      if (form.id) {
        await updateProgram.mutateAsync({ id: form.id, ...toPayload(form) })
      } else {
        await createProgram.mutateAsync(toPayload(form))
      }
      setForm(emptyForm)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Não foi possível guardar o programa.')
    }
  }

  function startEdit(program: Program) {
    setForm({
      id: program.id,
      name: program.name,
      description: program.description ?? '',
      category: program.category,
      regionId: program.regionId ?? '',
      startDate: program.startsAt ? program.startsAt.slice(0, 10) : '',
      endDate: program.endsAt ? program.endsAt.slice(0, 10) : '',
      url: program.url ?? '',
    })
  }

  async function handleDelete(id: string) {
    setError('')
    try {
      await deleteProgram.mutateAsync(id)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Não foi possível apagar o programa.')
    }
  }

  return (
    <StaffShell title="Programas">
      <div className="bg-ink-900 rounded-2xl border border-ink-border-soft p-5 mb-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-[14px] font-medium text-mist-100">{isEditing ? 'Editar programa' : 'Criar programa'}</h2>
          {isEditing && (
            <button type="button" onClick={() => setForm(emptyForm)} className="text-[12px] text-mist-500 hover:text-mist-200">
              Cancelar edição
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="name"
            className="px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 outline-none focus:border-signal-500"
          />
          <select
            value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            className="px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 outline-none focus:border-signal-500"
          >
            {CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
          </select>
          <select
            value={form.regionId}
            onChange={e => setForm(f => ({ ...f, regionId: e.target.value }))}
            className="px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 outline-none focus:border-signal-500"
          >
            <option value="">regionId</option>
            {regions.map(region => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
          <input
            value={form.url}
            onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
            placeholder="url"
            className="px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 outline-none focus:border-signal-500"
          />
          <input
            type="date"
            value={form.startDate}
            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
            className="px-3.5 py-2.5 rounded-lg border border-ink-border bg-ink-850 text-[14px] text-mist-50 outline-none focus:border-signal-500"
          />
          <input
            type="date"
            value={form.endDate}
            onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
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
          onClick={handleSubmit}
          disabled={createProgram.isPending || updateProgram.isPending || !form.name || !form.category}
          className="rounded-lg bg-signal-500 hover:bg-signal-400 text-ink-950 text-[13px] font-medium px-4 py-2 disabled:bg-ink-border disabled:text-mist-600"
        >
          {createProgram.isPending || updateProgram.isPending ? 'A guardar…' : isEditing ? 'Guardar alterações' : 'Criar programa'}
        </button>
      </div>

      <section className="bg-ink-900 rounded-2xl border border-ink-border-soft overflow-hidden">
        {isLoading && <div className="px-5 py-6 text-[13px] text-mist-600">A carregar programas…</div>}
        {!isLoading && programs.length === 0 && <div className="px-5 py-6 text-[13px] text-mist-600">Nenhum programa registado.</div>}
        <div className="divide-y divide-ink-border-soft">
          {programs.map(program => (
            <div key={program.id} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-4 hover:bg-ink-850">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-mist-100 truncate">{program.name}</p>
                <p className="text-[12px] text-mist-600">{program.category}</p>
                <p className="text-[12px] text-mist-500 mt-1">{program.description ?? 'Sem descrição'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(program)}
                  className="rounded-lg border border-ink-border bg-ink-800 hover:bg-ink-700 text-[12px] text-mist-200 px-3 py-2"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(program.id)}
                  disabled={deleteProgram.isPending}
                  className="rounded-lg border border-status-bad/40 bg-status-bad-soft hover:bg-status-bad/20 text-[12px] text-status-bad px-3 py-2 disabled:opacity-60"
                >
                  Apagar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </StaffShell>
  )
}

import StaffShell from '../../components/staff/StaffShell'
import {
  useActivityLog,
  useStaffDataSources,
  useStaffIndicadores,
  useStaffMembers,
  useStaffProgramas,
  useStaffRegions,
} from '../../hooks/useStaffApi'

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-ink-900 rounded-2xl border border-ink-border-soft p-5">
      <p className="text-[11px] font-mono uppercase tracking-wider text-mist-600 mb-2">{label}</p>
      <p className="font-display text-[34px] leading-none text-mist-50">{value}</p>
    </div>
  )
}

export default function StaffDashboard() {
  const { data: regions = [] } = useStaffRegions()
  const { data: indicators = [] } = useStaffIndicadores()
  const { data: programs = [] } = useStaffProgramas()
  const { data: members = [] } = useStaffMembers()
  const { data: dataSources = [] } = useStaffDataSources()
  const { data: logs = [], isLoading } = useActivityLog()

  return (
    <StaffShell title="Dashboard Staff">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total regiões" value={regions.length} />
        <SummaryCard label="Total indicadores" value={indicators.length} />
        <SummaryCard label="Total programas" value={programs.length} />
        <SummaryCard label="Membros staff" value={members.length} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        <section className="bg-ink-900 rounded-2xl border border-ink-border-soft overflow-hidden">
          <div className="px-5 py-4 border-b border-ink-border-soft flex items-center justify-between">
            <h2 className="text-[14px] font-medium text-mist-100">Activity log recente</h2>
            <span className="text-[11px] font-mono text-mist-600">{logs.length} eventos</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-ink-border-soft">
                  <th className="px-5 py-3 text-[11px] font-mono uppercase tracking-wider text-mist-600">Ação</th>
                  <th className="px-5 py-3 text-[11px] font-mono uppercase tracking-wider text-mist-600">Entidade</th>
                  <th className="px-5 py-3 text-[11px] font-mono uppercase tracking-wider text-mist-600">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-border-soft">
                {isLoading && (
                  <tr>
                    <td colSpan={3} className="px-5 py-6 text-[13px] text-mist-600">A carregar logs…</td>
                  </tr>
                )}
                {!isLoading && logs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-6 text-[13px] text-mist-600">Sem atividade recente.</td>
                  </tr>
                )}
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-ink-850">
                    <td className="px-5 py-3 text-[13px] text-mist-100">{log.action}</td>
                    <td className="px-5 py-3 text-[13px] text-mist-400">{log.entityType}</td>
                    <td className="px-5 py-3 text-[12px] font-mono text-mist-600">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString('pt-AO') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="bg-ink-900 rounded-2xl border border-ink-border-soft p-5">
          <h2 className="text-[14px] font-medium text-mist-100 mb-4">Operação</h2>
          <div className="space-y-3">
            <div className="rounded-xl bg-ink-850 border border-ink-border-soft p-3">
              <p className="text-[11px] font-mono uppercase tracking-wider text-mist-600 mb-1">Data sources</p>
              <p className="text-[22px] font-display text-mist-50">{dataSources.length}</p>
            </div>
            <div className="rounded-xl bg-ink-850 border border-ink-border-soft p-3">
              <p className="text-[11px] font-mono uppercase tracking-wider text-mist-600 mb-1">Staff ativos</p>
              <p className="text-[22px] font-display text-mist-50">{members.filter(m => m.isActive).length}</p>
            </div>
          </div>
        </aside>
      </div>
    </StaffShell>
  )
}

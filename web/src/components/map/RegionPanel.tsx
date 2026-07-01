import { useNavigate } from 'react-router-dom'
import type { Regiao } from '../../types'
import { useAppStore } from '../../store'
import CoberturaTag from './CoberturaTag'
import CircularGauge from '../ui/CircularGauge'

const CATEGORIA_LABEL: Record<string, string> = {
  formacoes: 'Formações',
  empregabilidade: 'Empregabilidade',
  experiencias: 'Experiências',
  mentorias: 'Mentorias',
  saude_mental: 'Saúde Mental',
}

export default function RegionPanel({ regiao }: { regiao: Regiao }) {
  const { setConsultaAtual } = useAppStore()
  const navigate = useNavigate()

  function consultarRegiao() {
    setConsultaAtual(`Quais são os principais desafios de inclusão digital em ${regiao.nome}?`)
    navigate('/consulta')
  }

  return (
    <div className="w-80 shrink-0 border-l border-ink-border-soft bg-ink-900 flex flex-col overflow-y-auto">
      <div className="p-5 border-b border-ink-border-soft">
        <h2 className="font-display text-[19px] text-mist-50 leading-tight tracking-tight">{regiao.nome}</h2>
        <p className="text-[12px] text-mist-500 mt-0.5 font-mono">{regiao.municipio}, {regiao.estado}</p>
        <div className="mt-3">
          <CoberturaTag nivel={regiao.cobertura_nivel} />
        </div>
      </div>

      <div className="p-5 border-b border-ink-border-soft grid grid-cols-3 gap-2">
        <div className="bg-ink-850 rounded-xl border border-ink-border-soft p-2.5">
          <p className="text-[9.5px] font-mono uppercase text-mist-600 mb-1">Concentração</p>
          <p className="text-[13px] font-semibold text-mist-100 font-mono">{(regiao.concentracao / 1000).toFixed(0)}k</p>
        </div>
        <div className="bg-ink-850 rounded-xl border border-ink-border-soft p-2.5">
          <p className="text-[9.5px] font-mono uppercase text-mist-600 mb-1">Rede</p>
          <p className="text-[13px] font-semibold text-mist-100 font-mono">{Math.round(regiao.cobertura_rede * 100)}%</p>
        </div>
        <div className="bg-ink-850 rounded-xl border border-ink-border-soft p-2.5">
          <p className="text-[9.5px] font-mono uppercase text-mist-600 mb-1">Programas</p>
          <p className="text-[13px] font-semibold text-mist-100 font-mono">{regiao.programas_count}</p>
        </div>
      </div>

      <div className="p-5 flex-1">
        <p className="text-[10.5px] font-mono font-medium text-mist-600 uppercase tracking-wider mb-3">Indicadores</p>
        <div className="space-y-3">
          {regiao.indicadores.map(ind => (
            <div key={ind.slug} className="flex items-center justify-between bg-ink-850 rounded-xl border border-ink-border-soft px-3 py-2">
              <div className="min-w-0">
                <p className="text-[12px] text-mist-200 truncate">{CATEGORIA_LABEL[ind.categoria]}</p>
                <p className="text-[10px] text-mist-600 font-mono">{ind.unidade}</p>
              </div>
              <CircularGauge value={ind.valor} size={40} stroke={4} />
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-ink-border-soft">
        <button
          onClick={consultarRegiao}
          className="w-full py-2.5 px-3 rounded-xl bg-signal-500 text-ink-950 text-[13px] font-semibold hover:bg-signal-400 transition-colors"
        >
          Consultar sobre esta região ↗
        </button>
      </div>
    </div>
  )
}
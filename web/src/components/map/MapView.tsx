import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Regiao } from '../../types'
import { useAppStore } from '../../store'

function corPorNivel(nivel: Regiao['cobertura_nivel']) {
  return nivel === 'boa' ? '#36D399' : nivel === 'atencao' ? '#F5A742' : '#FB5B4B'
}

function valorIndicador(regiao: Regiao, slug: string): number {
  return regiao.indicadores.find(i => i.slug === slug)?.valor ?? 0
}

function raio(concentracao: number): number {
  return Math.max(12, Math.min(40, concentracao / 700))
}

export default function MapView({ regioes }: { regioes: Regiao[] }) {
  const { indicadorAtivo, filtroCobertura, setRegiaoSelecionada, regiaoSelecionada } = useAppStore()

  const filtradas = filtroCobertura === 'todas'
    ? regioes
    : regioes.filter(r => r.cobertura_nivel === filtroCobertura)

  return (
    <MapContainer
      center={[-23.55, -46.63]}
      zoom={11}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png"
      />
      {filtradas.map(r => {
        const selecionada = regiaoSelecionada?.id === r.id
        const cor = corPorNivel(r.cobertura_nivel)
        const val = valorIndicador(r, indicadorAtivo)
        return (
          <CircleMarker
            key={r.id}
            center={[r.lat, r.lng]}
            radius={raio(r.concentracao)}
            pathOptions={{
              color: selecionada ? '#6EF0D6' : cor,
              fillColor: cor,
              fillOpacity: selecionada ? 0.85 : 0.55,
              weight: selecionada ? 3 : 1.5,
            }}
            eventHandlers={{ click: () => setRegiaoSelecionada(r) }}
          >
            <Tooltip direction="top" offset={[0, -8]} permanent={false}>
              <div className="text-[12px] font-sans">
                <p className="font-semibold">{r.nome}</p>
                <p className="text-mist-400">{indicadorAtivo.replace(/-/g, ' ')}: <strong>{val}</strong></p>
                <p className="text-mist-400">Rede: {Math.round(r.cobertura_rede * 100)}%</p>
              </div>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
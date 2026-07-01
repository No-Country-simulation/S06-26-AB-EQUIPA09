import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Regiao } from '../../types'
import { useAppStore } from '../../store'

function corNivel(nivel: Regiao['cobertura_nivel']) {
  return nivel === 'boa' ? '#16a34a' : nivel === 'atencao' ? '#d97706' : '#CC0000'
}
function raio(concentracao: number) {
  return Math.max(14, Math.min(44, concentracao / 30000))
}
function valorIndicador(regiao: Regiao, slug: string) {
  return regiao.indicadores.find(i => i.slug === slug)?.valor ?? 0
}

export default function MapView({ regioes }: { regioes: Regiao[] }) {
  const { indicadorAtivo, filtroCobertura, setRegiaoSelecionada, regiaoSelecionada } = useAppStore()

  const filtradas = filtroCobertura === 'todas'
    ? regioes
    : regioes.filter(r => r.cobertura_nivel === filtroCobertura)

  return (
    <MapContainer center={[-8.84, 13.29]} zoom={11}
      style={{ height: '100%', width: '100%' }} zoomControl>
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        opacity={0.65}
      />
      {filtradas.map(r => {
        const ativo = regiaoSelecionada?.id === r.id
        const cor = corNivel(r.cobertura_nivel)
        const val = valorIndicador(r, indicadorAtivo)
        return (
          <CircleMarker key={r.id} center={[r.lat, r.lng]} radius={raio(r.concentracao)}
            pathOptions={{
              color: ativo ? '#0A0A0A' : cor,
              fillColor: cor, fillOpacity: ativo ? 0.92 : 0.7,
              weight: ativo ? 3 : 1.5,
            }}
            eventHandlers={{ click: () => setRegiaoSelecionada(r) }}>
            <Tooltip direction="top" offset={[0, -10]}>
              <div style={{ padding: '8px 12px', fontFamily: 'Inter, sans-serif' }}>
                <p style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{r.nome}</p>
                <p style={{ fontSize: '12px', color: '#666', margin: '2px 0' }}>
                  {indicadorAtivo.replace(/-/g, ' ')}: <strong>{val}</strong>
                </p>
                <p style={{ fontSize: '12px', color: '#666', margin: '2px 0' }}>
                  Rede: <strong>{Math.round(r.cobertura_rede * 100)}%</strong>
                </p>
                <p style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                  {r.concentracao.toLocaleString('pt-AO')} hab.
                </p>
              </div>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}

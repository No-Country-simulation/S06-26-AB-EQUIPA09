import { Link } from 'react-router-dom'

const workflow = [
  {
    label: '01',
    title: 'Carregar dados',
    text: 'A equipa staff envia os CSVs CVSS originais pela interface ou usa o mesmo pipeline pelo terminal.',
  },
  {
    label: '02',
    title: 'Transformar em território',
    text: 'O backend cria regiões, antenas, concentração populacional e cobertura mensal com rastreio das fontes.',
  },
  {
    label: '03',
    title: 'Decidir com evidência',
    text: 'Gestores consultam mapa, ranking de prioridade e perguntas em linguagem natural sobre os dados.',
  },
]

const metrics = [
  ['Regiões', '132'],
  ['Cobertura média', '74%'],
  ['Zonas críticas', '18'],
  ['Fontes CVSS', '7'],
]

function ProductScene() {
  return (
    <div className="relative min-h-[360px] lg:min-h-[520px] overflow-hidden border-y border-ink-border-soft bg-ink-950">
      <div className="absolute inset-0 opacity-70">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(63,220,190,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(63,220,190,0.08)_1px,transparent_1px)] bg-[size:44px_44px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_42%,rgba(63,220,190,0.14),transparent_34%),radial-gradient(circle_at_72%_65%,rgba(251,91,75,0.12),transparent_24%)]" />
      </div>

      <div className="absolute left-[8%] right-[8%] top-[16%] bottom-[12%] grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
        <div className="relative border border-ink-border bg-ink-900/90 rounded-lg overflow-hidden">
          <div className="h-10 border-b border-ink-border-soft flex items-center px-4 gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-status-bad" />
            <span className="w-2.5 h-2.5 rounded-full bg-status-warn" />
            <span className="w-2.5 h-2.5 rounded-full bg-status-good" />
            <span className="ml-auto font-mono text-[10px] text-mist-600">MAPA OPERACIONAL</span>
          </div>
          <div className="relative h-[calc(100%-2.5rem)]">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(17,23,35,0.95),rgba(8,11,17,0.96))]" />
            {[
              ['left-[18%]', 'top-[34%]', 'bg-status-good', 'w-4 h-4'],
              ['left-[34%]', 'top-[56%]', 'bg-status-warn', 'w-5 h-5'],
              ['left-[52%]', 'top-[42%]', 'bg-status-bad', 'w-6 h-6'],
              ['left-[66%]', 'top-[64%]', 'bg-status-warn', 'w-4 h-4'],
              ['left-[78%]', 'top-[30%]', 'bg-status-good', 'w-3.5 h-3.5'],
            ].map(([left, top, color, size]) => (
              <span
                key={`${left}-${top}`}
                className={`absolute ${left} ${top} ${size} ${color} rounded-full shadow-[0_0_22px_currentColor]`}
              />
            ))}
            <div className="absolute left-[47%] top-[38%] w-28 h-28 rounded-full border border-status-bad/40" />
            <div className="absolute left-[43%] top-[32%] w-44 h-44 rounded-full border border-status-bad/20" />
            <div className="absolute left-4 bottom-4 right-4 grid grid-cols-2 md:grid-cols-4 gap-2">
              {metrics.map(([label, value]) => (
                <div key={label} className="border border-ink-border-soft bg-ink-950/70 rounded-lg px-3 py-2">
                  <p className="font-mono text-[10px] text-mist-600">{label}</p>
                  <p className="font-display text-[24px] text-mist-50 leading-none">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden lg:grid grid-rows-[1fr_auto] gap-4">
          <div className="border border-ink-border bg-ink-900/90 rounded-lg p-5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-signal-500 mb-4">Prioridade de investimento</p>
            <div className="space-y-3">
              {['Centro', 'Benfica', 'Talatona', 'Cazenga'].map((name, index) => (
                <div key={name} className="grid grid-cols-[72px_1fr_36px] items-center gap-3">
                  <span className="text-[12px] text-mist-400">{name}</span>
                  <span className="h-2 rounded-full bg-ink-800 overflow-hidden">
                    <span
                      className="block h-full bg-signal-500"
                      style={{ width: `${88 - index * 13}%` }}
                    />
                  </span>
                  <span className="font-mono text-[11px] text-mist-200">{88 - index * 13}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border border-ink-border bg-ink-900/90 rounded-lg p-5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-status-warn mb-3">Consulta IA</p>
            <p className="text-[14px] text-mist-200 leading-relaxed">
              Quais regiões têm maior concentração de pessoas e menor cobertura de rede?
            </p>
            <p className="mt-4 text-[12px] text-mist-500 leading-relaxed">
              Resposta baseada em SQL read-only sobre tabelas permitidas, com dados e fontes de suporte.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Landing() {
  return (
    <main className="min-h-screen bg-ink-950 text-mist-50">
      <header className="fixed top-0 left-0 right-0 z-20 border-b border-ink-border-soft bg-ink-950/90 backdrop-blur">
        <div className="mx-auto max-w-7xl px-5 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-signal-500 text-ink-950 font-display font-bold text-[18px] flex items-center justify-center">
              S
            </span>
            <span>
              <span className="block font-display text-[20px] font-bold leading-none">SQLens</span>
              <span className="block font-mono text-[10px] uppercase tracking-wider text-mist-600 mt-1">Radar de inclusão digital</span>
            </span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link to="/staff/login" className="hidden sm:inline-flex text-[13px] text-mist-400 hover:text-mist-50">
              Staff
            </Link>
            <Link to="/login" className="rounded-lg bg-signal-500 hover:bg-signal-400 text-ink-950 text-[13px] font-medium px-4 py-2">
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      <section className="pt-28 lg:pt-32">
        <div className="mx-auto max-w-7xl px-5 grid grid-cols-1 lg:grid-cols-[0.92fr_1.08fr] gap-10 lg:gap-14 items-center pb-12">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-signal-500 mb-4">
              App BiT · Desafio B2G
            </p>
            <h1 className="font-display text-[44px] sm:text-[58px] lg:text-[72px] leading-[0.95] tracking-tight max-w-[760px]">
              SQLens
            </h1>
            <p className="mt-6 text-[18px] sm:text-[20px] leading-relaxed text-mist-200 max-w-[640px]">
              Um sistema de apoio à decisão pública que transforma CSVs técnicos de mobilidade e cobertura em mapa,
              ranking de prioridade e consultas em linguagem natural.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link to="/login" className="rounded-lg bg-signal-500 hover:bg-signal-400 text-ink-950 text-[14px] font-semibold px-5 py-3 text-center">
                Aceder ao sistema
              </Link>
              <Link to="/staff/login" className="rounded-lg border border-ink-border hover:border-mist-600 text-mist-200 text-[14px] font-medium px-5 py-3 text-center">
                Área staff
              </Link>
            </div>
          </div>

          <div className="border border-ink-border-soft rounded-lg overflow-hidden bg-ink-900">
            <ProductScene />
          </div>
        </div>
      </section>

      <section className="border-y border-ink-border-soft bg-ink-900">
        <div className="mx-auto max-w-7xl px-5 py-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map(([label, value]) => (
            <div key={label} className="py-2">
              <p className="font-display text-[38px] text-mist-50 leading-none">{value}</p>
              <p className="font-mono text-[11px] uppercase tracking-wider text-mist-600 mt-2">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-10">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-signal-500 mb-3">Como funciona</p>
            <h2 className="font-display text-[34px] sm:text-[42px] leading-tight tracking-tight">
              Do ficheiro bruto à decisão territorial.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {workflow.map(item => (
              <article key={item.label} className="rounded-lg border border-ink-border-soft bg-ink-900 p-5">
                <p className="font-mono text-[11px] text-signal-500 mb-5">{item.label}</p>
                <h3 className="text-[17px] font-semibold text-mist-50 mb-3">{item.title}</h3>
                <p className="text-[13px] leading-relaxed text-mist-400">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink-900 border-y border-ink-border-soft">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-signal-500 mb-3">Porque importa</p>
            <h2 className="font-display text-[34px] leading-tight tracking-tight">
              Menos tabelas soltas. Mais ação pública.
            </h2>
          </div>
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              ['Mapa operacional', 'Mostra onde há maior concentração populacional e onde a cobertura de rede precisa de atenção.'],
              ['Ranking explicável', 'Combina concentração, défice de cobertura e indicadores sociais para sugerir prioridade.'],
              ['Agente IA', 'Permite perguntar em português e receber respostas apoiadas em SQL read-only e dados rastreáveis.'],
              ['Upload simples', 'A equipa staff envia CSVs originais e o sistema executa o mesmo pipeline validado do backend.'],
            ].map(([title, text]) => (
              <article key={title} className="rounded-lg border border-ink-border-soft bg-ink-850 p-5">
                <h3 className="text-[17px] font-semibold text-mist-50 mb-3">{title}</h3>
                <p className="text-[13px] leading-relaxed text-mist-400">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 lg:py-20">
        <div className="rounded-lg border border-ink-border bg-ink-900 px-5 py-7 sm:px-8 sm:py-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-signal-500 mb-2">Pronto para demonstração</p>
            <h2 className="font-display text-[30px] sm:text-[38px] tracking-tight">Entrar no SQLens</h2>
            <p className="text-[14px] text-mist-400 mt-3 max-w-[680px]">
              Aceda como gestor para consultar o dashboard, ou como staff para carregar dados e gerir a operação.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/login" className="rounded-lg bg-signal-500 hover:bg-signal-400 text-ink-950 text-[14px] font-semibold px-5 py-3 text-center">
              Login gestor
            </Link>
            <Link to="/staff/login" className="rounded-lg border border-ink-border hover:border-mist-600 text-mist-200 text-[14px] font-medium px-5 py-3 text-center">
              Login staff
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

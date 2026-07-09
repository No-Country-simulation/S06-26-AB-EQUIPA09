import path from 'node:path'
import { db, closeDatabaseConnection } from '../src/db'
import { createDataSourceRepository } from '../src/modules/ingestion/infrastructure/persistence/data-source.repository'
import { createRegionRepository } from '../src/modules/regions/infrastructure/persistence/region.repository'
import { createCDRViewRecordRepository } from '../src/modules/ingestion/infrastructure/persistence/cdrview-record.repository'
import { createRegionCoverageRepository } from '../src/modules/coverage/infrastructure/persistence/region-coverage.repository'
import { createCvssIngestionService } from '../src/modules/ingestion/application/services/cvss-ingestion.service'

const CVSS_DIR = path.resolve(process.cwd(), process.argv[2] ?? '../cvss')

const dataSourceRepo = createDataSourceRepository(db)
const regionRepo = createRegionRepository(db)
const cdrviewRecordRepo = createCDRViewRecordRepository(db)
const regionCoverageRepo = createRegionCoverageRepository(db)
const cvssIngestionSvc = createCvssIngestionService(
  dataSourceRepo,
  regionRepo,
  cdrviewRecordRepo,
  regionCoverageRepo,
)

async function main() {
  console.log(`A ingerir CSVs de: ${CVSS_DIR}`)

  const result = await cvssIngestionSvc.ingestDirectory(CVSS_DIR)

  console.log(
    `  tensor_concentracao: ${result.recordsInserted} registros, ` +
    `${result.regionsUpserted} regioes distintas, ${result.stationsUpserted} estacoes, ` +
    `${result.coverageRowsUpserted} coberturas mensais`
  )
  console.log(`  fontes sem tabela dedicada registradas: ${result.registeredSources}`)
  console.log(`  ficheiros processados: ${result.filesProcessed.join(', ')}`)
  console.log('Ingestao CVSS concluida.')
}

main()
  .catch((error) => {
    console.error('Falha na ingestao CVSS:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await closeDatabaseConnection()
    process.exit(process.exitCode ?? 0)
  })

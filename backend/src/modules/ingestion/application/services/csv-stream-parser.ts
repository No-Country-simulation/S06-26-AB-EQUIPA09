export interface CSVRow {
  zoneId: string
  name: string
  municipality: string
  state: string
  country: string
  lat: number
  lng: number
  stationId: string
  technology: string
  carrier: string
  powerDbm: number | null
  period: string
  peopleCount: number
  networkTechnology: string
  signalStrength: number | null
  hourOfDay: number
  dayOfWeek: number
  estimatedPopulation: number | null
  areaKm2: number | null
}

const normalize = (headers: string[], values: string[]): Record<string, string> => {
  const row: Record<string, string> = {}
  headers.forEach((h, idx) => { row[h] = values[idx] ?? '' })
  return row
}

const parseLine = (line: string, headers: string[]): CSVRow | null => {
  const values = line.split(',').map(v => v.trim())
  if (values.length !== headers.length) return null

  const row = normalize(headers, values)
  const period = row.period
  const periodDate = new Date(period)
  if (isNaN(periodDate.getTime())) return null
  const hour = periodDate.getHours()
  const day = periodDate.getDay()

  return {
    zoneId: row.zone_id || row.zoneId || '',
    name: row.name || '',
    municipality: row.municipality || '',
    state: row.state || '',
    country: row.country || 'BR',
    lat: parseFloat(row.lat) || 0,
    lng: parseFloat(row.lng) || 0,
    stationId: row.station_id || row.stationId || '',
    technology: row.technology || '4G',
    carrier: row.carrier || '',
    powerDbm: row.power_dbm ? parseFloat(row.power_dbm) : null,
    period,
    peopleCount: parseInt(row.people_count || row.peopleCount || '0', 10),
    networkTechnology: row.network_technology || row.networkTechnology || 'unknown',
    signalStrength: row.signal_strength ? parseFloat(row.signal_strength) : null,
    hourOfDay: row.hour_of_day ? parseInt(row.hour_of_day, 10) : hour,
    dayOfWeek: row.day_of_week ? parseInt(row.day_of_week, 10) : day,
    estimatedPopulation: row.estimated_population ? parseInt(row.estimated_population, 10) : null,
    areaKm2: row.area_km2 ? parseFloat(row.area_km2) : null,
  }
}

export const parseCSVStream = (): TransformStream<Uint8Array, CSVRow> => {
  let headers: string[] = []
  let headersParsed = false
  let buffer = ''

  return new TransformStream({
    transform(chunk, controller) {
      buffer += new TextDecoder().decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!headersParsed) {
          headers = line.split(',').map(h => h.trim())
          headersParsed = true
          continue
        }
        const row = parseLine(line, headers)
        if (row) controller.enqueue(row)
      }
    },
    flush(controller) {
      if (!buffer || !headersParsed) return
      const row = parseLine(buffer, headers)
      if (row) controller.enqueue(row)
    },
  })
}

# Action Plan — BiT B2G

---

## Stack & Patterns

```
Framework:     Fastify + Node.js (TypeScript)
DB:            PostgreSQL + Drizzle ORM
Auth:          JWT + Argon2
Queue/Events:  BullMQ — async side effects only, never cross-module
Cross-module:  Direct Dependency Injection — module A interface passed to service B
Transactions:  withTransaction() in the service, all repository methods accept DbOrTx
Result:        Ok() / Err() / ErrorFactory throughout all business logic
NL-to-SQL:     Groq API (LLM) + SCHEMA_CONTEXT_FOR_AGENT prompt
Storage:       S3-compatible (CDRView dataset files, proof uploads)
Email:         Resend
```

---

## Folder Architecture

```
src/
├── db/
│   └── schema.ts                          ✅ done
├── shared/
│   ├── result/                            Ok() / Err() / ErrorFactory
│   ├── queue/                             BullMQ setup + worker base
│   ├── crypto/                            Argon2 + hash helpers
│   ├── audit/                             activity_log writer
│   ├── logger/                            structured logger (pino)
│   ├── auth/                              JWT sign/verify
│   └── storage/                           S3 client wrapper
├── plugins/
│   ├── auth.plugin.ts                     three paths: user | staff | optional
│   └── rate-limit.plugin.ts               per IP (fastify-rate-limit)
└── modules/
    ├── staff/                             ← Phase 0
    ├── users/                             ← Phase 1
    ├── auth/                              ← Phase 1
    ├── regions/                           ← Phase 2  (regions, base stations)
    ├── ingestion/                         ← Phase 2  (CDRView pipeline, data sources)
    ├── coverage/                          ← Phase 3  (region_coverage aggregates)
    ├── indicators/                        ← Phase 3  (indicators, indicator_data)
    ├── programs/                          ← Phase 4  (public programs by region)
    ├── alerts/                            ← Phase 4  (alert configs, alert logs)
    ├── agent/                             ← Phase 5  (NL-to-SQL via Groq)
    ├── notifications/                     ← Phase 5
    └── events/                            ← Phase 6  (observability layer)
```

---

## Cross-Module Dependency Map (DI)

```
staff
  └── (no external dependencies)

users
  └── (no external dependencies)

auth
  ├── IUserRepository          (user login/register)
  └── IStaffRepository         (staff dashboard login)

regions
  └── (no external dependencies)

ingestion
  ├── IRegionRepository        (upsert regions and base stations from CDRView)
  └── IDataSourceRepository    (update lastIngestedAt after successful pipeline run)

coverage
  └── IRegionRepository        (resolve region_id when computing aggregates)

indicators
  └── IDataSourceRepository    (link indicator to its source on create)

programs
  └── IRegionRepository        (resolve region_id on create/update)

alerts
  ├── IIndicatorRepository     (validate indicator exists)
  ├── IRegionRepository        (validate region exists, nullable)
  └── IIndicatorDataRepository (fetch normalized_value when checking threshold)

agent
  ├── IQueryLogRepository      (persist every NL-to-SQL query + result)
  └── IUserRepository          (attach userId to log when authenticated)

notifications
  └── (no business dependencies — Resend only)

events (workers)
  └── (write to activity_log only — no business DI)
```

---

## Transaction Map

| Service | Method | Tables | Reason |
|---|---|---|---|
| `authService` | `register` | `users` + `sessions` | User never exists without an initial session |
| `authService` | `login` | `users` (read) + `sessions` | Session created atomically on login |
| `ingestionService` | `runCDRViewPipeline` | `regions` + `base_stations` + `cdrview_records` + `data_sources` | Full atomic ingestion run — partial state must never persist |
| `coverageService` | `recomputeRegion` | `region_coverage` | Upsert aggregate — idempotent but must be atomic per region+period |
| `indicatorService` | `upsertData` | `indicator_data` | Upsert by (region_id, indicator_id, period) — concurrent safe |
| `alertService` | `createConfig` | `alert_configs` + `activity_log` | Config created and audited together |
| `alertService` | `checkAndFire` | `alert_logs` + `notifications` | Alert record and notification written together or not at all |
| `agentService` | `query` | `query_logs` | Single insert — no transaction needed, but isolated write |

---

## PHASE 0 — Staff

> First thing to exist. Staff manages the platform, approves data sources, and monitors the agent.
> Without staff, nothing else works operationally.

### Module · `staff`

**DTOs:**
```ts
CreateStaffDTO {
  email: string
  name: string
  password: string
}

StaffResponseDTO {
  id: string
  email: string
  name: string
  isActive: boolean
  lastLoginAt: Date | null
  createdAt: Date
}

StaffLoginDTO {
  email: string
  password: string
}

StaffLoginResponseDTO {
  token: string
  refreshToken: string
  staff: StaffResponseDTO
}
```

**Interface `IStaffRepository`:**
```ts
create(data: CreateStaffDTO & { emailHash: string, passwordHash: string }, db?: DbOrTx): Promise<StaffResponseDTO>
findById(id: string): Promise<StaffResponseDTO | null>
findByEmailHash(emailHash: string): Promise<(StaffResponseDTO & { passwordHash: string }) | null>
findAll(filters?: { isActive?: boolean }): Promise<StaffResponseDTO[]>
update(id: string, data: Partial<{ name: string, isActive: boolean }>, db?: DbOrTx): Promise<StaffResponseDTO>
updateLastLogin(id: string, db?: DbOrTx): Promise<void>
```

**Interface `IStaffService`:**
```ts
create(data: CreateStaffDTO): Promise<Result<StaffResponseDTO, AppError>>
findAll(): Promise<Result<StaffResponseDTO[], AppError>>
deactivate(staffId: string, requestingStaffId: string): Promise<Result<void, AppError>>
```

**Business rules:**
- Staff cannot deactivate themselves
- Mandatory seed: 1 staff on bootstrap via env vars — if none exist in the DB, auto-create
- No soft delete for staff — only `isActive = false`
- All platform actions are recorded in `activity_log`

**Transactions:** `create` — simple operation, no transaction

**Events:**
```ts
'staff.created': { staffId, createdBy }
'staff.login': { staffId, ipAddress }
'staff.action': { staffId, action, entityType, entityId }
```

**Controller — all routes require staff token:**
```
POST   /staff/auth/login
POST   /staff/auth/refresh
POST   /staff/auth/logout

GET    /staff/members                                  — list staff
POST   /staff/members                                  — create staff
PATCH  /staff/members/:id/deactivate                   — deactivate

GET    /staff/data-sources                             — list data sources
POST   /staff/data-sources                             — register new source
PATCH  /staff/data-sources/:id                         — update source metadata
POST   /staff/data-sources/:id/trigger                 — manually trigger ingestion

GET    /staff/query-logs                               — NL-to-SQL audit log (filters: userId, from, to, error)
GET    /staff/query-logs/:id                           — detail (query, generated SQL, AI response)

GET    /staff/activity-log                             — filters: actorType, action, entityType, from, to
GET    /staff/metrics                                  — regions ingested, indicators active, queries today, alerts fired
```

---

## PHASE 1 — Users & Auth

> Public managers (gestores) who consult the dashboard, configure alerts, and query the agent.
> Single auth channel: email + password (no OAuth for this product).

### Module · `users`

**DTOs:**
```ts
UserResponseDTO {
  id: string
  email: string
  name: string
  phone: string | null
  avatar: string | null
  locale: string
  status: string
  createdAt: Date
}

UpdateProfileDTO {
  name?: string
  phone?: string
  locale?: string
  avatar?: string
}
```

**Interface `IUserRepository`:**
```ts
create(data: {
  email: string
  emailHash: string
  passwordHash: string
  name: string
  phone?: string
  locale?: string
}, db?: DbOrTx): Promise<UserResponseDTO>

findById(id: string): Promise<UserResponseDTO | null>
findByEmailHash(emailHash: string): Promise<(UserResponseDTO & { passwordHash: string }) | null>
update(id: string, data: Partial<UpdateProfileDTO & { status?: string }>, db?: DbOrTx): Promise<UserResponseDTO>
softDelete(id: string, db?: DbOrTx): Promise<void>
```

**Interface `IUserService`:**
```ts
getById(userId: string): Promise<Result<UserResponseDTO, AppError>>
updateProfile(userId: string, data: UpdateProfileDTO): Promise<Result<UserResponseDTO, AppError>>
```

**Business rules:**
- `status` defaults to `active` on create
- Soft delete does not erase data — only marks `deletedAt`
- Suspended users cannot login — `authService.login` checks `status !== 'active'`

**Transactions:** `create` — simple, no transaction

**Events:**
```ts
'user.registered': { userId }
'user.login': { userId, ipAddress }
'user.profile_updated': { userId, changes }
```

**Controller:**
```
GET    /users/me              — authenticated user profile
PATCH  /users/me              — update profile
DELETE /users/me              — soft delete
```

---

### Module · `auth`

> Centralises all authentication flows: public managers and staff dashboard.

**DTOs:**
```ts
RegisterDTO { email: string, password: string, name: string, phone?: string }
LoginDTO { email: string, password: string }
AuthResponseDTO { token: string, refreshToken: string, user: UserResponseDTO }

StaffLoginDTO { email: string, password: string }
StaffAuthResponseDTO { token: string, refreshToken: string, staff: StaffResponseDTO }

RefreshTokenDTO { refreshToken: string }
```

**Interface `IAuthService`:**
```ts
// User (public manager)
register(data: RegisterDTO): Promise<Result<AuthResponseDTO, AppError>>
login(data: LoginDTO): Promise<Result<AuthResponseDTO, AppError>>
refreshToken(refreshToken: string): Promise<Result<AuthResponseDTO, AppError>>
revokeSession(token: string): Promise<Result<void, AppError>>

// Staff
loginStaff(data: StaffLoginDTO): Promise<Result<StaffAuthResponseDTO, AppError>>
refreshStaffToken(refreshToken: string): Promise<Result<StaffAuthResponseDTO, AppError>>
```

**Business rules:**

`register`:
- Hash email → `findByEmailHash` lookup → `Err conflict` if already exists
- Hash password (argon2)
- `withTransaction`: `users.create` + `sessions.create`
- Emit `'user.registered'`

`login`:
- Lookup via `emailHash` in `users`
- Verify argon2 password
- Verify `user.status === 'active'` → `Err unauthorized` if suspended
- Insert session
- Emit `'user.login'`

`loginStaff`:
- Lookup via `emailHash` in `staff_users`
- Verify argon2 password
- Verify `staff.isActive === true` → `Err unauthorized` if not
- Insert session
- Emit `'staff.login'`

**Transactions:**
- `register` → `withTransaction`: `users.create` + `sessions.create`
- `login` / `loginStaff` → session insert only, no transaction needed

**Controller:**
```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout

POST   /staff/auth/login
POST   /staff/auth/refresh
POST   /staff/auth/logout
```

---

## PHASE 2 — Regions & Ingestion

> The geographic backbone. Regions and base stations come from the CDRView dataset.
> Data sources are registered by staff and consumed by the ingestion pipeline.

### Module · `regions`

**DTOs:**
```ts
RegionResponseDTO {
  id: string
  zoneId: string
  name: string
  municipality: string
  state: string
  country: string
  lat: number
  lng: number
  estimatedPopulation: number | null
  areaKm2: number | null
  createdAt: Date
}

BaseStationResponseDTO {
  id: string
  stationId: string
  regionId: string
  technology: '2G' | '3G' | '4G' | '5G'
  carrier: string | null
  lat: number
  lng: number
  powerDbm: number | null
  isActive: boolean
}

RegionFiltersDTO {
  state?: string
  municipality?: string
  country?: string
  page?: number
  pageSize?: number
}
```

**Interface `IRegionRepository`:**
```ts
upsertRegion(data: Omit<RegionResponseDTO, 'id' | 'createdAt'>, db?: DbOrTx): Promise<RegionResponseDTO>
findById(id: string): Promise<RegionResponseDTO | null>
findByZoneId(zoneId: string): Promise<RegionResponseDTO | null>
findAll(filters?: RegionFiltersDTO): Promise<{ data: RegionResponseDTO[], total: number }>
listStates(country?: string): Promise<string[]>
listMunicipalities(state: string): Promise<string[]>

upsertBaseStation(data: Omit<BaseStationResponseDTO, 'id'>, db?: DbOrTx): Promise<BaseStationResponseDTO>
findStationsByRegion(regionId: string, filters?: { technology?: string, isActive?: boolean }): Promise<BaseStationResponseDTO[]>
```

**Interface `IRegionService`:**
```ts
getRegion(regionId: string): Promise<Result<RegionResponseDTO, AppError>>
listRegions(filters?: RegionFiltersDTO): Promise<Result<{ data: RegionResponseDTO[], total: number }, AppError>>
listStates(): Promise<Result<string[], AppError>>
listMunicipalities(state: string): Promise<Result<string[], AppError>>
getBaseStations(regionId: string, filters?: { technology?: string }): Promise<Result<BaseStationResponseDTO[], AppError>>
```

**Business rules:**
- `upsertRegion` uses `zone_id` as the natural key — idempotent, safe to call on every pipeline run
- `upsertBaseStation` uses `station_id` as the natural key — same pattern
- Regions are never deleted — they are the stable anchor for all other data

**Controller — authenticated user:**
```
GET    /regions                                        — list (filters: state, municipality, country)
GET    /regions/:id                                    — detail
GET    /regions/:id/stations                           — base stations (filters: technology)
GET    /regions/meta/states                            — distinct states
GET    /regions/meta/municipalities?state=X            — distinct municipalities for a state
```

---

### Module · `ingestion`

> Orchestrates the full CDRView pipeline: parse → normalise → upsert → aggregate.
> Also manages data_sources registration and last ingestion tracking.

**DTOs:**
```ts
DataSourceResponseDTO {
  id: string
  slug: string
  name: string
  description: string | null
  url: string | null
  type: 'csv' | 'api' | 'scraping' | 'manual'
  country: string
  isActive: boolean
  lastIngestedAt: Date | null
  createdAt: Date
}

CreateDataSourceDTO {
  slug: string
  name: string
  description?: string
  url?: string
  type: 'csv' | 'api' | 'scraping' | 'manual'
  country: string
}

CDRViewRowDTO {
  zoneId: string
  zoneName: string
  municipality: string
  state: string
  lat: number
  lng: number
  stationId: string
  technology: string
  carrier?: string
  powerDbm?: number
  period: string          // ISO timestamp string
  peopleCount: number
  signalStrength: number  // raw 0.0–1.0
}

IngestionResultDTO {
  sourceId: string
  rowsProcessed: number
  regionsUpserted: number
  stationsUpserted: number
  recordsInserted: number
  durationMs: number
  errors: string[]
}
```

**Interface `IDataSourceRepository`:**
```ts
create(data: CreateDataSourceDTO, db?: DbOrTx): Promise<DataSourceResponseDTO>
findById(id: string): Promise<DataSourceResponseDTO | null>
findBySlug(slug: string): Promise<DataSourceResponseDTO | null>
findAll(filters?: { isActive?: boolean, country?: string }): Promise<DataSourceResponseDTO[]>
update(id: string, data: Partial<CreateDataSourceDTO & { isActive?: boolean, lastIngestedAt?: Date }>, db?: DbOrTx): Promise<DataSourceResponseDTO>
```

**Interface `ICDRViewRecordRepository`:**
```ts
bulkInsert(records: Omit<CdrviewRecord, 'id' | 'createdAt'>[], db?: DbOrTx): Promise<number>
findByRegion(regionId: string, filters?: {
  from?: Date
  to?: Date
  hourOfDay?: number
  dayOfWeek?: number
  networkTechnology?: string
  page?: number
  pageSize?: number
}): Promise<{ data: CdrviewRecord[], total: number }>
countByRegionAndPeriod(regionId: string, period: string): Promise<number>
```

**Interface `IIngestionService`:**
```ts
registerDataSource(data: CreateDataSourceDTO, staffId: string): Promise<Result<DataSourceResponseDTO, AppError>>
updateDataSource(sourceId: string, data: Partial<CreateDataSourceDTO & { isActive?: boolean }>, staffId: string): Promise<Result<DataSourceResponseDTO, AppError>>
listDataSources(filters?: { isActive?: boolean }): Promise<Result<DataSourceResponseDTO[], AppError>>

runCDRViewPipeline(sourceId: string, filePathOrUrl: string, staffId?: string): Promise<Result<IngestionResultDTO, AppError>>
getRecordsByRegion(regionId: string, filters?: object): Promise<Result<{ data: CdrviewRecord[], total: number }, AppError>>
```

**Business rules:**

`runCDRViewPipeline`:
- Parse CSV/API payload into `CDRViewRowDTO[]` — skip malformed rows, collect in `errors[]`
- For each row:
  1. `regions.upsertRegion` → get `regionId`
  2. `baseStations.upsertBaseStation` → get `stationId`
  3. Extract `hourOfDay` and `dayOfWeek` from `period` timestamp
  4. Normalise `signalStrength` if not already in 0.0–1.0 range
- `withTransaction`: bulk upsert regions + stations + bulk insert `cdrview_records`
- After transaction: update `data_sources.lastIngestedAt = now()`
- After commit: enqueue `recompute-coverage` BullMQ job for each distinct `(regionId, period)` touched
- Emit `'ingestion.completed'` with result summary
- Records in `cdrview_records` are **immutable** — never update, never delete

**Transactions:**
- `runCDRViewPipeline` → `withTransaction`: `regions[]` + `base_stations[]` + `cdrview_records[]` bulk + `data_sources` update

**BullMQ Jobs:**
- `recompute-coverage` — triggered after each pipeline run for each touched `(regionId, period)`

**Events:**
```ts
'ingestion.completed': { sourceId, rowsProcessed, regionsUpserted, stationsUpserted, recordsInserted, durationMs }
'ingestion.failed': { sourceId, error }
```

**Controller — staff only:**
```
GET    /staff/data-sources                             — list all sources
POST   /staff/data-sources                             — register source
PATCH  /staff/data-sources/:id                         — update metadata / toggle active
POST   /staff/data-sources/:id/trigger                 — trigger pipeline (body: { fileUrl? })
GET    /staff/data-sources/:id/records                 — raw CDRView records (filters: regionId, from, to)
```

---

## PHASE 3 — Coverage & Indicators

> Computed aggregates from raw CDRView data. The dashboard's core read layer.

### Module · `coverage`

> Aggregates from `cdrview_records` into `region_coverage`. Triggered by ingestion, never called directly by users.

**DTOs:**
```ts
RegionCoverageResponseDTO {
  id: string
  regionId: string
  period: string
  networkCoverageScore: number
  maxConcentration: number
  minConcentration: number
  avgDaytimeConcentration: number | null
  avgNighttimeConcentration: number | null
  dominantTechnology: string | null
  no4gOr5gCoverage: boolean
  totalRecords: number
  updatedAt: Date
}

CoverageFiltersDTO {
  period?: string
  no4gOr5gCoverage?: boolean
  minScore?: number
  maxScore?: number
  page?: number
  pageSize?: number
}
```

**Interface `IRegionCoverageRepository`:**
```ts
upsert(data: Omit<RegionCoverageResponseDTO, 'id' | 'updatedAt'>, db?: DbOrTx): Promise<RegionCoverageResponseDTO>
findByRegionAndPeriod(regionId: string, period: string): Promise<RegionCoverageResponseDTO | null>
findByRegion(regionId: string): Promise<RegionCoverageResponseDTO[]>
findAll(filters?: CoverageFiltersDTO): Promise<{ data: RegionCoverageResponseDTO[], total: number }>
findCriticalZones(period: string): Promise<(RegionCoverageResponseDTO & { region: RegionResponseDTO })[]>
```

**Interface `ICoverageService`:**
```ts
recomputeRegion(regionId: string, period: string): Promise<Result<RegionCoverageResponseDTO, AppError>>
getCoverage(regionId: string, period: string): Promise<Result<RegionCoverageResponseDTO, AppError>>
listCoverage(filters?: CoverageFiltersDTO): Promise<Result<{ data: RegionCoverageResponseDTO[], total: number }, AppError>>
getCriticalZones(period: string): Promise<Result<(RegionCoverageResponseDTO & { region: RegionResponseDTO })[], AppError>>
```

**Business rules:**

`recomputeRegion`:
- Pull all `cdrview_records` for `(regionId, period)` (period matched via timestamp prefix)
- Compute aggregates:
  - `networkCoverageScore` = weighted average of `signalStrength` weighted by technology tier (5G=1.0, 4G=0.8, 3G=0.5, 2G=0.2)
  - `maxConcentration`, `minConcentration` = plain min/max of `peopleCount`
  - `avgDaytimeConcentration` = avg `peopleCount` WHERE `hourOfDay BETWEEN 8 AND 18`
  - `avgNighttimeConcentration` = avg `peopleCount` WHERE outside daytime window
  - `dominantTechnology` = mode of `networkTechnology` across records
  - `no4gOr5gCoverage` = `true` if no record has `networkTechnology IN ('4G','5G')`
- Upsert into `region_coverage` by `(regionId, period)` — idempotent
- After upsert: check all active `alert_configs` for this indicator/region and fire if threshold crossed

**Transactions:**
- `recomputeRegion` → upsert is a single atomic operation, no additional transaction

**BullMQ Workers:**
- `recompute-coverage` — concurrency 3, processes `{ regionId, period }` payloads from ingestion

**Controller — authenticated user:**
```
GET    /coverage                                       — all regions coverage (filters: period, no4gOr5gCoverage, minScore)
GET    /coverage/:regionId                             — all periods for a region
GET    /coverage/:regionId/:period                     — specific period detail
GET    /coverage/critical?period=2024                  — zones with no 4G/5G coverage
```

---

### Module · `indicators`

**DTOs:**
```ts
IndicatorResponseDTO {
  id: string
  slug: string
  name: string
  description: string | null
  category: 'training' | 'employability' | 'structured_experiences' | 'mentorships' | 'mental_health'
  unit: string
  direction: 'higher_is_better' | 'lower_is_better'
  criticalThresholds: { critical?: number, warning?: number }
  sourceId: string | null
  isActive: boolean
  createdAt: Date
}

CreateIndicatorDTO {
  slug: string
  name: string
  description?: string
  category: string
  unit: string
  direction?: 'higher_is_better' | 'lower_is_better'
  criticalThresholds?: { critical?: number, warning?: number }
  sourceId?: string
}

IndicatorDataResponseDTO {
  id: string
  regionId: string
  indicatorId: string
  sourceId: string | null
  period: string
  value: number
  normalizedValue: number | null
  quality: 'official' | 'estimated' | 'modelled'
  notes: string | null
  updatedAt: Date
}

UpsertIndicatorDataDTO {
  regionId: string
  indicatorId: string
  sourceId?: string
  period: string
  value: number
  normalizedValue?: number
  quality?: 'official' | 'estimated' | 'modelled'
  notes?: string
}

IndicatorDataFiltersDTO {
  indicatorId?: string
  regionId?: string
  period?: string
  category?: string
  quality?: string
  minNormalizedValue?: number
  maxNormalizedValue?: number
  page?: number
  pageSize?: number
}
```

**Interface `IIndicatorRepository`:**
```ts
create(data: CreateIndicatorDTO, db?: DbOrTx): Promise<IndicatorResponseDTO>
findById(id: string): Promise<IndicatorResponseDTO | null>
findBySlug(slug: string): Promise<IndicatorResponseDTO | null>
findAll(filters?: { category?: string, isActive?: boolean }): Promise<IndicatorResponseDTO[]>
update(id: string, data: Partial<CreateIndicatorDTO & { isActive?: boolean }>, db?: DbOrTx): Promise<IndicatorResponseDTO>
```

**Interface `IIndicatorDataRepository`:**
```ts
upsert(data: UpsertIndicatorDataDTO, db?: DbOrTx): Promise<IndicatorDataResponseDTO>
findByKey(regionId: string, indicatorId: string, period: string): Promise<IndicatorDataResponseDTO | null>
findAll(filters?: IndicatorDataFiltersDTO): Promise<{ data: IndicatorDataResponseDTO[], total: number }>
findByRegion(regionId: string, filters?: { period?: string, category?: string }): Promise<IndicatorDataResponseDTO[]>
findCritical(period: string, threshold?: number): Promise<(IndicatorDataResponseDTO & { indicator: IndicatorResponseDTO, region: RegionResponseDTO })[]>
```

**Interface `IIndicatorService`:**
```ts
// Indicators catalog (staff managed)
createIndicator(data: CreateIndicatorDTO, staffId: string): Promise<Result<IndicatorResponseDTO, AppError>>
updateIndicator(id: string, data: Partial<CreateIndicatorDTO & { isActive?: boolean }>, staffId: string): Promise<Result<IndicatorResponseDTO, AppError>>
listIndicators(filters?: { category?: string }): Promise<Result<IndicatorResponseDTO[], AppError>>

// Indicator data
upsertData(data: UpsertIndicatorDataDTO, staffId?: string): Promise<Result<IndicatorDataResponseDTO, AppError>>
listData(filters?: IndicatorDataFiltersDTO): Promise<Result<{ data: IndicatorDataResponseDTO[], total: number }, AppError>>
getDataByRegion(regionId: string, filters?: { period?: string, category?: string }): Promise<Result<IndicatorDataResponseDTO[], AppError>>
getCritical(period: string): Promise<Result<(IndicatorDataResponseDTO & { indicator: IndicatorResponseDTO, region: RegionResponseDTO })[], AppError>>
```

**Business rules:**
- Indicators catalog is staff-managed — public managers read only
- `upsertData` uses unique constraint on `(region_id, indicator_id, period)` — safe to call multiple times for same key
- If `normalizedValue` is not provided, the service computes it: normalise `value` against the min/max of all values for that indicator across all regions in the same period
- After `upsertData`: trigger alert check for all active `alert_configs` matching this `(indicatorId, regionId)`
- Seed: 5 indicators seeded on bootstrap via `seed.ts` — slugs are stable constants, referenced by agent prompt

**Transactions:**
- `upsertData` → single atomic upsert, no additional transaction needed

**Events:**
```ts
'indicator.data_upserted': { indicatorId, regionId, period, value, normalizedValue }
'indicator.critical': { indicatorId, regionId, period, normalizedValue, threshold }
```

**Controller — staff (catalog management):**
```
GET    /staff/indicators                               — list all
POST   /staff/indicators                               — create
PATCH  /staff/indicators/:id                           — update / deactivate
POST   /staff/indicators/:id/data                      — manually upsert a data point
```

**Controller — authenticated user (read):**
```
GET    /indicators                                     — list active (filters: category)
GET    /indicators/:id                                 — detail + thresholds
GET    /indicators/data                                — filter by region, period, category
GET    /indicators/data/critical?period=2024           — below critical threshold
GET    /regions/:id/indicators?period=2024             — all indicator values for a region
```

---

## PHASE 4 — Programs & Alerts

### Module · `programs`

> Public programs mapped by region. Staff-managed catalog, read by all authenticated users.

**DTOs:**
```ts
ProgramResponseDTO {
  id: string
  regionId: string | null
  name: string
  description: string | null
  category: 'training' | 'employability' | 'structured_experiences' | 'mentorships' | 'mental_health'
  organization: string | null
  municipality: string | null
  state: string | null
  url: string | null
  isActive: boolean
  startsAt: Date | null
  endsAt: Date | null
  metadata: Record<string, unknown>
  createdAt: Date
}

CreateProgramDTO {
  regionId?: string
  name: string
  description?: string
  category: string
  organization?: string
  municipality?: string
  state?: string
  url?: string
  startsAt?: Date
  endsAt?: Date
  metadata?: Record<string, unknown>
}

ProgramFiltersDTO {
  regionId?: string
  category?: string
  state?: string
  municipality?: string
  isActive?: boolean
  page?: number
  pageSize?: number
}
```

**Interface `IProgramRepository`:**
```ts
create(data: CreateProgramDTO, db?: DbOrTx): Promise<ProgramResponseDTO>
findById(id: string): Promise<ProgramResponseDTO | null>
findAll(filters?: ProgramFiltersDTO): Promise<{ data: ProgramResponseDTO[], total: number }>
update(id: string, data: Partial<CreateProgramDTO & { isActive?: boolean }>, db?: DbOrTx): Promise<ProgramResponseDTO>
softDelete(id: string, db?: DbOrTx): Promise<void>
```

**Interface `IProgramService`:**
```ts
create(data: CreateProgramDTO, staffId: string): Promise<Result<ProgramResponseDTO, AppError>>
update(programId: string, data: Partial<CreateProgramDTO & { isActive?: boolean }>, staffId: string): Promise<Result<ProgramResponseDTO, AppError>>
delete(programId: string, staffId: string): Promise<Result<void, AppError>>
list(filters?: ProgramFiltersDTO): Promise<Result<{ data: ProgramResponseDTO[], total: number }, AppError>>
getByRegion(regionId: string, filters?: { category?: string, isActive?: boolean }): Promise<Result<ProgramResponseDTO[], AppError>>
```

**Business rules:**
- `regionId` is nullable — some programs are state-wide or national
- Soft delete only — data is kept for historical audit
- Filters `state` and `municipality` are standalone fields to allow filtering programs without a `regionId`
- `category` values mirror the `indicators.category` enum — frontend can cross-reference programs with their corresponding indicator

**Transactions:** `create` and `update` — simple operations, no transactions needed

**Events:**
```ts
'program.created': { programId, category, regionId }
'program.updated': { programId, changes }
'program.deleted': { programId }
```

**Controller — staff:**
```
POST   /staff/programs                                 — create
PATCH  /staff/programs/:id                             — update
DELETE /staff/programs/:id                             — soft delete
```

**Controller — authenticated user:**
```
GET    /programs                                       — list (filters: region, category, state, isActive)
GET    /programs/:id                                   — detail
GET    /regions/:id/programs                           — programs for a specific region
```

---

### Module · `alerts`

> Per-user threshold configurations and immutable log of fired alerts.

**DTOs:**
```ts
AlertConfigResponseDTO {
  id: string
  userId: string
  indicatorId: string
  indicator: IndicatorResponseDTO
  regionId: string | null
  region: RegionResponseDTO | null
  criticalThreshold: number
  isActive: boolean
  channel: 'email' | 'in_app'
  lastCheckedAt: Date | null
  createdAt: Date
}

CreateAlertConfigDTO {
  indicatorId: string
  regionId?: string
  criticalThreshold: number
  channel?: 'email' | 'in_app'
}

AlertLogResponseDTO {
  id: string
  configId: string
  regionId: string
  region: RegionResponseDTO
  indicatorId: string
  indicator: IndicatorResponseDTO
  currentValue: number
  criticalThreshold: number
  period: string
  sentAt: Date
  channel: string
}
```

**Interface `IAlertConfigRepository`:**
```ts
create(data: CreateAlertConfigDTO & { userId: string }, db?: DbOrTx): Promise<AlertConfigResponseDTO>
findById(id: string): Promise<AlertConfigResponseDTO | null>
findByUser(userId: string, filters?: { isActive?: boolean }): Promise<AlertConfigResponseDTO[]>
findActiveByIndicator(indicatorId: string, regionId?: string): Promise<AlertConfigResponseDTO[]>
update(id: string, data: Partial<CreateAlertConfigDTO & { isActive?: boolean, lastCheckedAt?: Date }>, db?: DbOrTx): Promise<AlertConfigResponseDTO>
delete(id: string, db?: DbOrTx): Promise<void>
```

**Interface `IAlertLogRepository`:**
```ts
create(data: Omit<AlertLogResponseDTO, 'id' | 'region' | 'indicator'>, db?: DbOrTx): Promise<AlertLogResponseDTO>
findByUser(userId: string, filters?: { from?: Date, to?: Date, page?: number, pageSize?: number }): Promise<{ data: AlertLogResponseDTO[], total: number }>
findByConfig(configId: string): Promise<AlertLogResponseDTO[]>
```

**Interface `IAlertService`:**
```ts
createConfig(data: CreateAlertConfigDTO, userId: string): Promise<Result<AlertConfigResponseDTO, AppError>>
updateConfig(configId: string, data: Partial<CreateAlertConfigDTO & { isActive?: boolean }>, userId: string): Promise<Result<AlertConfigResponseDTO, AppError>>
deleteConfig(configId: string, userId: string): Promise<Result<void, AppError>>
listMyConfigs(userId: string): Promise<Result<AlertConfigResponseDTO[], AppError>>

checkAndFire(indicatorId: string, regionId: string, period: string, normalizedValue: number): Promise<void>

listMyAlertLogs(userId: string, filters?: { from?: Date, to?: Date }): Promise<Result<{ data: AlertLogResponseDTO[], total: number }, AppError>>
```

**Business rules:**

`createConfig`:
- Validate `indicatorId` exists → `Err not found`
- Validate `regionId` exists if provided → `Err not found`
- `criticalThreshold` must be in range 0.0–1.0 — it matches the `normalized_value` scale
- `withTransaction`: `alert_configs.create` + `activity_log.write`
- One user can have multiple configs for the same indicator but different regions

`checkAndFire` (called by `coverageService.recomputeRegion` and `indicatorService.upsertData`):
- Fetch all `alert_configs` WHERE `indicatorId = ? AND (regionId = ? OR regionId IS NULL) AND isActive = true`
- For each config: if `normalizedValue < config.criticalThreshold`:
  - `withTransaction`:
    1. `alert_logs.create`
    2. Enqueue notification job (email or in_app depending on `channel`)
  - Update `config.lastCheckedAt = now()`
- Does not return errors — fire-and-forget semantics, failures logged only

`deleteConfig`:
- Hard delete — config is user's own data, not platform audit trail
- Verify `config.userId === userId` → `Err forbidden` otherwise

**Transactions:**
- `createConfig` → `withTransaction`: `alert_configs` + `activity_log`
- `checkAndFire` → `withTransaction` per config that fires: `alert_logs` + notification enqueue

**Events:**
```ts
'alert.fired': { configId, userId, indicatorId, regionId, period, currentValue, threshold, channel }
```

**BullMQ Jobs:**
- `send-alert-email` — concurrency 5, retry 3
- `create-alert-in-app` — concurrency 10, retry 2

**Controller — authenticated user:**
```
GET    /alerts/configs                                 — my alert configurations
POST   /alerts/configs                                 — create config
PATCH  /alerts/configs/:id                             — update threshold / channel / toggle active
DELETE /alerts/configs/:id                             — delete config
GET    /alerts/logs                                    — my alert history (filters: from, to)
```

---

## PHASE 5 — Agent (NL-to-SQL) & Notifications

### Module · `agent`

> Natural language to SQL via Groq. Every query is logged immutably in `query_logs`.
> The agent is READ-ONLY — never generates INSERT, UPDATE, or DELETE.

**DTOs:**
```ts
AgentQueryDTO {
  query: string
  filters?: {
    region?: string
    indicator?: string
    period?: string
  }
}

AgentResponseDTO {
  queryId: string
  query: string
  generatedSql: string | null
  sqlValid: boolean
  result: Record<string, unknown>[] | null
  aiResponse: string
  rowsReturned: number
  latencyMs: number
  groqModel: string
  tokensUsed: number | null
  error: string | null
}

QueryLogFiltersDTO {
  userId?: string
  from?: Date
  to?: Date
  hasError?: boolean
  page?: number
  pageSize?: number
}
```

**Interface `IQueryLogRepository`:**
```ts
create(data: Omit<QueryLog, 'id' | 'createdAt'>, db?: DbOrTx): Promise<QueryLog>
findById(id: string): Promise<QueryLog | null>
findAll(filters?: QueryLogFiltersDTO): Promise<{ data: QueryLog[], total: number }>
```

**Interface `IAgentService`:**
```ts
query(data: AgentQueryDTO, userId?: string, ipAddress?: string): Promise<Result<AgentResponseDTO, AppError>>
getLog(queryId: string, staffId: string): Promise<Result<QueryLog, AppError>>
listLogs(filters?: QueryLogFiltersDTO, staffId?: string): Promise<Result<{ data: QueryLog[], total: number }, AppError>>
```

**Business rules:**

`query`:
- Build the Groq prompt:
  ```
  System: You are a read-only SQL analyst. Use only the tables defined in SCHEMA_CONTEXT.
          Generate a single SELECT query. Never generate INSERT, UPDATE, DELETE, or DDL.
          Respond in JSON: { sql: string, explanation: string }
  
  SCHEMA_CONTEXT: [SCHEMA_CONTEXT_FOR_AGENT constant from schema.ts]
  
  User filters (if provided): region = X, indicator = Y, period = Z
  
  User query: [data.query]
  ```
- Call Groq API (`groq-sdk`) → extract `{ sql, explanation }` from JSON response
- Validate SQL:
  - Must start with `SELECT` (case-insensitive, trimmed)
  - Must not contain `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `TRUNCATE`
  - If invalid → set `sqlValid = false`, skip execution, return error in `aiResponse`
- If valid: execute SQL against DB using a **read-only transaction** (`SET TRANSACTION READ ONLY`)
- Record `latencyMs` from start to DB response
- Persist result to `query_logs` regardless of success or error
- `userId` is nullable — unauthenticated queries are allowed and logged with `userId = null`
- `query_logs` records are **never deleted** — they are the audit trail and few-shot training corpus

**Transactions:** none in agent itself — `query_logs.create` is a single isolated insert; SQL execution uses its own read-only transaction

**Events:**
```ts
'agent.query': { queryId, userId, latencyMs, sqlValid, rowsReturned }
'agent.error': { queryId, userId, error }
```

**Controller — optional auth (userId attached if token provided):**
```
POST   /agent/query                                    — natural language query
GET    /agent/history                                  — my past queries (requires auth)
```

**Controller — staff:**
```
GET    /staff/query-logs                               — all logs (filters: userId, hasError, from, to)
GET    /staff/query-logs/:id                           — full detail (query, SQL, AI response, result)
```

---

### Module · `notifications`

> Pure output. No business logic. Called by BullMQ workers reacting to events.

**Interface `INotificationService`:**
```ts
sendEmail(to: string, template: EmailTemplate, data: unknown): Promise<void>
createInApp(recipientId: string, type: string, title: string, message: string, data?: Record<string, unknown>, actionUrl?: string): Promise<void>

// Semantic helpers — called by event workers
notifyUserAlertFired(userId: string, config: AlertConfigResponseDTO, currentValue: number, period: string): Promise<void>
notifyStaffIngestionCompleted(result: IngestionResultDTO): Promise<void>
notifyStaffIngestionFailed(sourceId: string, error: string): Promise<void>
notifyUserIndicatorCritical(userId: string, indicator: IndicatorResponseDTO, region: RegionResponseDTO, value: number): Promise<void>
```

**Email templates:**
```
alert_threshold_crossed   → "O indicador [name] na região [region] caiu abaixo de [threshold]. Valor actual: [value]."
ingestion_completed       → "[rows] registos ingeridos de [source]. Regiões actualizadas: [regions]."
ingestion_failed          → "Falha na ingestão de [source]: [error]."
indicator_critical        → "Indicador [name] em estado crítico na região [region] para o período [period]."
```

**BullMQ Workers:**
- `send-email` — concurrency 5, retry 3
- `create-in-app-notification` — concurrency 10, retry 2

**Controller — authenticated user:**
```
GET    /notifications                                  — unread first, then read
PATCH  /notifications/:id/read                        — mark as read
PATCH  /notifications/read-all                        — mark all as read
```

---

## PHASE 6 — Events (Observability Layer)

> Single consumer of all domain events emitted by every module.
> Writes to `activity_log`. Contains no business logic.

**How it works:**
```
[Any Service]
emitter.emit('ingestion.completed', payload)
        ↓
[Typed in-process EventEmitter]
        ↓
[BullMQ Producer — fire-and-forget]
  queue: 'domain-events'
        ↓
[BullMQ Worker]
  INSERT INTO activity_log
        ↓
  If event requires reactive notification → enqueue job
```

**Event → reactive notification map:**
```ts
const reactiveNotifications = {
  'ingestion.completed':      [{ type: 'notify_staff_ingestion_completed' }],
  'ingestion.failed':         [{ type: 'notify_staff_ingestion_failed' }],
  'indicator.critical':       [{ type: 'notify_user_indicator_critical' }],
  'alert.fired':              [{ type: 'send_alert_email_or_inapp' }],
  'program.created':          [],   // activity_log only
  'agent.error':              [{ type: 'log_agent_error_for_review' }],
  'user.registered':          [],   // activity_log only
  'staff.login':              [],   // activity_log only
  'staff.action':             [],   // activity_log only
}
```

---

## Cross-Cutting Rules

**Auth by actor:**
Two completely separate JWT audiences.
`requireUser` → verifies token from `sessions` with `userId` + `status === 'active'`
`requireStaff` → verifies token from `staff_sessions` with `staffId` + `isActive === true`
`requireOptionalUser` → attaches `userId` if token present, proceeds without error if absent (used by agent query endpoint)
A user token never works on a staff route, and vice-versa.

**Fastify plugin conventions:**
Auth is a Fastify plugin using `fastify-plugin` — decorated on the instance as `fastify.authenticate`, `fastify.authenticateStaff`, `fastify.authenticateOptional`.
Rate limiting via `@fastify/rate-limit` registered globally, with per-route overrides for the agent endpoint (stricter).
All validation uses native Fastify schema validation (JSON Schema / TypeBox) — no external validation library.

**Transaction sovereignty in service:**
Repositories accept `db: DbOrTx = defaultDb`.
The service decides when to group into a transaction.
Never open a transaction inside a repository.

**Events always fire-and-forget:**
`emitter.emit()` never throws.
Event persistence failure never cancels the business operation.
BullMQ guarantees async retry.

**Agent SQL safety:**
SQL generated by Groq is executed in a `READ ONLY` transaction — even if the model produces a mutating query, the DB will reject it at the protocol level.
The `sqlValid` flag is the application-level pre-check; the read-only transaction is the DB-level guard.

**CDRView records are immutable:**
`cdrview_records` is an append-only table — no updates, no deletes.
All aggregates in `region_coverage` and `indicator_data` are computed on top of this immutable log.
Re-running the pipeline for the same data is safe — `upsert` patterns on all derived tables.

**Indicator data is upserted, not inserted:**
`indicator_data` uses a unique constraint on `(region_id, indicator_id, period)`.
Repeated ingestion of the same period overwrites with the latest values.
The `quality` field tracks whether the value is `official`, `estimated`, or `modelled`.

**Alert check is synchronous within the coverage/indicator write path:**
`checkAndFire` is called inside the same request that updates coverage or indicator data.
It is synchronous for the lookup (find matching configs) but the actual notification dispatch (email, in-app) is always async via BullMQ.
This means the alert is always recorded before the write response returns, but the user's inbox is not guaranteed to receive it within the same request lifecycle.

**Regions are the stable anchor:**
`regions` and `base_stations` are upserted, never deleted.
All other data (`cdrview_records`, `region_coverage`, `indicator_data`, `programs`, `alert_configs`) references them via FK.
The `zone_id` natural key from the CDRView dataset is the authoritative identifier — internal UUIDs are only for FK joins.

**Query logs are permanent:**
`query_logs` records are never deleted.
They serve dual purpose: audit trail (who asked what, when) and few-shot corpus for future prompt improvement.
Staff can read all logs. Users can only read their own (`userId` filter enforced in service).

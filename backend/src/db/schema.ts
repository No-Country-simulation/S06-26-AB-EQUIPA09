import {
  pgTable, uuid, varchar, text, boolean,
  integer, jsonb, timestamp, index, uniqueIndex, inet,
  doublePrecision, real,
} from 'drizzle-orm/pg-core'
import { sql, relations } from 'drizzle-orm'

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const id        = () => uuid('id').primaryKey().default(sql`uuid_generate_v4()`)
const now       = () => timestamp('created_at').defaultNow().notNull()
const updatedAt = () => timestamp('updated_at').defaultNow().notNull()
const deletedAt = () => timestamp('deleted_at')


// ═════════════════════════════════════════════
// REUSED — zero changes
// ═════════════════════════════════════════════

// ─────────────────────────────────────────────
// USERS (public managers)
// ─────────────────────────────────────────────
export const users = pgTable('users', {
  id:           id(),
  email:        text('email').notNull(),
  emailHash:    text('email_hash').notNull(),
  name:         text('name').notNull(),
  phone:        text('phone'),
  passwordHash: text('password_hash'),
  googleId:     text('google_id'),
  avatar:       text('avatar'),
  timezone:     varchar('timezone', { length: 100 }),
  locale:       varchar('locale', { length: 10 }).default('pt'),
  status:       varchar('status', { length: 20 }).notNull().default('active'),
  // active | suspended | banned
  createdAt:    now(),
  updatedAt:    updatedAt(),
  deletedAt:    deletedAt(),
}, t => ({
  emailHashIdx: uniqueIndex('users_email_hash_idx').on(t.emailHash),
  googleIdIdx:  uniqueIndex('users_google_id_idx').on(t.googleId),
  statusIdx:    index('users_status_idx').on(t.status),
}))

// ─────────────────────────────────────────────
// STAFF USERS
// ─────────────────────────────────────────────
export const staffUsers = pgTable('staff_users', {
  id:           id(),
  email:        text('email').notNull(),
  emailHash:    text('email_hash').notNull(),
  name:         text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  avatar:       text('avatar'),
  isActive:     boolean('is_active').notNull().default(true),
  lastLoginAt:  timestamp('last_login_at'),
  createdAt:    now(),
  updatedAt:    updatedAt(),
  deletedAt:    deletedAt(),
}, t => ({
  emailHashIdx: uniqueIndex('staff_email_hash_idx').on(t.emailHash),
}))

// ─────────────────────────────────────────────
// SESSIONS — user sessions
// ─────────────────────────────────────────────
export const sessions = pgTable('sessions', {
  id:           id(),
  userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token:        text('token').notNull().unique(),
  refreshToken: text('refresh_token').unique(),
  userAgent:    text('user_agent'),
  ipAddress:    text('ip_address'),
  deviceType:   varchar('device_type', { length: 30 }),
  isActive:     boolean('is_active').notNull().default(true),
  expiresAt:    timestamp('expires_at').notNull(),
  createdAt:    now(),
  updatedAt:    updatedAt(),
  revokedAt:    timestamp('revoked_at'),
}, t => ({
  userIdx:         index('sessions_user_idx').on(t.userId),
  tokenIdx:        index('sessions_token_idx').on(t.token),
  refreshTokenIdx: index('sessions_refresh_token_idx').on(t.refreshToken),
  expiresAtIdx:    index('sessions_expires_at_idx').on(t.expiresAt),
}))

// ─────────────────────────────────────────────
// STAFF SESSIONS
// ─────────────────────────────────────────────
export const staffSessions = pgTable('staff_sessions', {
  id:           id(),
  staffId:      uuid('staff_id').notNull().references(() => staffUsers.id, { onDelete: 'cascade' }),
  token:        text('token').notNull().unique(),
  refreshToken: text('refresh_token').unique(),
  userAgent:    text('user_agent'),
  ipAddress:    text('ip_address'),
  deviceType:   varchar('device_type', { length: 30 }),
  isActive:     boolean('is_active').notNull().default(true),
  expiresAt:    timestamp('expires_at').notNull(),
  createdAt:    now(),
  updatedAt:    updatedAt(),
  revokedAt:    timestamp('revoked_at'),
}, t => ({
  staffIdx:        index('staff_sessions_staff_idx').on(t.staffId),
  tokenIdx:        index('staff_sessions_token_idx').on(t.token),
  refreshTokenIdx: index('staff_sessions_refresh_token_idx').on(t.refreshToken),
  expiresAtIdx:    index('staff_sessions_expires_at_idx').on(t.expiresAt),
}))

// ─────────────────────────────────────────────
// ACTIVITY LOG
// ─────────────────────────────────────────────
export const activityLog = pgTable('activity_log', {
  id:           id(),
  actorId:      uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  actorStaffId: uuid('actor_staff_id').references(() => staffUsers.id, { onDelete: 'set null' }),
  action:       varchar('action', { length: 100 }).notNull(),
  entityType:   varchar('entity_type', { length: 50 }).notNull(),
  entityId:     uuid('entity_id').notNull(),
  metadata:     jsonb('metadata').default({}),
  ipAddress:    inet('ip_address'),
  userAgent:    text('user_agent'),
  createdAt:    now(),
}, t => ({
  entityIdx:  index('activity_entity_idx').on(t.entityType, t.entityId),
  actorIdx:   index('activity_actor_idx').on(t.actorId),
  staffIdx:   index('activity_staff_idx').on(t.actorStaffId),
  createdIdx: index('activity_created_idx').on(t.createdAt),
}))

// ─────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────
export const notifications = pgTable('notifications', {
  id:          id(),
  recipientId: uuid('recipient_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:        varchar('type', { length: 100 }).notNull(),
  // alert.threshold | report.ready | system.update
  priority:    varchar('priority', { length: 20 }).default('normal'),
  title:       varchar('title', { length: 255 }).notNull(),
  message:     text('message'),
  actionUrl:   text('action_url'),
  data:        jsonb('data'),
  relatedType: varchar('related_type', { length: 50 }),
  relatedId:   uuid('related_id'),
  isRead:      boolean('is_read').notNull().default(false),
  readAt:      timestamp('read_at'),
  createdAt:   now(),
  deletedAt:   deletedAt(),
}, t => ({
  recipientIdx: index('notifications_recipient_idx').on(t.recipientId),
  unreadIdx:    index('notifications_unread_idx').on(t.recipientId, t.isRead),
}))


// ═════════════════════════════════════════════
// BiT B2G SPECIFIC
// ═════════════════════════════════════════════

// ─────────────────────────────────────────────
// DATA SOURCES
// Registry of each public source that feeds the indicators.
// Allows tracking provenance in the agent response.
// ─────────────────────────────────────────────
export const dataSources = pgTable('data_sources', {
  id:          id(),
  slug:        varchar('slug', { length: 100 }).notNull(),
  name:        varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  url:         text('url'),
  type:        varchar('type', { length: 50 }).notNull().default('csv'),
  // csv | api | scraping | manual
  country:     varchar('country', { length: 10 }).notNull().default('BR'),
  // BR | AO | international
  isActive:    boolean('is_active').notNull().default(true),
  lastIngestedAt: timestamp('last_ingested_at'),
  createdAt:   now(),
  updatedAt:   updatedAt(),
}, t => ({
  slugIdx:    uniqueIndex('data_sources_slug_idx').on(t.slug),
  countryIdx: index('data_sources_country_idx').on(t.country),
}))

// ─────────────────────────────────────────────
// INDICATORS
// Catalog of metrics displayed on the dashboard.
// seed.ts populates the 5 initial indicators.
// ─────────────────────────────────────────────
export const indicators = pgTable('indicators', {
  id:          id(),
  slug:        varchar('slug', { length: 100 }).notNull(),
  name:        varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  category:    varchar('category', { length: 50 }).notNull(),
  // training | employability | structured_experiences | mentorships | mental_health
  unit:        varchar('unit', { length: 50 }).notNull(),
  // % | score_0_1 | per_100k | absolute
  direction:   varchar('direction', { length: 20 }).notNull().default('higher_is_better'),
  // higher_is_better | lower_is_better
  criticalThresholds: jsonb('critical_thresholds').default({}).$type<{
    critical?: number  // below this → red
    warning?:  number  // below this → yellow
  }>(),
  sourceId:    uuid('source_id').references(() => dataSources.id, { onDelete: 'set null' }),
  isActive:    boolean('is_active').notNull().default(true),
  createdAt:   now(),
  updatedAt:   updatedAt(),
}, t => ({
  slugIdx:     uniqueIndex('indicators_slug_idx').on(t.slug),
  categoryIdx: index('indicators_category_idx').on(t.category),
}))

// ─────────────────────────────────────────────
// REGIONS
// One row per unique geographic zone extracted from CDRView.
// zone_id is the native identifier of the Vísent dataset.
// ─────────────────────────────────────────────
export const regions = pgTable('regions', {
  id:                id(),
  zoneId:            varchar('zone_id', { length: 100 }).notNull(),
  // natural key from the CDRView dataset
  name:              varchar('name', { length: 200 }).notNull(),
  municipality:      varchar('municipality', { length: 100 }).notNull(),
  state:             varchar('state', { length: 100 }).notNull(),
  country:           varchar('country', { length: 10 }).notNull().default('BR'),
  lat:               doublePrecision('lat').notNull(),
  lng:               doublePrecision('lng').notNull(),
  // Progressive PostGIS: geom POINT added via raw SQL migration in Phase 2
  estimatedPopulation: integer('estimated_population'),
  areaKm2:           doublePrecision('area_km2'),
  createdAt:         now(),
  updatedAt:         updatedAt(),
}, t => ({
  zoneIdIdx:      uniqueIndex('regions_zone_id_idx').on(t.zoneId),
  stateIdx:       index('regions_state_idx').on(t.state),
  municipalityIdx: index('regions_municipality_idx').on(t.municipality, t.state),
  coordsIdx:      index('regions_coords_idx').on(t.lat, t.lng),
}))

// ─────────────────────────────────────────────
// BASE STATIONS (ERBs)
// Anatel antennas with real coordinates from CDRView dataset.
// ─────────────────────────────────────────────
export const baseStations = pgTable('base_stations', {
  id:           id(),
  stationId:    varchar('station_id', { length: 100 }).notNull(),
  // natural key from the dataset
  regionId:     uuid('region_id').notNull().references(() => regions.id, { onDelete: 'cascade' }),
  technology:   varchar('technology', { length: 10 }).notNull(),
  // 2G | 3G | 4G | 5G
  carrier:      varchar('carrier', { length: 100 }),
  lat:          doublePrecision('lat').notNull(),
  lng:          doublePrecision('lng').notNull(),
  powerDbm:     real('power_dbm'),
  isActive:     boolean('is_active').notNull().default(true),
  createdAt:    now(),
  updatedAt:    updatedAt(),
}, t => ({
  stationIdIdx:  uniqueIndex('base_stations_station_id_idx').on(t.stationId),
  regionIdx:     index('base_stations_region_idx').on(t.regionId),
  technologyIdx: index('base_stations_technology_idx').on(t.technology),
}))

// ─────────────────────────────────────────────
// CDRVIEW RECORDS
// Raw records from the Vísent CDRView dataset after normalisation.
// Immutable — ingestion audit trail.
// ─────────────────────────────────────────────
export const cdrviewRecords = pgTable('cdrview_records', {
  id:               id(),
  regionId:         uuid('region_id').notNull().references(() => regions.id, { onDelete: 'cascade' }),
  stationId:        uuid('station_id').references(() => baseStations.id, { onDelete: 'set null' }),
  period:           timestamp('period').notNull(),
  // original CDRView timestamp
  hourOfDay:        integer('hour_of_day').notNull(),
  // 0–23 — extracted from period for fast queries
  dayOfWeek:        integer('day_of_week').notNull(),
  // 0=monday … 6=sunday
  peopleCount:      integer('people_count').notNull().default(0),
  networkTechnology: varchar('network_technology', { length: 10 }),
  // 2G | 3G | 4G | 5G | unknown
  signalStrength:   real('signal_strength'),
  // normalised 0.0–1.0 by pipeline
  createdAt:        now(),
}, t => ({
  regionIdx:    index('cdrview_records_region_idx').on(t.regionId),
  periodIdx:    index('cdrview_records_period_idx').on(t.period),
  hourIdx:      index('cdrview_records_hour_idx').on(t.hourOfDay),
  regionPerIdx: index('cdrview_records_region_period_idx').on(t.regionId, t.period),
}))

// ─────────────────────────────────────────────
// REGION COVERAGE
// Aggregates calculated per zone after CDRView ingestion.
// Upsert by (region_id, period) — monthly/yearly version.
// ─────────────────────────────────────────────
export const regionCoverage = pgTable('region_coverage', {
  id:                    id(),
  regionId:              uuid('region_id').notNull().references(() => regions.id, { onDelete: 'cascade' }),
  period:                varchar('period', { length: 20 }).notNull(),
  // e.g.: '2024', '2024-Q1', '2024-01'
  networkCoverageScore:  real('network_coverage_score').notNull().default(0),
  // weighted average: signal_strength * technology_weight (0.0–1.0)
  maxConcentration:      integer('max_concentration').notNull().default(0),
  minConcentration:      integer('min_concentration').notNull().default(0),
  avgDaytimeConcentration:  real('avg_daytime_concentration'),
  // 08h–18h
  avgNighttimeConcentration: real('avg_nighttime_concentration'),
  // outside daytime window
  dominantTechnology:    varchar('dominant_technology', { length: 10 }),
  no4gOr5gCoverage:      boolean('no_4g_or_5g_coverage').notNull().default(false),
  // critical flag for filters and alerts
  totalRecords:          integer('total_records').notNull().default(0),
  updatedAt:             updatedAt(),
}, t => ({
  regionPeriodIdx: uniqueIndex('region_coverage_region_period_idx').on(t.regionId, t.period),
  regionIdx:       index('region_coverage_region_idx').on(t.regionId),
  periodIdx:       index('region_coverage_period_idx').on(t.period),
  criticalIdx:     index('region_coverage_critical_idx').on(t.no4gOr5gCoverage),
}))

// ─────────────────────────────────────────────
// INDICATOR DATA
// Values calculated per region + indicator + period.
// Populated by the ingestion pipeline or manually via public sources.
// ─────────────────────────────────────────────
export const indicatorData = pgTable('indicator_data', {
  id:              id(),
  regionId:        uuid('region_id').notNull().references(() => regions.id, { onDelete: 'cascade' }),
  indicatorId:     uuid('indicator_id').notNull().references(() => indicators.id, { onDelete: 'cascade' }),
  sourceId:        uuid('source_id').references(() => dataSources.id, { onDelete: 'set null' }),
  period:          varchar('period', { length: 20 }).notNull(),
  value:           real('value').notNull(),
  // raw value in the indicator's unit
  normalizedValue: real('normalized_value'),
  // normalised 0.0–1.0 for cross-comparison
  quality:         varchar('quality', { length: 20 }).default('estimated'),
  // official | estimated | modelled
  notes:           text('notes'),
  updatedAt:       updatedAt(),
}, t => ({
  uniqueIdx:    uniqueIndex('indicator_data_unique_idx').on(t.regionId, t.indicatorId, t.period),
  regionIdx:    index('indicator_data_region_idx').on(t.regionId),
  indicatorIdx: index('indicator_data_indicator_idx').on(t.indicatorId),
  periodIdx:    index('indicator_data_period_idx').on(t.period),
}))

// ─────────────────────────────────────────────
// PROGRAMS
// Public programs mapped by region.
// ─────────────────────────────────────────────
export const programs = pgTable('programs', {
  id:           id(),
  regionId:     uuid('region_id').references(() => regions.id, { onDelete: 'set null' }),
  name:         varchar('name', { length: 200 }).notNull(),
  description:  text('description'),
  category:     varchar('category', { length: 50 }).notNull(),
  // training | employability | structured_experiences | mentorships | mental_health
  organization: varchar('organization', { length: 200 }),
  // responsible org — federal, state, municipal, NGO
  municipality: varchar('municipality', { length: 100 }),
  state:        varchar('state', { length: 100 }),
  url:          text('url'),
  isActive:     boolean('is_active').notNull().default(true),
  startsAt:     timestamp('starts_at'),
  endsAt:       timestamp('ends_at'),
  // null = no defined end date
  metadata:     jsonb('metadata').default({}).$type<Record<string, unknown>>(),
  createdAt:    now(),
  updatedAt:    updatedAt(),
  deletedAt:    deletedAt(),
}, t => ({
  regionIdx:   index('programs_region_idx').on(t.regionId),
  categoryIdx: index('programs_category_idx').on(t.category),
  stateIdx:    index('programs_state_idx').on(t.state),
  activeIdx:   index('programs_active_idx').on(t.isActive, t.category),
}))

// ─────────────────────────────────────────────
// ALERT CONFIGS
// Threshold alert configuration per manager.
// ─────────────────────────────────────────────
export const alertConfigs = pgTable('alert_configs', {
  id:              id(),
  userId:          uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  indicatorId:     uuid('indicator_id').notNull().references(() => indicators.id, { onDelete: 'cascade' }),
  regionId:        uuid('region_id').references(() => regions.id, { onDelete: 'cascade' }),
  // null = alert for any region
  criticalThreshold: real('critical_threshold').notNull(),
  // fires when normalized_value drops below this
  isActive:        boolean('is_active').notNull().default(true),
  channel:         varchar('channel', { length: 20 }).notNull().default('email'),
  // email | in_app
  lastCheckedAt:   timestamp('last_checked_at'),
  createdAt:       now(),
  updatedAt:       updatedAt(),
}, t => ({
  userIdx:      index('alert_configs_user_idx').on(t.userId),
  indicatorIdx: index('alert_configs_indicator_idx').on(t.indicatorId),
  activeIdx:    index('alert_configs_active_idx').on(t.isActive),
}))

// ─────────────────────────────────────────────
// ALERT LOGS
// Immutable history of fired alerts.
// ─────────────────────────────────────────────
export const alertLogs = pgTable('alert_logs', {
  id:               id(),
  configId:         uuid('config_id').notNull().references(() => alertConfigs.id, { onDelete: 'cascade' }),
  regionId:         uuid('region_id').notNull().references(() => regions.id, { onDelete: 'cascade' }),
  indicatorId:      uuid('indicator_id').notNull().references(() => indicators.id, { onDelete: 'cascade' }),
  currentValue:     real('current_value').notNull(),
  criticalThreshold: real('critical_threshold').notNull(),
  period:           varchar('period', { length: 20 }).notNull(),
  sentAt:           timestamp('sent_at').notNull().defaultNow(),
  channel:          varchar('channel', { length: 20 }).notNull(),
  createdAt:        now(),
}, t => ({
  configIdx: index('alert_logs_config_idx').on(t.configId),
  regionIdx: index('alert_logs_region_idx').on(t.regionId),
  sentIdx:   index('alert_logs_sent_idx').on(t.sentAt),
}))

// ─────────────────────────────────────────────
// QUERY LOGS
// Immutable record of each NL-to-SQL agent query.
// Never delete — used for auditing and improving few-shot examples.
// ─────────────────────────────────────────────
export const queryLogs = pgTable('query_logs', {
  id:             id(),
  userId:         uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  // nullable — no mandatory auth during hackathon
  query:          text('query').notNull(),
  filters:        jsonb('filters').default({}).$type<{
    region?:    string
    indicator?: string
    period?:    string
  }>(),
  generatedSql:   text('generated_sql'),
  sqlValid:       boolean('sql_valid'),
  aiResponse:     text('ai_response'),
  rowsReturned:   integer('rows_returned').notNull().default(0),
  latencyMs:      integer('latency_ms').notNull(),
  groqModel:      varchar('groq_model', { length: 100 }).notNull(),
  tokensUsed:     integer('tokens_used'),
  error:          text('error'),
  // null = success
  ipAddress:      text('ip_address'),
  createdAt:      now(),
}, t => ({
  userIdx:    index('query_logs_user_idx').on(t.userId),
  createdIdx: index('query_logs_created_idx').on(t.createdAt),
  errorIdx:   index('query_logs_error_idx').on(t.error),
  // partial index useful for filtering only failed queries
}))


// ═════════════════════════════════════════════
// RELATIONS
// ═════════════════════════════════════════════

export const usersRelations = relations(users, ({ many }) => ({
  sessions:     many(sessions),
  notifications: many(notifications),
  alertConfigs: many(alertConfigs),
  queryLogs:    many(queryLogs),
  activityLog:  many(activityLog),
}))

export const staffUsersRelations = relations(staffUsers, ({ many }) => ({
  sessions:    many(staffSessions),
  activityLog: many(activityLog),
}))

export const staffSessionsRelations = relations(staffSessions, ({ one }) => ({
  staff: one(staffUsers, { fields: [staffSessions.staffId], references: [staffUsers.id] }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(users, { fields: [notifications.recipientId], references: [users.id] }),
}))

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  actor:      one(users,      { fields: [activityLog.actorId],      references: [users.id] }),
  actorStaff: one(staffUsers, { fields: [activityLog.actorStaffId], references: [staffUsers.id] }),
}))

export const dataSourcesRelations = relations(dataSources, ({ many }) => ({
  indicators:    many(indicators),
  indicatorData: many(indicatorData),
}))

export const indicatorsRelations = relations(indicators, ({ one, many }) => ({
  source:        one(dataSources, { fields: [indicators.sourceId], references: [dataSources.id] }),
  indicatorData: many(indicatorData),
  alertConfigs:  many(alertConfigs),
  alertLogs:     many(alertLogs),
}))

export const regionsRelations = relations(regions, ({ many }) => ({
  baseStations:  many(baseStations),
  cdrviewRecords: many(cdrviewRecords),
  regionCoverage: many(regionCoverage),
  indicatorData: many(indicatorData),
  programs:      many(programs),
  alertConfigs:  many(alertConfigs),
  alertLogs:     many(alertLogs),
}))

export const baseStationsRelations = relations(baseStations, ({ one, many }) => ({
  region:        one(regions, { fields: [baseStations.regionId], references: [regions.id] }),
  cdrviewRecords: many(cdrviewRecords),
}))

export const cdrviewRecordsRelations = relations(cdrviewRecords, ({ one }) => ({
  region:  one(regions,       { fields: [cdrviewRecords.regionId],  references: [regions.id] }),
  station: one(baseStations,  { fields: [cdrviewRecords.stationId], references: [baseStations.id] }),
}))

export const regionCoverageRelations = relations(regionCoverage, ({ one }) => ({
  region: one(regions, { fields: [regionCoverage.regionId], references: [regions.id] }),
}))

export const indicatorDataRelations = relations(indicatorData, ({ one }) => ({
  region:    one(regions,     { fields: [indicatorData.regionId],    references: [regions.id] }),
  indicator: one(indicators,  { fields: [indicatorData.indicatorId], references: [indicators.id] }),
  source:    one(dataSources, { fields: [indicatorData.sourceId],    references: [dataSources.id] }),
}))

export const programsRelations = relations(programs, ({ one }) => ({
  region: one(regions, { fields: [programs.regionId], references: [regions.id] }),
}))

export const alertConfigsRelations = relations(alertConfigs, ({ one, many }) => ({
  user:      one(users,       { fields: [alertConfigs.userId],      references: [users.id] }),
  indicator: one(indicators,  { fields: [alertConfigs.indicatorId], references: [indicators.id] }),
  region:    one(regions,     { fields: [alertConfigs.regionId],    references: [regions.id] }),
  logs:      many(alertLogs),
}))

export const alertLogsRelations = relations(alertLogs, ({ one }) => ({
  config:    one(alertConfigs, { fields: [alertLogs.configId],    references: [alertConfigs.id] }),
  region:    one(regions,      { fields: [alertLogs.regionId],    references: [regions.id] }),
  indicator: one(indicators,   { fields: [alertLogs.indicatorId], references: [indicators.id] }),
}))

export const queryLogsRelations = relations(queryLogs, ({ one }) => ({
  user: one(users, { fields: [queryLogs.userId], references: [users.id] }),
}))


// ═════════════════════════════════════════════
// SCHEMA CONTEXT — exported for the NL-to-SQL prompt
// Kept in sync with the real schema — if a table changes, the context changes.
// ═════════════════════════════════════════════
export const SCHEMA_CONTEXT_FOR_AGENT = `
Available tables for querying (READ-ONLY):

regions(id, zone_id, name, municipality, state, country, lat, lng, estimated_population, area_km2)
base_stations(id, station_id, region_id, technology[2G|3G|4G|5G], carrier, lat, lng, power_dbm, is_active)
cdrview_records(id, region_id, station_id, period, hour_of_day[0-23], day_of_week[0-6], people_count, network_technology, signal_strength[0.0-1.0])
region_coverage(id, region_id, period, network_coverage_score[0.0-1.0], max_concentration, min_concentration, avg_daytime_concentration, avg_nighttime_concentration, dominant_technology, no_4g_or_5g_coverage[bool], total_records)
indicators(id, slug, name, category[training|employability|structured_experiences|mentorships|mental_health], unit, direction[higher_is_better|lower_is_better])
indicator_data(id, region_id, indicator_id, source_id, period, value, normalized_value[0.0-1.0], quality[official|estimated|modelled])
programs(id, region_id, name, category, organization, municipality, state, is_active, starts_at, ends_at)
data_sources(id, slug, name, url, type, country)

Common JOINs:
- regions JOIN region_coverage ON region_coverage.region_id = regions.id
- regions JOIN indicator_data ON indicator_data.region_id = regions.id
- indicator_data JOIN indicators ON indicators.id = indicator_data.indicator_id
- regions JOIN programs ON programs.region_id = regions.id

Common filters:
- period = '2024' (year) or '2024-Q1' (quarter)
- no_4g_or_5g_coverage = true (critical zones)
- normalized_value < 0.3 (low/critical indicator)
- hour_of_day BETWEEN 8 AND 18 (daytime hours)
` as const


// ═════════════════════════════════════════════
// TYPES
// ═════════════════════════════════════════════
export type User               = typeof users.$inferSelect
export type NewUser            = typeof users.$inferInsert
export type StaffUser          = typeof staffUsers.$inferSelect
export type NewStaffUser       = typeof staffUsers.$inferInsert
export type Session            = typeof sessions.$inferSelect
export type NewSession         = typeof sessions.$inferInsert
export type StaffSession       = typeof staffSessions.$inferSelect
export type NewStaffSession    = typeof staffSessions.$inferInsert
export type ActivityLog        = typeof activityLog.$inferSelect
export type NewActivityLog     = typeof activityLog.$inferInsert
export type Notification       = typeof notifications.$inferSelect
export type NewNotification    = typeof notifications.$inferInsert
export type DataSource         = typeof dataSources.$inferSelect
export type NewDataSource      = typeof dataSources.$inferInsert
export type Indicator          = typeof indicators.$inferSelect
export type NewIndicator       = typeof indicators.$inferInsert
export type Region             = typeof regions.$inferSelect
export type NewRegion          = typeof regions.$inferInsert
export type BaseStation        = typeof baseStations.$inferSelect
export type NewBaseStation     = typeof baseStations.$inferInsert
export type CdrviewRecord      = typeof cdrviewRecords.$inferSelect
export type NewCdrviewRecord   = typeof cdrviewRecords.$inferInsert
export type RegionCoverage     = typeof regionCoverage.$inferSelect
export type NewRegionCoverage  = typeof regionCoverage.$inferInsert
export type IndicatorData      = typeof indicatorData.$inferSelect
export type NewIndicatorData   = typeof indicatorData.$inferInsert
export type Program            = typeof programs.$inferSelect
export type NewProgram         = typeof programs.$inferInsert
export type AlertConfig        = typeof alertConfigs.$inferSelect
export type NewAlertConfig     = typeof alertConfigs.$inferInsert
export type AlertLog           = typeof alertLogs.$inferSelect
export type NewAlertLog        = typeof alertLogs.$inferInsert
export type QueryLog           = typeof queryLogs.$inferSelect
export type NewQueryLog        = typeof queryLogs.$inferInsert
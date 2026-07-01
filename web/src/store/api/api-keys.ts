export const TAG_TYPES = {
  auth:       ['Auth', 'Me'] as const,
  users:      ['User', 'Users', 'Me'] as const,
  regions:    ['Region', 'Regions', 'RegionDetail', 'BaseStation'] as const,
  coverage:   ['Coverage', 'CoverageDetail'] as const,
  indicators: ['Indicator', 'Indicators', 'IndicatorData'] as const,
  programs:   ['Program', 'Programs'] as const,
  agent:      ['AgentQuery', 'QueryLog'] as const,
} as const

export const API_KEYS = {
  regions: {
    all:      () => ['Region'] as const,
    list:     () => ['Region', 'list'] as const,
    detail:   (id?: string) => ['Region', 'detail', id].filter(Boolean) as unknown as readonly string[],
    stations: (id?: string) => ['Region', 'stations', id].filter(Boolean) as unknown as readonly string[],
  },
  coverage: {
    all:      () => ['Coverage'] as const,
    list:     () => ['Coverage', 'list'] as const,
    detail:   (regionId?: string, period?: string) => ['Coverage', 'detail', regionId, period].filter(Boolean) as unknown as readonly string[],
    critical: () => ['Coverage', 'critical'] as const,
  },
  indicators: {
    all:      () => ['Indicator'] as const,
    list:     () => ['Indicator', 'list'] as const,
    detail:   (id?: string) => ['Indicator', 'detail', id].filter(Boolean) as unknown as readonly string[],
    data:     (indicatorId?: string) => ['Indicator', 'data', indicatorId].filter(Boolean) as unknown as readonly string[],
  },
  programs: {
    all:      () => ['Program'] as const,
    list:     () => ['Program', 'list'] as const,
    detail:   (id?: string) => ['Program', 'detail', id].filter(Boolean) as unknown as readonly string[],
  },
  agent: {
    all:      () => ['AgentQuery'] as const,
    query:    () => ['AgentQuery', 'query'] as const,
    logs:     () => ['AgentQuery', 'logs'] as const,
  },
} as const

export type ApiKeys = typeof API_KEYS
export type TagTypes = typeof TAG_TYPES

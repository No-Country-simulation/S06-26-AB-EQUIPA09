const templates: Record<string, string> = {
  notification: 'notification',
  alert_threshold_crossed: 'alert_threshold_crossed',
  ingestion_completed: 'ingestion_completed',
  ingestion_failed: 'ingestion_failed',
  indicator_critical: 'indicator_critical',
}

export const getTemplate = (name: string): string | undefined => {
  return templates[name]
}

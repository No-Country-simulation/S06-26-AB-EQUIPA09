export enum LogCategory {
  APP = 'app',
  HTTP = 'http',
  DATABASE = 'database',
  ERROR = 'error',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
}

export interface LogContext {
  category: LogCategory;
  requestId?: string;
  userId?: string;
  traceId?: string;
  spanId?: string;
  [key: string]: unknown;
}
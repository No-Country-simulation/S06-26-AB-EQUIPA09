export type NotificationChannel = 'in_app' | 'email' | 'both';

export interface NotificationTemplate {
  type: string;
  channels: NotificationChannel;
  emailTemplate?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  requiresEmailConfirmation?: boolean;
}

/**
 * Configuração de templates de notificação
 * Define quando cada tipo de notificação deve enviar email
 */
export const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
  // USER EVENTS
  'user.welcome': {
    type: 'user.welcome',
    channels: 'both',
    emailTemplate: 'welcome',
    priority: 'normal',
  },
  'user.password_reset': {
    type: 'user.password_reset',
    channels: 'both',
    emailTemplate: 'password-reset',
    priority: 'high',
    requiresEmailConfirmation: true,
  },
  'user.email_verification': {
    type: 'user.email_verification',
    channels: 'email',
    emailTemplate: 'email-verification',
    priority: 'high',
    requiresEmailConfirmation: true,
  },

  // FINANCIAL EVENTS
  'invoice.created': {
    type: 'invoice.created',
    channels: 'both',
    emailTemplate: 'invoice',
    priority: 'normal',
  },
  'invoice.overdue': {
    type: 'invoice.overdue',
    channels: 'both',
    emailTemplate: 'invoice-reminder',
    priority: 'high',
  },
  'payment.confirmed': {
    type: 'payment.confirmed',
    channels: 'both',
    emailTemplate: 'payment-confirmation',
    priority: 'normal',
  },
  'payment.failed': {
    type: 'payment.failed',
    channels: 'both',
    emailTemplate: 'payment-failed',
    priority: 'urgent',
  },

  // INVENTORY EVENTS
  'inventory.low_stock': {
    type: 'inventory.low_stock',
    channels: 'both',
    emailTemplate: 'low-stock-alert',
    priority: 'high',
  },
  'inventory.out_of_stock': {
    type: 'inventory.out_of_stock',
    channels: 'both',
    emailTemplate: 'out-of-stock-alert',
    priority: 'urgent',
  },

  // SALARY EVENTS
  'salary.processed': {
    type: 'salary.processed',
    channels: 'both',
    emailTemplate: 'salary-processed',
    priority: 'normal',
  },
  'salary.failed': {
    type: 'salary.failed',
    channels: 'both',
    emailTemplate: 'salary-failed',
    priority: 'urgent',
  },

  // EXPENSE EVENTS
  'expense.created': {
    type: 'expense.created',
    channels: 'in_app',
    priority: 'low',
  },
  'expense.approved': {
    type: 'expense.approved',
    channels: 'both',
    emailTemplate: 'expense-approved',
    priority: 'normal',
  },
  'expense.rejected': {
    type: 'expense.rejected',
    channels: 'both',
    emailTemplate: 'expense-rejected',
    priority: 'normal',
  },

  // GENERIC SYSTEM NOTIFICATIONS
  'system.alert': {
    type: 'system.alert',
    channels: 'both',
    emailTemplate: 'system-alert',
    priority: 'urgent',
  },
  'system.maintenance': {
    type: 'system.maintenance',
    channels: 'both',
    emailTemplate: 'maintenance-notice',
    priority: 'high',
  },
  'system.info': {
    type: 'system.info',
    channels: 'in_app',
    priority: 'low',
  },
};

/**
 * Retorna o template de notificação ou um template padrão
 */
export const getNotificationTemplate = (type: string): NotificationTemplate => {
  return NOTIFICATION_TEMPLATES[type] || {
    type,
    channels: 'in_app',
    priority: 'normal',
  };
};
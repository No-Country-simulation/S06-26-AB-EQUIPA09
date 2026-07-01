import { QueueManager } from '@/shared/queue/queue';
import { logger } from '@/shared/logger/logger';
import type { Job } from 'bullmq';
import { processEventForAudit } from '@/modules/activity/events/audit.listener';

export type NotificationCreatedPayload = {
  notificationId: string;
  recipientId: string;
  type: string;
  createdAt: Date;
};

export type NotificationReadPayload = {
  notificationId: string;
  recipientId: string;
  readAt: Date;
};

export type NotificationEventPayload =
  | NotificationCreatedPayload
  | NotificationReadPayload;

export const NotificationEventNames = {
  NOTIFICATION_CREATED: 'notification.created',
  NOTIFICATION_READ: 'notification.read',
} as const;

const processNotificationEvent = async (job: Job<NotificationEventPayload>): Promise<void> => {
  logger.info({ eventName: job.name, payload: job.data }, 'Notification event processed');
  await processEventForAudit(job.name, job.data);
};

export const notificationEventsQueue = new QueueManager<NotificationEventPayload>({
  name: 'notification-events',
  processor: processNotificationEvent,
});

export const emitNotificationCreated = async (
  notificationId: string,
  recipientId: string,
  type: string
): Promise<void> => {
  await notificationEventsQueue.addJob(NotificationEventNames.NOTIFICATION_CREATED, {
    notificationId,
    recipientId,
    type,
    createdAt: new Date(),
  });
};

export const emitNotificationRead = async (
  notificationId: string,
  recipientId: string
): Promise<void> => {
  await notificationEventsQueue.addJob(NotificationEventNames.NOTIFICATION_READ, {
    notificationId,
    recipientId,
    readAt: new Date(),
  });
};
import { z } from 'zod';

export type CreateNotificationDTO = {
  type: string;
  title: string;
  message?: string | null;
  priority?: string;
  actionUrl?: string | null;
  data?: Record<string, unknown> | null;
  relatedType?: string | null;
  relatedId?: string | null;
};

export type NotificationResponseDTO = {
  id: string;
  userId: string; 
  type: string;
  priority: string | null;
  title: string;
  message: string | null;
  actionUrl: string | null;
  data: Record<string, unknown> | null;
  relatedType: string | null;
  relatedId: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
};

export type NotificationCountDTO = {
  total: number;
  unread: number;
};

export const createNotificationSchema = z.object({
  type: z.string().min(1).max(100),
  title: z.string().min(1).max(255),
  message: z.string().optional().nullable(),
  priority: z.string().max(20).optional().default('normal'),
  actionUrl: z.string().url().optional().nullable(),
  data: z.record(z.unknown()).optional().nullable(),
  relatedType: z.string().max(50).optional().nullable(),
  relatedId: z.string().uuid().optional().nullable(),
});

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(100).default(10),
  isRead: z.coerce.boolean().optional(),
  priority: z.string().optional(),
});
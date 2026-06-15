/**
 * Zod validation schemas for Todo and Chat application
 * Used for input validation on both client and server
 */

import { z } from 'zod';

// ==========================================
// TODO SCHEMAS
// ==========================================

export const TodoStatusSchema = z.enum(['pending', 'in_progress', 'completed']);

export const CreateTodoSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
});

export const UpdateTodoSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  status: TodoStatusSchema.optional(),
});

export const TodoIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateTodoInput = z.infer<typeof CreateTodoSchema>;
export type UpdateTodoInput = z.infer<typeof UpdateTodoSchema>;

// ==========================================
// CHAT SCHEMAS
// ==========================================

export const SessionStatusSchema = z.enum(['active', 'closed']);
export const SenderTypeSchema = z.enum(['visitor', 'staff']);
export const ContentTypeSchema = z.enum(['text', 'image', 'video', 'file']);

export const CreateSessionSchema = z.object({
  visitorName: z.string().max(50, 'Name too long').optional(),
  sessionId: z.string().uuid().optional(),
});

export const SendMessageSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  senderType: SenderTypeSchema,
  contentType: ContentTypeSchema,
  content: z.string().min(1, 'Content is required').max(10000, 'Content too long'),
  thumbnailUrl: z.string().url().optional(),
  fileName: z.string().max(255).optional(),
  fileSize: z.number().int().positive().optional(),
});

export const GetMessagesSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const SessionIdSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

export const ListSessionsSchema = z.object({
  status: SessionStatusSchema.optional(),
});

// File upload constraints
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_VIDEO_SIZE = 20 * 1024 * 1024; // 20MB
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for general files
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
export const ALLOWED_FILE_TYPES = [
  'text/plain',
  'text/csv',
  'application/csv',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream', // IPA and other binary files
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export const FileUploadSchema = z.object({
  file: z.custom<File>((file) => file instanceof File, 'Invalid file'),
  sessionId: z.string().min(1, 'Session ID is required'),
});

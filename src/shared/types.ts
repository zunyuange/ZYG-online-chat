/**
 * Shared types for Todo and Chat application
 * Used by both client and server
 */

// ==========================================
// TODO TYPES
// ==========================================

export type TodoStatus = 'pending' | 'in_progress' | 'completed';

export interface Todo {
  id: number;
  title: string;
  description?: string;
  status: TodoStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTodoInput {
  title: string;
  description?: string;
}

export interface UpdateTodoInput {
  title?: string;
  description?: string;
  status?: TodoStatus;
}

// ==========================================
// CHAT TYPES
// ==========================================

export type SessionStatus = 'active' | 'closed';
export type SenderType = 'visitor' | 'staff';
export type ContentType = 'text' | 'image' | 'video' | 'file';

// 任务状态类型
export type TaskStatus =
  | 'requirement_discussion' // 需求讨论
  | 'requirement_confirmed' // 需求确认
  | 'in_progress' // 执行中
  | 'delivered' // 交付
  | 'reviewed'; // 评价

// 任务状态列表（用于 UI 渲染）
export const TASK_STATUS_LIST = [
  { status: 'requirement_discussion', label: '需求讨论', order: 1 },
  { status: 'requirement_confirmed', label: '需求确认', order: 2 },
  { status: 'in_progress', label: '执行中', order: 3 },
  { status: 'delivered', label: '交付', order: 4 },
  { status: 'reviewed', label: '评价', order: 5 },
] as const;

// 输入模式类型
export type InputMode = 'chat' | 'topic';

export interface Session {
  id: string;
  visitorName: string;
  businessId?: number; // 商家ID
  businessSlug?: string; // 商家标识(slug)
  businessName?: string; // 商家名称
  status: SessionStatus;
  lastMessageAt?: Date;
  unreadByVisitor: number;
  unreadByStaff: number;
  assignedStaffId?: number; // 分配的客服ID
  assignedStaffName?: string; // 分配的客服名称
  // 新增字段
  topic?: string;
  taskStatus: TaskStatus;
  taskStatusUpdatedAt?: Date;
  queuePosition?: number;
  estimatedWaitMinutes?: number;
  createdAt: Date;
  updatedAt: Date;
  // 访客自定义字段
  email?: string;
  phone?: string;
  pid?: string; // 跨系统唯一标识
  params?: Record<string, string>; // 自定义参数JSON
  ip?: string;
  fromUrl?: string; // 进入链接
  referer?: string; // 来源地址
  userAgent?: string;
  device?: string;
  lang?: string;
  avatar?: string;
  lastVisitorActivityAt?: Date; // 访客最近活动时间（用于判断是否在线）
}

export interface Message {
  id: number;
  sessionId: string;
  senderType: SenderType;
  contentType: ContentType;
  content: string;
  translatedContent?: string;  // 自动翻译后的内容
  translateEngine?: string;    // 翻译引擎: 'cloudflare' | 'pearapi' | 'simplytranslate' | 'google' | 'mymemory'
  translatedAt?: number;       // 翻译时间戳
  thumbnailUrl?: string;
  fileName?: string;
  fileSize?: number;
  isRead: boolean;
  createdAt: Date;
}

export interface CreateSessionInput {
  visitorName?: string;
  sessionId?: string;
  business?: string; // 商家标识(slug)
  businessId?: number; // 商家ID（从域名识别获取）
  customDomain?: string; // 自定义域名
  // 访客自定义字段
  email?: string;
  phone?: string;
  pid?: string; // 跨系统唯一标识
  params?: Record<string, string>; // 自定义参数JSON
  fromUrl?: string; // 进入链接
  referer?: string; // 来源地址
  ip?: string;
  userAgent?: string;
  device?: string;
  lang?: string;
  avatar?: string;
}

export interface SendMessageInput {
  sessionId: string;
  senderType: SenderType;
  contentType: ContentType;
  content: string;
  translatedContent?: string;
  translateEngine?: string;
  thumbnailUrl?: string;
  fileName?: string;
  fileSize?: number;
}

export interface GetMessagesQuery {
  sessionId: string;
  before?: number;
  limit?: number;
}

export interface UploadResponse {
  url: string;
  thumbnailUrl?: string;
  fileName: string;
  fileSize: number;
}

// 排队信息
export interface QueueInfo {
  position: number;
  estimatedWaitMinutes: number;
  totalInQueue: number;
}

// 队列项（客服端用）
export interface QueueItem {
  sessionId: string;
  visitorName: string;
  topic?: string;
  taskStatus: TaskStatus;
  position: number;
  waitMinutes: number;
  createdAt: Date;
}

// ==========================================
// API RESPONSE TYPES
// ==========================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  hasMore: boolean;
  error?: string;
}

export interface AppNotification {
  notificationId: number;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'exam' | 'cie' | 'leave' | 'general' | string;
  linkUrl?: string;
  isRead: boolean;
  sentAt?: string;
  readAt?: string;
  senderId?: number;
  senderName?: string;
  senderProfilePic?: string;
  relatedEntityId?: number;
}

export interface NotificationListResponse {
  code: number;
  data: AppNotification[];
  total: number;
  page: number;
  pageSize: number;
  unreadCount: number;
}

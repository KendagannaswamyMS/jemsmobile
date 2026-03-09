export interface Ticket {
  ticketId: number;
  ticketNumber: string;
  subject: string;
  detail: string;
  status: string;
  priority: string;
  requestType: string;
  departmentName: string;
  requestedBy: string;
  assignedTo: string;
  issueReported: string;
  createdAt: string;
  updatedAt: string;
  conversations?: Conversation[];
  attachments?: Attachment[];
}

export interface Conversation {
  conversationId: number;
  ticketId: number;
  message: string;
  isInternal: boolean;
  senderName: string;
  createdAt: string;
  attachments?: Attachment[];
}

export interface Attachment {
  attachmentId: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
}

export interface DashboardStats {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  myTickets: number;
  assignedToMe: number;
}

export interface CreateTicketDto {
  requestTypeId: number;
  subject: string;
  detail: string;
  departmentId: number;
  priorityId?: number;
  email?: string;
  location?: string;
}

export interface RequestType {
  requestTypeId: number;
  requestTypeName: string;
}

export interface Department {
  departmentId: number;
  departmentName: string;
}

export interface Priority {
  priorityId: number;
  priorityName: string;
}

export interface TicketFilterDto {
  pageNumber?: number;
  pageSize?: number;
  status?: string;
  priority?: string;
  requestTypeId?: number;
  searchTerm?: string;
}

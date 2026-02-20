export type Role = 'CEO' | 'Governor';

export type TaskStatus = 'todo' | 'in-progress' | 'blocked' | 'review' | 'done';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assigneeAgentId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  body: string;
  authorId: string;
  createdAt: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  pod?: string;
  skills: string[];
  status: 'active' | 'idle' | 'offline';
  updatedAt: string;
}

export interface Room {
  id: string;
  kind: 'common' | 'pod';
  name: string;
  pod?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface Milestone {
  id: string;
  title: string;
  detail?: string;
  actorId: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  actorId: string;
  actorRole: Role;
  action: string;
  resourceType: string;
  resourceId?: string;
  createdAt: string;
  ip?: string;
}

export interface RevokedToken {
  id: string;
  tokenId: string;
  revokedAt: string;
  revokedBy: string;
  reason?: string;
}
import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import path from 'node:path';
import { JsonStore } from './lib/store.js';
import { newId, nowIso } from './lib/utils.js';
import type { AgentProfile, Comment, Message, Milestone, Role, Room, Task, TaskStatus } from './types.js';

declare module 'fastify' {
  interface FastifyRequest {
    actor?: { id: string; role: Role };
  }
}

const statusTransitions: Record<TaskStatus, TaskStatus[]> = {
  'todo': ['in-progress', 'blocked'],
  'in-progress': ['blocked', 'review', 'done'],
  'blocked': ['in-progress'],
  'review': ['in-progress', 'done'],
  'done': [],
};

const parseActor = (request: FastifyRequest) => {
  const role = request.headers['x-role'];
  const userId = request.headers['x-user-id'];
  if ((role === 'CEO' || role === 'Governor') && typeof userId === 'string' && userId.length > 0) {
    request.actor = { id: userId, role };
    return;
  }
};

const requireAnyRole = async (request: FastifyRequest, reply: FastifyReply) => {
  parseActor(request);
  if (!request.actor) reply.code(401).send({ error: 'Unauthorized. Provide x-role + x-user-id headers.' });
};

const requireCEO = async (request: FastifyRequest, reply: FastifyReply) => {
  parseActor(request);
  if (!request.actor) return reply.code(401).send({ error: 'Unauthorized. Provide x-role + x-user-id headers.' });
  if (request.actor.role !== 'CEO') return reply.code(403).send({ error: 'Forbidden. CEO role required.' });
};

export async function buildApp(opts?: { dataDir?: string }): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const dataDir = opts?.dataDir ?? path.join(process.cwd(), 'data');

  const tasks = new JsonStore<Task>(path.join(dataDir, 'tasks.json'));
  const comments = new JsonStore<Comment>(path.join(dataDir, 'comments.json'));
  const agents = new JsonStore<AgentProfile>(path.join(dataDir, 'agents.json'));
  const rooms = new JsonStore<Room>(path.join(dataDir, 'rooms.json'));
  const messages = new JsonStore<Message>(path.join(dataDir, 'messages.json'));
  const milestones = new JsonStore<Milestone>(path.join(dataDir, 'milestones.json'));

  await Promise.all([tasks.ensure(), comments.ensure(), agents.ensure(), messages.ensure(), milestones.ensure()]);
  await rooms.ensure([
    { id: 'common', kind: 'common', name: 'Common Room', createdAt: nowIso() },
  ]);

  app.get('/health', async () => ({ ok: true }));

  app.get('/tasks', { preHandler: requireAnyRole }, async (req) => {
    const { status } = req.query as { status?: TaskStatus };
    const all = await tasks.all();
    return status ? all.filter((t) => t.status === status) : all;
  });

  app.post('/tasks', { preHandler: requireAnyRole }, async (req, reply) => {
    const body = req.body as Partial<Task>;
    if (!body?.title) return reply.code(400).send({ error: 'title is required' });
    const now = nowIso();
    const task: Task = {
      id: newId('task'),
      title: body.title,
      description: body.description,
      status: 'todo',
      assigneeAgentId: body.assigneeAgentId,
      createdBy: req.actor!.id,
      createdAt: now,
      updatedAt: now,
    };
    await tasks.insert(task);
    return reply.code(201).send(task);
  });

  app.get('/tasks/:id', { preHandler: requireAnyRole }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const task = await tasks.findById(id);
    if (!task) return reply.code(404).send({ error: 'Task not found' });
    return task;
  });

  app.patch('/tasks/:id', { preHandler: requireAnyRole }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Partial<Task>;
    const existing = await tasks.findById(id);
    if (!existing) return reply.code(404).send({ error: 'Task not found' });

    if (req.actor!.role === 'Governor' && body.status && body.status !== existing.status) {
      return reply.code(403).send({ error: 'Governors must use transition endpoint for status changes.' });
    }

    const updated = await tasks.update(id, {
      title: body.title ?? existing.title,
      description: body.description ?? existing.description,
      assigneeAgentId: body.assigneeAgentId ?? existing.assigneeAgentId,
      updatedAt: nowIso(),
    });

    return updated;
  });

  app.delete('/tasks/:id', { preHandler: requireCEO }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = await tasks.delete(id);
    if (!ok) return reply.code(404).send({ error: 'Task not found' });
    return reply.code(204).send();
  });

  app.post('/tasks/:id/transition', { preHandler: requireAnyRole }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { to?: TaskStatus };
    if (!body?.to) return reply.code(400).send({ error: 'to status is required' });

    const task = await tasks.findById(id);
    if (!task) return reply.code(404).send({ error: 'Task not found' });

    if (!statusTransitions[task.status].includes(body.to)) {
      return reply.code(400).send({ error: `invalid transition ${task.status} -> ${body.to}` });
    }

    if (req.actor!.role === 'Governor' && body.to === 'done') {
      return reply.code(403).send({ error: 'Governors cannot transition directly to done.' });
    }

    const updated = await tasks.update(id, { status: body.to, updatedAt: nowIso() });
    return updated;
  });

  app.get('/tasks/:id/comments', { preHandler: requireAnyRole }, async (req) => {
    const { id } = req.params as { id: string };
    const all = await comments.all();
    return all.filter((c) => c.taskId === id);
  });

  app.post('/tasks/:id/comments', { preHandler: requireAnyRole }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { body?: string };
    const task = await tasks.findById(id);
    if (!task) return reply.code(404).send({ error: 'Task not found' });
    if (!body?.body) return reply.code(400).send({ error: 'body is required' });

    const comment: Comment = {
      id: newId('cmt'),
      taskId: id,
      body: body.body,
      authorId: req.actor!.id,
      createdAt: nowIso(),
    };
    await comments.insert(comment);
    return reply.code(201).send(comment);
  });

  app.get('/agents', { preHandler: requireAnyRole }, async () => agents.all());

  app.post('/agents', { preHandler: requireCEO }, async (req, reply) => {
    const body = req.body as Partial<AgentProfile>;
    if (!body?.name || !body?.role) return reply.code(400).send({ error: 'name and role are required' });
    const agent: AgentProfile = {
      id: newId('agt'),
      name: body.name,
      role: body.role,
      pod: body.pod,
      skills: body.skills ?? [],
      status: body.status ?? 'active',
      updatedAt: nowIso(),
    };
    await agents.insert(agent);
    return reply.code(201).send(agent);
  });

  app.get('/agents/:id', { preHandler: requireAnyRole }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = await agents.findById(id);
    if (!agent) return reply.code(404).send({ error: 'Agent not found' });
    return agent;
  });

  app.patch('/agents/:id', { preHandler: requireAnyRole }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Partial<AgentProfile>;
    const existing = await agents.findById(id);
    if (!existing) return reply.code(404).send({ error: 'Agent not found' });

    if (req.actor!.role === 'Governor' && req.actor!.id !== id) {
      return reply.code(403).send({ error: 'Governors can only edit their own profile.' });
    }

    const updated = await agents.update(id, {
      name: body.name ?? existing.name,
      role: body.role ?? existing.role,
      pod: body.pod ?? existing.pod,
      skills: body.skills ?? existing.skills,
      status: body.status ?? existing.status,
      updatedAt: nowIso(),
    });
    return updated;
  });

  app.get('/rooms', { preHandler: requireAnyRole }, async () => rooms.all());

  app.post('/rooms', { preHandler: requireCEO }, async (req, reply) => {
    const body = req.body as Partial<Room>;
    if (!body?.name || !body?.kind) return reply.code(400).send({ error: 'name and kind are required' });
    if (body.kind === 'pod' && !body.pod) return reply.code(400).send({ error: 'pod is required for pod room' });
    const room: Room = {
      id: newId('room'),
      kind: body.kind,
      name: body.name,
      pod: body.pod,
      createdAt: nowIso(),
    };
    await rooms.insert(room);
    return reply.code(201).send(room);
  });

  app.get('/rooms/:id/messages', { preHandler: requireAnyRole }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const room = await rooms.findById(id);
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    const all = await messages.all();
    return all.filter((m) => m.roomId === id);
  });

  app.post('/rooms/:id/messages', { preHandler: requireAnyRole }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { body?: string };
    const room = await rooms.findById(id);
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    if (!body?.body) return reply.code(400).send({ error: 'body is required' });
    const msg: Message = {
      id: newId('msg'),
      roomId: id,
      senderId: req.actor!.id,
      body: body.body,
      createdAt: nowIso(),
    };
    await messages.insert(msg);
    return reply.code(201).send(msg);
  });

  app.get('/milestones', { preHandler: requireAnyRole }, async () => milestones.all());

  app.post('/milestones', { preHandler: requireAnyRole }, async (req, reply) => {
    const body = req.body as Partial<Milestone>;
    if (!body?.title) return reply.code(400).send({ error: 'title is required' });
    const ms: Milestone = {
      id: newId('ms'),
      title: body.title,
      detail: body.detail,
      actorId: req.actor!.id,
      createdAt: nowIso(),
    };
    await milestones.insert(ms);
    return reply.code(201).send(ms);
  });

  return app;
}

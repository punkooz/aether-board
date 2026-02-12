import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import path from 'node:path';
import { JsonStore } from './lib/store.js';
import { newId, nowIso } from './lib/utils.js';
import type { AgentProfile, AuditEvent, Comment, Message, Milestone, Role, Room, Task, TaskStatus } from './types.js';

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

const setActor = (request: FastifyRequest) => {
  const userId = request.headers['x-user-id'];
  const role = request.headers['x-role'];
  const id = typeof userId === 'string' && userId.length > 0 ? userId : 'system';
  const parsedRole: Role = role === 'Governor' ? 'Governor' : 'CEO';
  request.actor = { id, role: parsedRole };
};

const requireAdmin = async (request: FastifyRequest, reply: FastifyReply) => {
  setActor(request);
  const auth = request.headers.authorization;
  const expected = process.env.ADMIN_TOKEN;

  if (!expected || expected.length < 20) {
    return reply.code(503).send({ error: 'Admin mode unavailable: ADMIN_TOKEN not configured.' });
  }

  if (!auth || !auth.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Unauthorized. Bearer token required.' });
  }

  const provided = auth.slice('Bearer '.length).trim();
  if (provided !== expected) {
    return reply.code(403).send({ error: 'Forbidden. Invalid admin token.' });
  }
};

const cleanText = (value: unknown, field: string, max = 500) => {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const v = value.trim();
  if (!v) throw new Error(`${field} is required`);
  if (v.length > max) throw new Error(`${field} too long (max ${max})`);
  return v;
};

const createRateLimit = (max: number, windowMs: number) => {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const key = `${request.ip}:${request.url}`;
    const now = Date.now();
    const existing = hits.get(key);

    if (!existing || now > existing.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    if (existing.count >= max) {
      return reply.code(429).send({ error: 'Too many requests' });
    }

    existing.count += 1;
  };
};

const writeRateLimit = createRateLimit(80, 60_000);

export async function buildApp(opts?: { dataDir?: string }): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, trustProxy: true });
  const dataDir = opts?.dataDir ?? path.join(process.cwd(), 'data');

  const tasks = new JsonStore<Task>(path.join(dataDir, 'tasks.json'));
  const comments = new JsonStore<Comment>(path.join(dataDir, 'comments.json'));
  const agents = new JsonStore<AgentProfile>(path.join(dataDir, 'agents.json'));
  const rooms = new JsonStore<Room>(path.join(dataDir, 'rooms.json'));
  const messages = new JsonStore<Message>(path.join(dataDir, 'messages.json'));
  const milestones = new JsonStore<Milestone>(path.join(dataDir, 'milestones.json'));
  const audits = new JsonStore<AuditEvent>(path.join(dataDir, 'audits.json'));

  const writeAudit = async (request: FastifyRequest, action: string, resourceType: string, resourceId?: string) => {
    if (!request.actor) return;
    await audits.insert({
      id: newId('audit'),
      actorId: request.actor.id,
      actorRole: request.actor.role,
      action,
      resourceType,
      resourceId,
      createdAt: nowIso(),
      ip: request.ip,
    });
  };

  await Promise.all([
    tasks.ensure(),
    comments.ensure(),
    agents.ensure(),
    messages.ensure(),
    milestones.ensure(),
    audits.ensure(),
  ]);

  await rooms.ensure([{ id: 'common', kind: 'common', name: 'Common Room', createdAt: nowIso() }]);

  app.get('/health', async () => ({ ok: true }));

  app.get('/tasks', async (req) => {
    const { status } = req.query as { status?: TaskStatus };
    const all = await tasks.all();
    return status ? all.filter((t) => t.status === status) : all;
  });

  app.post('/tasks', { preHandler: [writeRateLimit, requireAdmin] }, async (req, reply) => {
    try {
      const body = (req.body ?? {}) as Partial<Task>;
      const title = cleanText(body.title, 'title', 120);
      const description = body.description ? cleanText(body.description, 'description', 2000) : undefined;
      const now = nowIso();
      const task: Task = {
        id: newId('task'),
        title,
        description,
        status: 'todo',
        assigneeAgentId: typeof body.assigneeAgentId === 'string' ? body.assigneeAgentId : undefined,
        createdBy: req.actor!.id,
        createdAt: now,
        updatedAt: now,
      };
      await tasks.insert(task);
      await writeAudit(req, 'create', 'task', task.id);
      return reply.code(201).send(task);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.get('/tasks/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const task = await tasks.findById(id);
    if (!task) return reply.code(404).send({ error: 'Task not found' });
    return task;
  });

  app.patch('/tasks/:id', { preHandler: [writeRateLimit, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Partial<Task>;
    const existing = await tasks.findById(id);
    if (!existing) return reply.code(404).send({ error: 'Task not found' });

    const updated = await tasks.update(id, {
      title: typeof body.title === 'string' ? cleanText(body.title, 'title', 120) : existing.title,
      description: typeof body.description === 'string' ? cleanText(body.description, 'description', 2000) : existing.description,
      assigneeAgentId: body.assigneeAgentId ?? existing.assigneeAgentId,
      updatedAt: nowIso(),
    });
    await writeAudit(req, 'update', 'task', id);
    return updated;
  });

  app.delete('/tasks/:id', { preHandler: [writeRateLimit, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const ok = await tasks.delete(id);
    if (!ok) return reply.code(404).send({ error: 'Task not found' });
    await writeAudit(req, 'delete', 'task', id);
    return reply.code(204).send();
  });

  app.post('/tasks/:id/transition', { preHandler: [writeRateLimit, requireAdmin] }, async (req, reply) => {
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
    await writeAudit(req, 'transition', 'task', id);
    return updated;
  });

  app.get('/tasks/:id/comments', async (req) => {
    const { id } = req.params as { id: string };
    const all = await comments.all();
    return all.filter((c) => c.taskId === id);
  });

  app.post('/tasks/:id/comments', { preHandler: [writeRateLimit, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { body?: string };
    const task = await tasks.findById(id);
    if (!task) return reply.code(404).send({ error: 'Task not found' });
    if (!body?.body) return reply.code(400).send({ error: 'body is required' });

    const comment: Comment = {
      id: newId('cmt'),
      taskId: id,
      body: cleanText(body.body, 'body', 2000),
      authorId: req.actor!.id,
      createdAt: nowIso(),
    };
    await comments.insert(comment);
    await writeAudit(req, 'comment', 'task', id);
    return reply.code(201).send(comment);
  });

  app.get('/agents', async () => agents.all());

  app.post('/agents', { preHandler: [writeRateLimit, requireAdmin] }, async (req, reply) => {
    const body = req.body as Partial<AgentProfile>;
    if (!body?.name || !body?.role) return reply.code(400).send({ error: 'name and role are required' });
    const agent: AgentProfile = {
      id: newId('agt'),
      name: cleanText(body.name, 'name', 120),
      role: cleanText(body.role, 'role', 120),
      pod: typeof body.pod === 'string' ? body.pod : undefined,
      skills: Array.isArray(body.skills) ? body.skills.slice(0, 20) : [],
      status: body.status ?? 'active',
      updatedAt: nowIso(),
    };
    await agents.insert(agent);
    await writeAudit(req, 'create', 'agent', agent.id);
    return reply.code(201).send(agent);
  });

  app.get('/agents/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = await agents.findById(id);
    if (!agent) return reply.code(404).send({ error: 'Agent not found' });
    return agent;
  });

  app.patch('/agents/:id', { preHandler: [writeRateLimit, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Partial<AgentProfile>;
    const existing = await agents.findById(id);
    if (!existing) return reply.code(404).send({ error: 'Agent not found' });

    if (req.actor!.role === 'Governor' && req.actor!.id !== id) {
      return reply.code(403).send({ error: 'Governors can only edit their own profile.' });
    }

    const updated = await agents.update(id, {
      name: typeof body.name === 'string' ? cleanText(body.name, 'name', 120) : existing.name,
      role: typeof body.role === 'string' ? cleanText(body.role, 'role', 120) : existing.role,
      pod: body.pod ?? existing.pod,
      skills: body.skills ?? existing.skills,
      status: body.status ?? existing.status,
      updatedAt: nowIso(),
    });
    await writeAudit(req, 'update', 'agent', id);
    return updated;
  });

  app.get('/rooms', async () => rooms.all());

  app.post('/rooms', { preHandler: [writeRateLimit, requireAdmin] }, async (req, reply) => {
    const body = req.body as Partial<Room>;
    if (!body?.name || !body?.kind) return reply.code(400).send({ error: 'name and kind are required' });
    if (body.kind === 'pod' && !body.pod) return reply.code(400).send({ error: 'pod is required for pod room' });
    const room: Room = {
      id: newId('room'),
      kind: body.kind,
      name: cleanText(body.name, 'name', 120),
      pod: body.pod,
      createdAt: nowIso(),
    };
    await rooms.insert(room);
    await writeAudit(req, 'create', 'room', room.id);
    return reply.code(201).send(room);
  });

  app.get('/rooms/:id/messages', async (req, reply) => {
    const { id } = req.params as { id: string };
    const room = await rooms.findById(id);
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    const all = await messages.all();
    return all.filter((m) => m.roomId === id);
  });

  app.post('/rooms/:id/messages', { preHandler: [writeRateLimit, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { body?: string };
    const room = await rooms.findById(id);
    if (!room) return reply.code(404).send({ error: 'Room not found' });
    if (!body?.body) return reply.code(400).send({ error: 'body is required' });
    const msg: Message = {
      id: newId('msg'),
      roomId: id,
      senderId: req.actor!.id,
      body: cleanText(body.body, 'body', 2000),
      createdAt: nowIso(),
    };
    await messages.insert(msg);
    await writeAudit(req, 'message', 'room', id);
    return reply.code(201).send(msg);
  });

  app.get('/milestones', async () => milestones.all());

  app.post('/milestones', { preHandler: [writeRateLimit, requireAdmin] }, async (req, reply) => {
    const body = req.body as Partial<Milestone>;
    if (!body?.title) return reply.code(400).send({ error: 'title is required' });
    const ms: Milestone = {
      id: newId('ms'),
      title: cleanText(body.title, 'title', 200),
      detail: typeof body.detail === 'string' ? cleanText(body.detail, 'detail', 2000) : undefined,
      actorId: req.actor!.id,
      createdAt: nowIso(),
    };
    await milestones.insert(ms);
    await writeAudit(req, 'create', 'milestone', ms.id);
    return reply.code(201).send(ms);
  });

  app.get('/audits', { preHandler: requireAdmin }, async () => audits.all());

  return app;
}

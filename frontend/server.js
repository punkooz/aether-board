#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname;

const PORT = Number(process.env.PORT || 5173);
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
const USE_MOCK = process.env.USE_MOCK === '1';

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const mock = {
  tasks: [
    { id: 't-1', title: 'Design onboarding', assigneeAgentId: 'agent-ui', status: 'todo', priority: 'high', updatedAt: Date.now(), createdAt: Date.now(), createdBy: 'ceo', description: 'Draft first-run user flow.' },
    { id: 't-2', title: 'Integrate API auth', assigneeAgentId: 'agent-be', status: 'in-progress', priority: 'high', updatedAt: Date.now(), createdAt: Date.now(), createdBy: 'ceo', description: 'Wire token refresh + retry.' },
    { id: 't-3', title: 'Fix flaky sync job', assigneeAgentId: 'agent-ops', status: 'blocked', priority: 'critical', updatedAt: Date.now(), createdAt: Date.now(), createdBy: 'ceo', description: 'Waiting on infra access.' },
    { id: 't-4', title: 'Release prep', assigneeAgentId: 'agent-pm', status: 'review', priority: 'medium', updatedAt: Date.now(), createdAt: Date.now(), createdBy: 'ceo', description: 'CEO final checklist pass.' },
    { id: 't-5', title: 'Retrospective notes', assigneeAgentId: 'agent-pm', status: 'done', priority: 'low', updatedAt: Date.now(), createdAt: Date.now(), createdBy: 'ceo', description: 'Capture lessons learned.' }
  ],
  comments: {
    't-2': [
      { authorId: 'agent-be', body: 'Auth middleware merged.', createdAt: Date.now() - 7200000 },
      { authorId: 'agent-qa', body: 'Smoke test passes in staging.', createdAt: Date.now() - 3600000 }
    ]
  },
  agents: [
    { id: 'agent-ui', name: 'Astra', role: 'Frontend', status: 'active', summary: 'Builds UI and design systems.', room: 'room-product' },
    { id: 'agent-be', name: 'Forge', role: 'Backend', status: 'active', summary: 'Owns APIs and data services.', room: 'room-eng' },
    { id: 'agent-ops', name: 'Helm', role: 'SRE', status: 'blocked', summary: 'Monitors reliability and deploys.', room: 'room-ops' }
  ],
  rooms: [
    { id: 'room-eng', name: 'Engineering' },
    { id: 'room-product', name: 'Product' },
    { id: 'room-ops', name: 'Operations' }
  ],
  feed: {
    'room-eng': [
      { senderId: 'Forge', body: 'API latency down 12%.', createdAt: Date.now() - 400000 },
      { senderId: 'Astra', body: 'Task detail panel ready for QA.', createdAt: Date.now() - 100000 }
    ]
  },
  milestones: [
    { id: 'm-1', title: 'MVP board launch', actorId: 'ceo', createdAt: Date.now() - 1000000, detail: 'Core views complete.' },
    { id: 'm-2', title: 'CEO sign-off', actorId: 'ceo', createdAt: Date.now() - 500000, detail: 'Waiting for review queue clearance.' }
  ]
};

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type });
  res.end(type.includes('application/json') ? JSON.stringify(body) : body);
}

function serveStatic(req, res) {
  const reqPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const full = path.normalize(path.join(root, reqPath));
  if (!full.startsWith(root)) return send(res, 403, 'Forbidden', 'text/plain');

  fs.readFile(full, (err, data) => {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    const ext = path.extname(full).toLowerCase();
    send(res, 200, data, contentTypes[ext] || 'application/octet-stream');
  });
}

function handleMock(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  if (p === '/api/tasks') {
    const status = url.searchParams.get('status');
    const data = status ? mock.tasks.filter((t) => t.status === status) : mock.tasks;
    return send(res, 200, data);
  }
  if (p.startsWith('/api/tasks/') && p.endsWith('/comments')) {
    const id = p.split('/')[3];
    return send(res, 200, mock.comments[id] || []);
  }
  if (p.startsWith('/api/tasks/')) {
    const id = p.split('/')[3];
    const task = mock.tasks.find((t) => t.id === id);
    return task ? send(res, 200, task) : send(res, 404, { error: 'Not found' });
  }
  if (p === '/api/agents') return send(res, 200, mock.agents);
  if (p === '/api/rooms') return send(res, 200, mock.rooms);
  if (p.startsWith('/api/rooms/') && p.endsWith('/messages')) {
    const id = p.split('/')[3];
    return send(res, 200, mock.feed[id] || []);
  }
  if (p === '/api/milestones') return send(res, 200, mock.milestones);
  return send(res, 404, { error: 'Unknown endpoint' });
}

async function handleProxy(req, res) {
  const proxiedPath = req.url.startsWith('/api/') ? req.url.slice(4) : req.url;
  const target = new URL(proxiedPath, BACKEND_URL);
  const body = await new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });

  const proxyRes = await fetch(target, {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : body
  });

  const buf = Buffer.from(await proxyRes.arrayBuffer());
  const headers = Object.fromEntries(proxyRes.headers.entries());
  delete headers['content-encoding'];
  headers['content-length'] = String(buf.length);
  res.writeHead(proxyRes.status, headers);
  res.end(buf);
}

http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) {
      if (USE_MOCK) return handleMock(req, res);
      return await handleProxy(req, res);
    }
    serveStatic(req, res);
  } catch (err) {
    send(res, 500, { error: err.message });
  }
}).listen(PORT, () => {
  console.log(`AetherBoard frontend running on http://localhost:${PORT}`);
  console.log(USE_MOCK ? 'Using built-in mock API' : `Proxying /api to ${BACKEND_URL}`);
});

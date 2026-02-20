import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { buildApp } from '../src/app.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

const coreSecret = 'core-secret-123';
const auditSecret = 'audit-secret-123';
const managerSecret = 'manager-secret-123';
const expiredSecret = 'expired-secret-123';

const coreToken = `core-write.${coreSecret}`;
const auditToken = `audit-read.${auditSecret}`;
const managerToken = `auth-manager.${managerSecret}`;
const expiredToken = `expired.${expiredSecret}`;

const ceoHeaders = { 'x-role': 'CEO', 'x-user-id': 'ceo-1', authorization: `Bearer ${coreToken}` };
const govHeaders = { 'x-role': 'Governor', 'x-user-id': 'gov-1', authorization: `Bearer ${coreToken}` };

let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'aetherboard-'));
  process.env.ADMIN_TOKENS = JSON.stringify([
    {
      id: 'core-write',
      secretHash: hash(coreSecret),
      expiresAt: '2099-01-01T00:00:00.000Z',
      scopes: ['write:*'],
      roleScopes: ['CEO', 'Governor'],
    },
    {
      id: 'audit-read',
      secretHash: hash(auditSecret),
      expiresAt: '2099-01-01T00:00:00.000Z',
      scopes: ['read:audit'],
      roleScopes: ['CEO'],
    },
    {
      id: 'auth-manager',
      secretHash: hash(managerSecret),
      expiresAt: '2099-01-01T00:00:00.000Z',
      scopes: ['auth:manage'],
      roleScopes: ['CEO'],
    },
    {
      id: 'expired',
      secretHash: hash(expiredSecret),
      expiresAt: '2000-01-01T00:00:00.000Z',
      scopes: ['write:*'],
      roleScopes: ['CEO'],
    },
  ]);
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
  delete process.env.ADMIN_TOKENS;
  delete process.env.TRUSTED_PROXIES;
});

describe('aetherboard backend auth remediation', () => {
  it('allows public reads but protects writes', async () => {
    const app = await buildApp({ dataDir });
    const read = await app.inject({ method: 'GET', url: '/tasks' });
    expect(read.statusCode).toBe(200);

    const write = await app.inject({
      method: 'POST',
      url: '/tasks',
      payload: { title: 'unauthorized create' },
    });
    expect(write.statusCode).toBe(401);
    await app.close();
  });

  it('supports task lifecycle + comments with scoped write token', async () => {
    const app = await buildApp({ dataDir });

    const create = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: ceoHeaders,
      payload: { title: 'Ship MVP' },
    });

    expect(create.statusCode).toBe(201);
    const task = create.json();

    const transition = await app.inject({
      method: 'POST',
      url: `/tasks/${task.id}/transition`,
      headers: govHeaders,
      payload: { to: 'in-progress' },
    });

    expect(transition.statusCode).toBe(200);
    expect(transition.json().status).toBe('in-progress');

    const comment = await app.inject({
      method: 'POST',
      url: `/tasks/${task.id}/comments`,
      headers: govHeaders,
      payload: { body: 'Working on it' },
    });

    expect(comment.statusCode).toBe(201);

    const listComments = await app.inject({
      method: 'GET',
      url: `/tasks/${task.id}/comments`,
    });

    expect(listComments.statusCode).toBe(200);
    expect(listComments.json()).toHaveLength(1);

    await app.close();
  });

  it('enforces token role scope, permission scope, expiry, and revocation', async () => {
    const app = await buildApp({ dataDir });

    const createTask = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: ceoHeaders,
      payload: { title: 'Rotate auth' },
    });
    expect(createTask.statusCode).toBe(201);

    const governorAuditRead = await app.inject({
      method: 'GET',
      url: '/audits',
      headers: { 'x-role': 'Governor', 'x-user-id': 'gov-1', authorization: `Bearer ${auditToken}` },
    });
    expect(governorAuditRead.statusCode).toBe(403);

    const ceoAuditRead = await app.inject({
      method: 'GET',
      url: '/audits',
      headers: { 'x-role': 'CEO', 'x-user-id': 'ceo-1', authorization: `Bearer ${auditToken}` },
    });
    expect(ceoAuditRead.statusCode).toBe(200);

    const missingScopeWrite = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { 'x-role': 'CEO', 'x-user-id': 'ceo-1', authorization: `Bearer ${auditToken}` },
      payload: { title: 'should fail' },
    });
    expect(missingScopeWrite.statusCode).toBe(403);

    const expired = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: { 'x-role': 'CEO', 'x-user-id': 'ceo-1', authorization: `Bearer ${expiredToken}` },
      payload: { title: 'expired token' },
    });
    expect(expired.statusCode).toBe(403);

    const revoke = await app.inject({
      method: 'POST',
      url: '/auth/tokens/core-write/revoke',
      headers: { 'x-role': 'CEO', 'x-user-id': 'ceo-1', authorization: `Bearer ${managerToken}` },
      payload: { reason: 'rotation test' },
    });
    expect(revoke.statusCode).toBe(201);

    const afterRevoke = await app.inject({
      method: 'POST',
      url: '/tasks',
      headers: ceoHeaders,
      payload: { title: 'rejected after revoke' },
    });
    expect(afterRevoke.statusCode).toBe(403);

    await app.close();
  });

  it('ignores spoofed X-Forwarded-For by default (safe fallback)', async () => {
    const app = await buildApp({ dataDir });

    const createRoom = async (xff: string, index: number) => app.inject({
      method: 'POST',
      url: '/rooms',
      headers: {
        ...ceoHeaders,
        'x-forwarded-for': xff,
      },
      payload: { name: `rl-safe-${index}`, kind: 'pod', pod: 'alpha' },
    });

    for (let i = 0; i < 80; i += 1) {
      const res = await createRoom(`${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}.10.10`, i);
      expect(res.statusCode).toBe(201);
    }

    const blocked = await createRoom('198.51.100.10', 999);
    expect(blocked.statusCode).toBe(429);

    const spoofedStillBlocked = await createRoom('198.51.100.11', 1000);
    expect(spoofedStillBlocked.statusCode).toBe(429);

    await app.close();
  });

  it('uses forwarded client IP only when trusted proxies are explicitly configured', async () => {
    process.env.TRUSTED_PROXIES = '127.0.0.1';
    const app = await buildApp({ dataDir });

    const createRoom = async (xff: string, index: number) => app.inject({
      method: 'POST',
      url: '/rooms',
      headers: {
        ...ceoHeaders,
        'x-forwarded-for': xff,
      },
      payload: { name: `rl-trust-${index}`, kind: 'pod', pod: 'beta' },
    });

    for (let i = 0; i < 80; i += 1) {
      const res = await createRoom('198.51.100.10', i);
      expect(res.statusCode).toBe(201);
    }

    const blocked = await createRoom('198.51.100.10', 999);
    expect(blocked.statusCode).toBe(429);

    const otherClient = await createRoom('198.51.100.11', 1000);
    expect(otherClient.statusCode).toBe(201);

    await app.close();
  });
});

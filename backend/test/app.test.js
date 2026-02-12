import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { buildApp } from '../src/app.js';
const ceoHeaders = { 'x-role': 'CEO', 'x-user-id': 'ceo-1' };
const govHeaders = { 'x-role': 'Governor', 'x-user-id': 'gov-1' };
let dataDir;
beforeEach(async () => {
    dataDir = await mkdtemp(path.join(os.tmpdir(), 'aetherboard-'));
});
afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
});
describe('aetherboard backend', () => {
    it('requires auth headers', async () => {
        const app = await buildApp({ dataDir });
        const res = await app.inject({ method: 'GET', url: '/tasks' });
        expect(res.statusCode).toBe(401);
        await app.close();
    });
    it('supports task lifecycle + comments', async () => {
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
            payload: { to: 'in_progress' },
        });
        expect(transition.statusCode).toBe(200);
        expect(transition.json().status).toBe('in_progress');
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
            headers: govHeaders,
        });
        expect(listComments.statusCode).toBe(200);
        expect(listComments.json()).toHaveLength(1);
        await app.close();
    });
    it('supports agents, rooms/messages and milestones', async () => {
        const app = await buildApp({ dataDir });
        const createAgent = await app.inject({
            method: 'POST',
            url: '/agents',
            headers: ceoHeaders,
            payload: { name: 'Aegis', role: 'Coordinator', skills: ['planning'] },
        });
        expect(createAgent.statusCode).toBe(201);
        const createRoom = await app.inject({
            method: 'POST',
            url: '/rooms',
            headers: ceoHeaders,
            payload: { name: 'Pod Alpha', kind: 'pod', pod: 'alpha' },
        });
        expect(createRoom.statusCode).toBe(201);
        const room = createRoom.json();
        const sendMsg = await app.inject({
            method: 'POST',
            url: `/rooms/${room.id}/messages`,
            headers: govHeaders,
            payload: { body: 'Sync at 10' },
        });
        expect(sendMsg.statusCode).toBe(201);
        const createMilestone = await app.inject({
            method: 'POST',
            url: '/milestones',
            headers: ceoHeaders,
            payload: { title: 'Kickoff complete' },
        });
        expect(createMilestone.statusCode).toBe(201);
        const listMilestones = await app.inject({
            method: 'GET',
            url: '/milestones',
            headers: govHeaders,
        });
        expect(listMilestones.statusCode).toBe(200);
        expect(listMilestones.json()).toHaveLength(1);
        await app.close();
    });
});

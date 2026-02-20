import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '../types.js';

export interface AuthTokenConfig {
  id: string;
  secretHash: string;
  expiresAt: string;
  scopes: string[];
  roleScopes: Role[];
}

interface RevokedTokenRecord {
  id: string;
  tokenId: string;
  revokedAt: string;
  reason?: string;
}

interface AuthContext {
  tokenId: string;
  scopes: string[];
  roleScopes: Role[];
}

const ROLE_VALUES: Role[] = ['CEO', 'Governor'];

const parseRole = (value: unknown): Role => (value === 'Governor' ? 'Governor' : 'CEO');

const hashSecret = (secret: string): string => createHash('sha256').update(secret).digest('hex');

const secureHexEqual = (left: string, right: string): boolean => {
  const leftBuf = Buffer.from(left, 'hex');
  const rightBuf = Buffer.from(right, 'hex');
  if (leftBuf.length !== rightBuf.length) return false;
  return timingSafeEqual(leftBuf, rightBuf);
};

const parseTokenEnvelope = (raw: string): { tokenId: string; secret: string } | null => {
  const trimmed = raw.trim();
  const splitIndex = trimmed.indexOf('.');
  if (splitIndex <= 0 || splitIndex === trimmed.length - 1) return null;
  return {
    tokenId: trimmed.slice(0, splitIndex),
    secret: trimmed.slice(splitIndex + 1),
  };
};

const parseTokenConfig = (value: unknown): AuthTokenConfig[] => {
  if (!Array.isArray(value)) throw new Error('ADMIN_TOKENS must be a JSON array');

  return value.map((token, index) => {
    if (!token || typeof token !== 'object') throw new Error(`ADMIN_TOKENS[${index}] must be an object`);

    const typed = token as Partial<AuthTokenConfig>;
    const id = typeof typed.id === 'string' ? typed.id.trim() : '';
    const secretHash = typeof typed.secretHash === 'string' ? typed.secretHash.trim().toLowerCase() : '';
    const expiresAt = typeof typed.expiresAt === 'string' ? typed.expiresAt.trim() : '';
    const scopes = Array.isArray(typed.scopes) ? typed.scopes.filter((scope): scope is string => typeof scope === 'string' && scope.length > 0) : [];
    const roleScopes = Array.isArray(typed.roleScopes)
      ? typed.roleScopes.filter((role): role is Role => ROLE_VALUES.includes(role as Role))
      : [];

    if (!id) throw new Error(`ADMIN_TOKENS[${index}].id is required`);
    if (!/^[a-f0-9]{64}$/.test(secretHash)) throw new Error(`ADMIN_TOKENS[${index}].secretHash must be sha256 hex`);
    if (!expiresAt || Number.isNaN(Date.parse(expiresAt))) throw new Error(`ADMIN_TOKENS[${index}].expiresAt must be ISO-8601`);
    if (scopes.length === 0) throw new Error(`ADMIN_TOKENS[${index}].scopes must include at least one scope`);
    if (roleScopes.length === 0) throw new Error(`ADMIN_TOKENS[${index}].roleScopes must include at least one role`);

    return { id, secretHash, expiresAt, scopes, roleScopes };
  });
};

const hasScope = (granted: string[], required: string): boolean => {
  if (granted.includes(required)) return true;
  const [requiredResource] = required.split(':');
  return granted.includes(`${requiredResource}:*`);
};

export const parseAdminTokensFromEnv = (): AuthTokenConfig[] => {
  const raw = process.env.ADMIN_TOKENS;
  if (!raw) throw new Error('Admin mode unavailable: ADMIN_TOKENS not configured.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Admin mode unavailable: ADMIN_TOKENS must be valid JSON.');
  }

  const tokens = parseTokenConfig(parsed);
  if (tokens.length === 0) throw new Error('Admin mode unavailable: ADMIN_TOKENS has no active token definitions.');
  return tokens;
};

export const buildRequireAuth = (
  tokens: AuthTokenConfig[],
  listRevokedTokenIds: () => Promise<string[]>,
) => {
  const tokenMap = new Map(tokens.map((token) => [token.id, token]));

  return (requiredScope: string) => async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.headers['x-user-id'];
    const roleHeader = request.headers['x-role'];
    const actorRole = parseRole(roleHeader);
    const actorId = typeof userId === 'string' && userId.length > 0 ? userId : 'system';
    request.actor = { id: actorId, role: actorRole };

    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized. Bearer token required.' });
    }

    const envelope = parseTokenEnvelope(auth.slice('Bearer '.length));
    if (!envelope) {
      return reply.code(401).send({ error: 'Unauthorized. Token format must be <tokenId>.<secret>.' });
    }

    const token = tokenMap.get(envelope.tokenId);
    if (!token) {
      return reply.code(403).send({ error: 'Forbidden. Unknown token id.' });
    }

    if (Date.now() >= Date.parse(token.expiresAt)) {
      return reply.code(403).send({ error: 'Forbidden. Token expired.' });
    }

    const revokedTokenIds = await listRevokedTokenIds();
    if (revokedTokenIds.includes(token.id)) {
      return reply.code(403).send({ error: 'Forbidden. Token revoked.' });
    }

    const providedHash = hashSecret(envelope.secret);
    if (!secureHexEqual(providedHash, token.secretHash)) {
      return reply.code(403).send({ error: 'Forbidden. Invalid token secret.' });
    }

    if (!token.roleScopes.includes(actorRole)) {
      return reply.code(403).send({ error: `Forbidden. Token not scoped for role ${actorRole}.` });
    }

    if (!hasScope(token.scopes, requiredScope)) {
      return reply.code(403).send({ error: `Forbidden. Missing required scope: ${requiredScope}.` });
    }

    request.auth = {
      tokenId: token.id,
      scopes: token.scopes,
      roleScopes: token.roleScopes,
    } satisfies AuthContext;
  };
};

export const isRevokeRecord = (record: unknown): record is RevokedTokenRecord => {
  if (!record || typeof record !== 'object') return false;
  const typed = record as Partial<RevokedTokenRecord>;
  return typeof typed.id === 'string' && typeof typed.tokenId === 'string' && typeof typed.revokedAt === 'string';
};

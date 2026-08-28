import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';

export interface AccessTokenPayload {
  sub: string;
  role: 'USER' | 'ADMIN';
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtAccessExpiresIn as any });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtSecret) as AccessTokenPayload;
}

// A JWT's `iat` claim only has second granularity, so two refresh tokens
// minted for the same user within the same second would otherwise be byte
// identical — and their SHA-256 hashes would collide on RefreshToken's
// unique index (a double-clicked login was enough to trigger it). The random
// `jti` makes every issued token unique, and doubles as a standard token id.
export function signRefreshToken(payload: { sub: string }): string {
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn as any,
  });
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.jwtRefreshSecret) as { sub: string };
}

// Refresh tokens are stored server-side hashed, never in plaintext,
// so a leaked database dump alone cannot be replayed as a valid token.
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

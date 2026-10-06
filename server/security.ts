import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const digest = scryptSync(password, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
  return `scrypt:${salt.toString('base64url')}:${digest.toString('base64url')}`;
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  if (passwordHash.startsWith('sha256:')) return hashLegacyPassword(password) === passwordHash;
  const [scheme, saltText, digestText] = passwordHash.split(':');
  if (scheme !== 'scrypt' || !saltText || !digestText) return false;
  try {
    const salt = Buffer.from(saltText, 'base64url');
    const expected = Buffer.from(digestText, 'base64url');
    const actual = scryptSync(password, salt, expected.length, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function needsPasswordRehash(passwordHash: string): boolean {
  return passwordHash.startsWith('sha256:');
}

function hashLegacyPassword(password: string): string {
  return `sha256:${createHash('sha256').update(password).digest('hex')}`;
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export function now(): string {
  return new Date().toISOString();
}

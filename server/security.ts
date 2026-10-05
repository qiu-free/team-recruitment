import { createHash, randomUUID } from 'node:crypto';

export function hashPassword(password: string): string {
  return `sha256:${createHash('sha256').update(password).digest('hex')}`;
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  return hashPassword(password) === passwordHash;
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export function now(): string {
  return new Date().toISOString();
}

import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { timingSafeEqualText } from './crypto';

const COOKIE_NAME = 'qabum_agreements_admin';
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function secret(): string {
  const value = process.env.QABUM_AGREEMENTS_ADMIN_SECRET;
  if (!value) throw new Error('QABUM_AGREEMENTS_ADMIN_SECRET is not configured');
  return value;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.QABUM_AGREEMENTS_ADMIN_PASSWORD;
  return Boolean(expected) && timingSafeEqualText(password, expected as string);
}

export function issueAdminSession(res: NextApiResponse): void {
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ sub: 'carlos', exp: expires })).toString('base64url');
  const token = `${payload}.${sign(payload)}`;
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`,
  );
}

export function clearAdminSession(res: NextApiResponse): void {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  );
}

function readCookie(req: NextApiRequest, name: string): string | null {
  const cookie = req.headers.cookie || '';
  for (const part of cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

export function hasValidAdminSession(req: NextApiRequest): boolean {
  try {
    const token = readCookie(req, COOKIE_NAME);
    if (!token) return false;
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return false;
    if (!timingSafeEqualText(signature, sign(payload))) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data?.sub === 'carlos' && Number(data?.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

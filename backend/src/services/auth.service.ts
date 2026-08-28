import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { hashPassword, verifyPassword } from '../utils/password';
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { env } from '../config/env';
import ms from './ms';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export interface AuthResult {
  user: { id: string; username: string; email: string; role: 'USER' | 'ADMIN' };
  accessToken: string;
  refreshToken: string;
}

export async function register(input: { username: string; email: string; password: string }): Promise<AuthResult> {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
    select: { id: true },
  });
  if (existing) {
    throw ApiError.conflict('Użytkownik z takim adresem e-mail lub nazwą już istnieje');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: { username: input.username, email: input.email, passwordHash },
  });

  return issueTokens(user.id, user.username, user.email, user.role);
}

export async function login(input: { email: string; password: string }): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Same generic error whether the account doesn't exist or the password is
  // wrong, so the endpoint can't be used to enumerate registered emails.
  const genericError = () => ApiError.unauthorized('Nieprawidłowy e-mail lub hasło');

  if (!user) {
    // Still hash something to keep response timing close to the real path.
    await verifyPassword('$argon2id$v=19$m=65536,t=3,p=4$YWJjZGVmZ2g$YWJjZGVmZ2hpams', input.password);
    throw genericError();
  }

  if (user.status === 'BLOCKED') {
    throw ApiError.forbidden('To konto zostało zablokowane');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw ApiError.tooManyRequests('Konto tymczasowo zablokowane z powodu zbyt wielu nieudanych prób logowania');
  }

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null,
      },
    });
    throw genericError();
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  }

  return issueTokens(user.id, user.username, user.email, user.role);
}

async function issueTokens(id: string, username: string, email: string, role: 'USER' | 'ADMIN'): Promise<AuthResult> {
  const accessToken = signAccessToken({ sub: id, role });
  const refreshToken = signRefreshToken({ sub: id });

  await prisma.refreshToken.create({
    data: {
      userId: id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + ms(env.jwtRefreshExpiresIn)),
    },
  });

  return { user: { id, username, email, role }, accessToken, refreshToken };
}

export async function refresh(refreshToken: string): Promise<AuthResult> {
  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Nieprawidłowy token odświeżający');
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.userId !== payload.sub) {
    throw ApiError.unauthorized('Sesja wygasła, zaloguj się ponownie');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status === 'BLOCKED') {
    throw ApiError.unauthorized('Konto niedostępne');
  }

  // Rotate: revoke the used refresh token and issue a fresh pair. This
  // limits the damage window if a refresh token is ever stolen.
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  return issueTokens(user.id, user.username, user.email, user.role);
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      currentStreak: true,
      bestStreak: true,
      lastStudyDate: true,
      createdAt: true,
    },
  });
  if (!user) throw ApiError.notFound('Użytkownik nie istnieje');
  return user;
}

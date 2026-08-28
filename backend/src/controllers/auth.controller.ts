import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as authService from '../services/auth.service';
import { env } from '../config/env';
import ms from '../services/ms';

const ACCESS_COOKIE = 'accessToken';
const REFRESH_COOKIE = 'refreshToken';

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const base = {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax' as const,
  };
  res.cookie(ACCESS_COOKIE, accessToken, { ...base, maxAge: ms(env.jwtAccessExpiresIn), path: '/' });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...base, maxAge: ms(env.jwtRefreshExpiresIn), path: '/api/auth' });
}

function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

export const registerHandler = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password } = req.body;
  const result = await authService.register({ username, email, password });
  setAuthCookies(res, result.accessToken, result.refreshToken);
  res.status(201).json({ user: result.user });
});

export const loginHandler = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const result = await authService.login({ email, password });
  setAuthCookies(res, result.accessToken, result.refreshToken);
  res.json({ user: result.user });
});

export const refreshHandler = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  const result = await authService.refresh(token);
  setAuthCookies(res, result.accessToken, result.refreshToken);
  res.json({ user: result.user });
});

export const logoutHandler = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  await authService.logout(token);
  clearAuthCookies(res);
  res.status(204).send();
});

export const meHandler = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.id);
  res.json({ user });
});

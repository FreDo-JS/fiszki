import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

// General API traffic
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many requests, please try again later.' } },
});

// Limiter for login/register, to slow down brute-force and credential
// stuffing. Only FAILED attempts count (skipSuccessfulRequests), so normal
// usage never accumulates against it.
//
// This is the per-IP net; the per-account lockout in auth.service (5 failed
// attempts -> 15 min) is what actually protects an individual account. Since
// every browser tab, every device behind one NAT, and — in Docker — every
// container sharing the gateway address look like a single IP here, a very
// tight limit locks out innocent people alongside the attacker. Hence a
// looser default outside production, overridable via AUTH_RATE_LIMIT_MAX.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: { message: 'Zbyt wiele nieudanych prób. Odczekaj kilka minut i spróbuj ponownie.' },
  },
});

export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

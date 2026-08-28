import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET', process.env.NODE_ENV === 'test' ? 'test_secret' : undefined),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', process.env.NODE_ENV === 'test' ? 'test_refresh_secret' : undefined),
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
  isProduction: process.env.NODE_ENV === 'production',
  // Max FAILED auth attempts per IP per 15 minutes. Strict in production,
  // forgiving elsewhere so local use and test runs don't lock you out.
  authRateLimitMax: parseInt(
    process.env.AUTH_RATE_LIMIT_MAX ?? (process.env.NODE_ENV === 'production' ? '10' : '100'),
    10
  ),
};

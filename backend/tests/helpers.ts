// The CSRF middleware (see src/middleware/csrf.middleware.ts) requires an
// Origin header matching CORS_ORIGIN on every mutating request — exactly
// like a real browser would send. Tests replicate that here instead of
// disabling the check, so the suite actually exercises the same code path
// production traffic goes through.
export const TEST_ORIGIN = 'http://localhost:5173';

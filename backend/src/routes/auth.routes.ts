import { Router } from 'express';
import { validate } from '../middleware/validate.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { authLimiter, refreshLimiter } from '../middleware/rateLimit.middleware';
import { loginSchema, registerSchema } from '../validators/auth.validator';
import { loginHandler, logoutHandler, meHandler, refreshHandler, registerHandler } from '../controllers/auth.controller';

export const authRouter = Router();

authRouter.post('/register', authLimiter, validate(registerSchema), registerHandler);
authRouter.post('/login', authLimiter, validate(loginSchema), loginHandler);
authRouter.post('/refresh', refreshLimiter, refreshHandler);
authRouter.post('/logout', logoutHandler);
authRouter.get('/me', requireAuth, meHandler);

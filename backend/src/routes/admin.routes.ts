import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { listUsersQuerySchema, setRoleSchema, setStatusSchema, userIdParamSchema } from '../validators/admin.validator';
import {
  deleteUserHandler,
  getDashboardHandler,
  listUsersHandler,
  setUserRoleHandler,
  setUserStatusHandler,
} from '../controllers/admin.controller';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('ADMIN'));

adminRouter.get('/dashboard', getDashboardHandler);
adminRouter.get('/users', validate(listUsersQuerySchema), listUsersHandler);
adminRouter.patch('/users/:id/status', validate(setStatusSchema), setUserStatusHandler);
adminRouter.patch('/users/:id/role', validate(setRoleSchema), setUserRoleHandler);
adminRouter.delete('/users/:id', validate(userIdParamSchema), deleteUserHandler);

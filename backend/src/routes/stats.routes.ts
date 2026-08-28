import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { chartsQuerySchema } from '../validators/stats.validator';
import { getCalendarHandler, getChartsHandler, getDeckProgressHandler, getOverviewHandler } from '../controllers/stats.controller';

export const statsRouter = Router();
statsRouter.use(requireAuth);
statsRouter.get('/', getOverviewHandler);
statsRouter.get('/charts', validate(chartsQuerySchema), getChartsHandler);
statsRouter.get('/calendar', validate(chartsQuerySchema), getCalendarHandler);

export const progressRouter = Router();
progressRouter.use(requireAuth);
progressRouter.get('/', getDeckProgressHandler);

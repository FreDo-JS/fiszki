import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { dueQueueSchema, endSessionSchema, startSessionSchema } from '../validators/study.validator';
import { endSessionHandler, getDueQueueHandler, startSessionHandler } from '../controllers/study.controller';

export const studyRouter = Router();

studyRouter.use(requireAuth);

studyRouter.post('/session', validate(startSessionSchema), startSessionHandler);
studyRouter.patch('/session/:id/end', validate(endSessionSchema), endSessionHandler);
studyRouter.get('/:deckId', validate(dueQueueSchema), getDueQueueHandler);

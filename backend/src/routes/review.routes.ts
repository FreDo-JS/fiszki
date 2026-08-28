import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { submitReviewSchema } from '../validators/study.validator';
import { submitReviewHandler } from '../controllers/study.controller';

export const reviewRouter = Router();

reviewRouter.use(requireAuth);
reviewRouter.post('/', validate(submitReviewSchema), submitReviewHandler);

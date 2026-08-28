import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  cardIdParamSchema,
  createCardSchema,
  generateFieldsSchema,
  listCardsQuerySchema,
  updateCardSchema,
} from '../validators/card.validator';
import {
  createCardHandler,
  deleteCardHandler,
  generateFieldsHandler,
  getCardHandler,
  listCardsHandler,
  listTagsHandler,
  updateCardHandler,
} from '../controllers/card.controller';

export const cardRouter = Router();

cardRouter.use(requireAuth);

cardRouter.get('/', validate(listCardsQuerySchema), listCardsHandler);
cardRouter.post('/', validate(createCardSchema), createCardHandler);
cardRouter.get('/tags', listTagsHandler);
cardRouter.post('/generate', validate(generateFieldsSchema), generateFieldsHandler);
cardRouter.get('/:id', validate(cardIdParamSchema), getCardHandler);
cardRouter.put('/:id', validate(updateCardSchema), updateCardHandler);
cardRouter.delete('/:id', validate(cardIdParamSchema), deleteCardHandler);

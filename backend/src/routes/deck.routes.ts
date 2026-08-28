import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createDeckSchema,
  deckIdParamSchema,
  listDecksQuerySchema,
  updateDeckSchema,
} from '../validators/deck.validator';
import { importSchema, exportSchema } from '../validators/importExport.validator';
import {
  createDeckHandler,
  deleteDeckHandler,
  duplicateDeckHandler,
  getDeckHandler,
  listDecksHandler,
  updateDeckHandler,
} from '../controllers/deck.controller';
import { importCardsHandler, exportCardsHandler } from '../controllers/importExport.controller';

export const deckRouter = Router();

deckRouter.use(requireAuth);

deckRouter.get('/', validate(listDecksQuerySchema), listDecksHandler);
deckRouter.post('/', validate(createDeckSchema), createDeckHandler);
deckRouter.get('/:id', validate(deckIdParamSchema), getDeckHandler);
deckRouter.put('/:id', validate(updateDeckSchema), updateDeckHandler);
deckRouter.delete('/:id', validate(deckIdParamSchema), deleteDeckHandler);
deckRouter.post('/:id/duplicate', validate(deckIdParamSchema), duplicateDeckHandler);
deckRouter.post('/:id/import', validate(importSchema), importCardsHandler);
deckRouter.get('/:id/export', validate(exportSchema), exportCardsHandler);

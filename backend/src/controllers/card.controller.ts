import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as cardService from '../services/card.service';
import { generateCardFields } from '../services/dictionary.service';

export const listCardsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { deckId, search, tag, page, pageSize } = req.query as unknown as {
    deckId?: string;
    search?: string;
    tag?: string;
    page: number;
    pageSize: number;
  };
  const result = await cardService.listCards(req.user!, { deckId, search, tag, page, pageSize });
  res.json(result);
});

export const getCardHandler = asyncHandler(async (req: Request, res: Response) => {
  const card = await cardService.getCard(req.user!, req.params.id);
  res.json({ card });
});

export const createCardHandler = asyncHandler(async (req: Request, res: Response) => {
  const { deckId, ...rest } = req.body;
  const card = await cardService.createCard(req.user!, deckId, rest);
  res.status(201).json({ card });
});

export const updateCardHandler = asyncHandler(async (req: Request, res: Response) => {
  const card = await cardService.updateCard(req.user!, req.params.id, req.body);
  res.json({ card });
});

export const deleteCardHandler = asyncHandler(async (req: Request, res: Response) => {
  await cardService.deleteCard(req.user!, req.params.id);
  res.status(204).send();
});

export const listTagsHandler = asyncHandler(async (_req: Request, res: Response) => {
  const tags = await cardService.listAllTags();
  res.json({ tags });
});

export const generateFieldsHandler = asyncHandler(async (req: Request, res: Response) => {
  const fields = await generateCardFields(req.body.word);
  res.json({ fields });
});

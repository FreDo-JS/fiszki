import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as deckService from '../services/deck.service';

export const listDecksHandler = asyncHandler(async (req: Request, res: Response) => {
  const { search, tag } = req.query as { search?: string; tag?: string };
  const decks = await deckService.listDecks(req.user!, { search, tag });
  res.json({ decks });
});

export const getDeckHandler = asyncHandler(async (req: Request, res: Response) => {
  const deck = await deckService.getDeckDetail(req.user!, req.params.id);
  res.json({ deck });
});

export const createDeckHandler = asyncHandler(async (req: Request, res: Response) => {
  const deck = await deckService.createDeck(req.user!, req.body);
  res.status(201).json({ deck });
});

export const updateDeckHandler = asyncHandler(async (req: Request, res: Response) => {
  const deck = await deckService.updateDeck(req.user!, req.params.id, req.body);
  res.json({ deck });
});

export const deleteDeckHandler = asyncHandler(async (req: Request, res: Response) => {
  await deckService.deleteDeck(req.user!, req.params.id);
  res.status(204).send();
});

export const duplicateDeckHandler = asyncHandler(async (req: Request, res: Response) => {
  const deck = await deckService.duplicateDeck(req.user!, req.params.id);
  res.status(201).json({ deck });
});

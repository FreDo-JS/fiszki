import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as studyService from '../services/study.service';

export const getDueQueueHandler = asyncHandler(async (req: Request, res: Response) => {
  const limit = Number(req.query.limit ?? 20);
  const result = await studyService.getDueQueue(req.user!, req.params.deckId, limit);
  res.json(result);
});

export const startSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  const session = await studyService.startSession(req.user!, req.body.deckId);
  res.status(201).json({ session });
});

export const endSessionHandler = asyncHandler(async (req: Request, res: Response) => {
  const session = await studyService.endSession(req.user!, req.params.id);
  res.json({ session });
});

export const submitReviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await studyService.submitReview(req.user!, req.body);
  res.status(201).json(result);
});

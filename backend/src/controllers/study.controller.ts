import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { CardLevel, CardType } from '@prisma/client';
import * as studyService from '../services/study.service';

export const getDueQueueHandler = asyncHandler(async (req: Request, res: Response) => {
  // The request has already been through the zod schema, so these casts only
  // restate what validation guaranteed.
  const result = await studyService.getDueQueue(req.user!, req.params.deckId, {
    limit: Number(req.query.limit ?? 20),
    mode: (req.query.mode as studyService.StudyMode | undefined) ?? 'mixed',
    type: req.query.type as CardType | undefined,
    level: req.query.level as CardLevel | undefined,
  });
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

export const undoLastReviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await studyService.undoLastReview(req.user!);
  res.json(result);
});

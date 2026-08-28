import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as statsService from '../services/stats.service';

export const getOverviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const overview = await statsService.getOverview(req.user!.id);
  res.json({ overview });
});

export const getChartsHandler = asyncHandler(async (req: Request, res: Response) => {
  const days = Number(req.query.days ?? 30);
  const series = await statsService.getDailySeries(req.user!.id, days);
  res.json({ series });
});

export const getCalendarHandler = asyncHandler(async (req: Request, res: Response) => {
  const days = Number(req.query.days ?? 365);
  const series = await statsService.getDailySeries(req.user!.id, days);
  res.json({ series });
});

export const getDeckProgressHandler = asyncHandler(async (req: Request, res: Response) => {
  const decks = await statsService.getDeckProgress(req.user!.id);
  res.json({ decks });
});

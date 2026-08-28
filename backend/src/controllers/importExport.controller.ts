import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as importExportService from '../services/importExport.service';

export const importCardsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { format, content } = req.body;
  const result = await importExportService.importCards(req.user!, req.params.id, format, content);
  res.json(result);
});

export const exportCardsHandler = asyncHandler(async (req: Request, res: Response) => {
  const format = (req.query.format as 'csv' | 'json') ?? 'json';
  const { content, mime, filename } = await importExportService.exportCards(req.user!, req.params.id, format);
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`);
  res.send(content);
});

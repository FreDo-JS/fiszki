import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as importExportService from '../services/importExport.service';

export const importCardsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { format, content } = req.body;
  const result = await importExportService.importCards(req.user!, req.params.id, format, content);
  res.json(result);
});

// HTTP header values may only carry Latin-1, so a deck called "Słownictwo"
// made Node throw and the whole export answered 500. RFC 6266 solves this
// with two names: a sanitised ASCII one every client understands, plus a
// percent-encoded UTF-8 one that modern browsers prefer.
function contentDisposition(filename: string): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export const exportCardsHandler = asyncHandler(async (req: Request, res: Response) => {
  const format = (req.query.format as 'csv' | 'json') ?? 'json';
  const { content, mime, filename } = await importExportService.exportCards(req.user!, req.params.id, format);
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', contentDisposition(filename));
  res.send(content);
});

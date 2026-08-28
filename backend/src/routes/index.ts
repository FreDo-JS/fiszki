import { Router } from 'express';
import { authRouter } from './auth.routes';
import { deckRouter } from './deck.routes';
import { cardRouter } from './card.routes';
import { studyRouter } from './study.routes';
import { reviewRouter } from './review.routes';
import { statsRouter, progressRouter } from './stats.routes';
import { adminRouter } from './admin.routes';

export const router = Router();

router.use('/auth', authRouter);
router.use('/decks', deckRouter);
router.use('/cards', cardRouter);
router.use('/study', studyRouter);
router.use('/reviews', reviewRouter);
router.use('/statistics', statsRouter);
router.use('/progress', progressRouter);
router.use('/admin', adminRouter);

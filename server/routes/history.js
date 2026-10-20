import { Router } from 'express';
import { HttpError } from '../utils/httpError.js';
import { isValidMonthDay } from '../utils/dates.js';

export function historyRouter({ wikipedia }) {
  const router = Router();

  router.get('/:mm/:dd', async (req, res, next) => {
    try {
      const m = Number(req.params.mm), d = Number(req.params.dd);
      if (!/^\d{1,2}$/.test(req.params.mm) || !/^\d{1,2}$/.test(req.params.dd) || !isValidMonthDay(m, d)) {
        throw new HttpError(400, 'Use a real month and day, for example /api/history/10/18.');
      }
      const { data, source } = await wikipedia.getDay(m, d);
      res.set('Cache-Control', 'public, max-age=1800, stale-while-revalidate=3600');
      res.set('X-Data-Source', source);
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

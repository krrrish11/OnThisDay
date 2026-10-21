import { Router } from 'express';
import { HttpError } from '../utils/httpError.js';

// Wikipedia titles cannot contain these characters, so anything with them is not a real title.
const BAD_TITLE = /[#<>[\]{}|\u0000-\u001f]/;

export function summaryRouter({ wikipedia }) {
  const router = Router();

  router.get('/:title', async (req, res, next) => {
    try {
      const title = String(req.params.title).trim();
      if (!title || title.length > 200 || BAD_TITLE.test(title)) throw new HttpError(400, 'That is not a valid article title.');
      const { data, source } = await wikipedia.getSummary(title);
      res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      res.set('X-Data-Source', source);
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

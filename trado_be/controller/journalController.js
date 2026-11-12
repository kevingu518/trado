import MarketJournalService from '../services/MarketJournalService.js';

class JournalController {
  // GET /api/journal?from=YYYY-MM-DD&to=YYYY-MM-DD
  list = async (req, res) => {
    const data = await MarketJournalService.list(req.user.id, {
      from: req.query.from,
      to: req.query.to,
    });
    res.json({ success: true, data });
  };

  // GET /api/journal/context?date=YYYY-MM-DD
  getContext = async (req, res) => {
    const data = await MarketJournalService.getContext(req.user.id, req.query.date);
    res.json({ success: true, data });
  };

  // PUT /api/journal/:date
  upsert = async (req, res) => {
    const data = await MarketJournalService.upsert(req.user.id, req.params.date, req.body || {});
    res.json({ success: true, data });
  };

  // DELETE /api/journal/:date
  remove = async (req, res) => {
    const data = await MarketJournalService.remove(req.user.id, req.params.date);
    res.json({ success: true, data });
  };
}

export default new JournalController();

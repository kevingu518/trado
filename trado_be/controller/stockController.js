import StockPriceService from '../services/StockPriceService.js';
import { AppError } from '../errors/index.js';

const isoDateLike = /^\d{4}-\d{2}-\d{2}$/;

class StockController {
  // GET /api/stocks/:symbol/kline?start=2026-01-01&end=2026-05-27
  getKline = async (req, res) => {
    const { symbol } = req.params;
    const { start, end } = req.query;

    if (!symbol || !/^[A-Za-z0-9]{1,20}$/.test(symbol)) {
      throw new AppError('symbol is required and must be alphanumeric', 400);
    }
    if (!isoDateLike.test(start) || !isoDateLike.test(end)) {
      throw new AppError('start and end must be YYYY-MM-DD', 400);
    }
    if (start > end) {
      throw new AppError('start must be <= end', 400);
    }

    const rows = await StockPriceService.getKlineRange(symbol, start, end);
    res.json({
      success: true,
      data: {
        symbol,
        source: rows[0]?.source || null,
        rows, // [{ date, open, high, low, close, volume, source }]
      },
    });
  };

  // GET /api/stocks/prices?symbols=2330,2454
  getLatestPrices = async (req, res) => {
    const symbolsRaw = String(req.query.symbols || '').trim();
    if (!symbolsRaw) {
      return res.json({ success: true, data: {} });
    }
    const symbols = symbolsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const data = await StockPriceService.getLatest(symbols);
    res.json({ success: true, data });
  };
}

export default new StockController();

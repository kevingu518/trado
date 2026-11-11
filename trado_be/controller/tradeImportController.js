import tradeImportService from '../services/TradeImportService.js';
import { ValidationError } from '../errors/index.js';

/**
 * 匯入的檔案以「原始位元組」放在 request body（見 routes/tradeImportRoutes.js），
 * 其餘的檔名、欄位對應等中繼資料走 query 參數。
 * query 一律是字串，所以 mapping 以 JSON 字串傳遞。
 */
const parseMapping = (raw) => {
  if (raw == null || raw === '') return undefined;
  if (typeof raw === 'object') return raw;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError('mapping 必須是 JSON 物件');
  }
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ValidationError('mapping 必須是 JSON 物件');
  }
  return parsed;
};

/** query 只認字串，'false' 才是關閉 */
const parseBoolean = (raw, fallback = true) => {
  if (raw == null || raw === '') return fallback;
  return String(raw).toLowerCase() !== 'false';
};

class TradeImportController {
  // 箭頭函數自動綁定 this；錯誤一律交給 asyncHandler

  getFields = async (req, res) => {
    res.json({
      success: true,
      data: tradeImportService.getFieldDefinitions(),
    });
  };

  suggestMapping = async (req, res) => {
    const { headers } = req.body ?? {};
    res.json({
      success: true,
      data: { mapping: tradeImportService.suggestMapping(headers) },
    });
  };

  preview = async (req, res) => {
    const userId = req.user.id;
    const { filename } = req.query;

    const result = await tradeImportService.preview(userId, {
      buffer: req.body,
      filename,
      mapping: parseMapping(req.query.mapping),
    });

    res.json({ success: true, data: result });
  };

  commit = async (req, res) => {
    const userId = req.user.id;
    const { filename, sourceName } = req.query;

    const result = await tradeImportService.commit(userId, {
      buffer: req.body,
      filename,
      sourceName,
      mapping: parseMapping(req.query.mapping),
      saveMapping: parseBoolean(req.query.saveMapping, true),
    });

    res.status(201).json({ success: true, data: result });
  };

  listBatches = async (req, res) => {
    const userId = req.user.id;
    const result = await tradeImportService.listBatches(userId, { limit: req.query.limit });

    res.json({ success: true, data: result.batches, total: result.total });
  };

  listMappings = async (req, res) => {
    const userId = req.user.id;
    const result = await tradeImportService.listMappings(userId);

    res.json({ success: true, data: result.mappings });
  };

  getMapping = async (req, res) => {
    const userId = req.user.id;
    const result = await tradeImportService.getMapping(userId, req.params.sourceName);

    res.json({ success: true, data: result });
  };
}

export default new TradeImportController();

import express from 'express';
import tradeImportController from '../controller/tradeImportController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/index.js';
import { MAX_FILE_BYTES } from '../services/TradeFileParser.js';

const router = express.Router();

router.use(authenticate);

/**
 * 上傳的檔案以原始位元組收下，不用 multipart：
 * 前端直接把 File 當 fetch 的 body 送出，我們就不必引入 multer，
 * 也少一層 multipart 解析。limit 與 TradeFileParser 的上限共用同一個常數。
 *
 * type: () => true —— 瀏覽器會依副檔名自動帶 Content-Type（.csv 是 text/csv、
 * 未知副檔名可能是空字串），逐一列舉容易漏；這幾條路由只收檔案，全收最安全。
 */
const rawFile = express.raw({ type: () => true, limit: MAX_FILE_BYTES });

/**
 * 中繼資料（filename / mapping / sourceName）走 query 參數：
 * body 已經被檔案佔滿，且 mapping 本來就是前端組出來的 JSON，
 * 用 query 傳可以讓 preview 與 commit 帶同一組參數、不必兩套格式。
 */

// 系統欄位定義（前端對應 UI 的來源）
router.get('/fields', asyncHandler(tradeImportController.getFields));

// 依表頭猜測欄位對應（body: { headers: string[] }）
router.post('/suggest-mapping', asyncHandler(tradeImportController.suggestMapping));

// 解析 + 預覽，不寫入任何資料
router.post('/preview', rawFile, asyncHandler(tradeImportController.preview));

// 確認後寫入
router.post('/commit', rawFile, asyncHandler(tradeImportController.commit));

// 匯入紀錄與已儲存的欄位對應
router.get('/batches', asyncHandler(tradeImportController.listBatches));
router.get('/mappings', asyncHandler(tradeImportController.listMappings));
router.get('/mappings/:sourceName', asyncHandler(tradeImportController.getMapping));

export default router;

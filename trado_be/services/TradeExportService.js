/**
 * 交易紀錄匯出（CSV）
 *
 * 顆粒度是「一筆部位調整一列」，不是一筆交易一列 —— 匯入端吃的也是這個顆粒度，
 * 匯出檔才能直接再匯入（TD-112 驗收：匯出#2 round-trip）。
 * 欄位與日期格式一律取自 utils/tradeFields.js，與匯入共用同一份定義。
 */

import prisma from '../config/database.js';
import { EXPORT_COLUMNS, formatExportRow } from '../utils/tradeFields.js';
import { buildTradeWhere } from '../utils/tradeFilter.js';

/** RFC4180：值含逗號、雙引號或換行時要用雙引號包住，內部的雙引號加倍 */
const escapeCell = (value) => {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * BOM 讓 Excel 直接以 UTF-8 開啟，中文才不會變亂碼。
 * 我們自己的解析器也會跳過 BOM，所以加了不影響再匯入。
 */
const BOM = '﻿';
const CRLF = '\r\n';

class TradeExportService {
  /**
   * @param {string} userId
   * @param {object} filters - 與 GET /api/trades 相同的 query 參數（status/symbol/direction/startDate/endDate/strategy）
   * @returns {{filename: string, rowCount: number, content: string}}
   */
  async exportCsv(userId, filters = {}) {
    const adjustments = await prisma.positionAdjustment.findMany({
      where: {
        deletedAt: null,
        trade: buildTradeWhere(userId, filters),
      },
      include: { trade: { select: { symbol: true } } },
      // 同一時間點的成交用手動排序會不穩定，補上 id 讓輸出可重現
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
    });

    const lines = [
      EXPORT_COLUMNS.map(escapeCell).join(','),
      ...adjustments.map((row) => formatExportRow(row, row.trade).map(escapeCell).join(',')),
    ];

    return {
      filename: `trades-${new Date().toISOString().slice(0, 10)}.csv`,
      rowCount: adjustments.length,
      content: BOM + lines.join(CRLF) + CRLF,
    };
  }
}

export default new TradeExportService();

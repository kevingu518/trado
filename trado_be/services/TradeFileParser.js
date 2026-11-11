/**
 * 交易紀錄檔案解析（CSV / XLSX）
 *
 * CSV 與 XLSX 都交給 SheetJS 解析，但 CSV 先由我們自己解碼成字串再餵進去，
 * 因為台灣券商的 CSV 有相當比例是 Big5/CP950 而非 UTF-8，
 * 交給 SheetJS 猜編碼容易得到整片亂碼。
 */

import * as XLSX from 'xlsx';
import { AppError } from '../errors/index.js';

const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];
const MAX_ROWS = 20000;
const HEADER_SCAN_ROWS = 10;

/** 匯入檔案大小上限（與 routes 的 express.raw limit 一致） */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function getExtension(filename) {
  const match = /(\.[^./\\]+)$/.exec(String(filename ?? ''));
  return match ? match[1].toLowerCase() : '';
}

/**
 * 位元組 → 字串。
 * 有 UTF-8 BOM 就篤定是 UTF-8；否則先嚴格試 UTF-8，解不開就當 Big5。
 */
export function decodeText(buffer) {
  let buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  const hasUtf8Bom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  if (hasUtf8Bom) {
    return new TextDecoder('utf-8').decode(buf.subarray(3));
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('big5').decode(buf);
  }
}

const isBlankCell = (cell) =>
  cell === null || cell === undefined || String(cell).trim() === '';

/** 表頭列＝前 10 列中第一列有 2 個以上非空白的列（略過「元大證券對帳單」這類標題列） */
const findHeaderRowIndex = (matrix) => {
  const limit = Math.min(matrix.length, HEADER_SCAN_ROWS);
  for (let i = 0; i < limit; i += 1) {
    const filled = matrix[i].filter((cell) => !isBlankCell(cell)).length;
    if (filled >= 2) return i;
  }
  return 0;
};

/** 表頭名稱去重、補齊，確保每欄都有可辨識的名稱 */
const buildHeaders = (headerRow) => {
  const seen = new Map();
  return headerRow.map((cell, index) => {
    const base = isBlankCell(cell) ? `欄位${index + 1}` : String(cell).trim();
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base} (${count})`;
  });
};

class TradeFileParser {
  /**
   * @param {Buffer} buffer - 原始檔案位元組
   * @param {string} filename - 原始檔名（用來判斷格式與顯示）
   * @returns {{headers: string[], rows: any[][], headerRowIndex: number, sheetName: string, extension: string, totalRows: number, truncated: boolean}}
   */
  parse(buffer, filename) {
    const extension = getExtension(filename);

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      throw new AppError(
        `不支援的檔案格式「${extension || filename}」，請上傳 ${ALLOWED_EXTENSIONS.join(' / ')} 檔`,
        400
      );
    }

    if (!buffer || buffer.length === 0) {
      throw new AppError('檔案是空的，請確認後重新上傳', 400);
    }

    if (buffer.length > MAX_FILE_BYTES) {
      throw new AppError(
        `檔案超過 ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB 上限`,
        400
      );
    }

    let workbook;
    try {
      workbook = extension === '.csv'
        ? XLSX.read(decodeText(buffer), { type: 'string', cellDates: true, raw: true })
        : XLSX.read(buffer, { type: 'buffer', cellDates: true });
    } catch (err) {
      throw new AppError(`無法解析檔案內容：${err.message}`, 400);
    }

    const sheetName = workbook.SheetNames?.[0];
    if (!sheetName) {
      throw new AppError('檔案中找不到任何工作表', 400);
    }

    // header: 1 → 回傳二維陣列；defval 保留空欄位的位置，避免欄位錯位
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    });

    if (matrix.length === 0) {
      throw new AppError('檔案中沒有可讀取的資料列', 400);
    }

    const headerRowIndex = findHeaderRowIndex(matrix);
    const headers = buildHeaders(matrix[headerRowIndex]);

    const dataRows = matrix
      .slice(headerRowIndex + 1)
      .filter((row) => row.some((cell) => !isBlankCell(cell)));

    if (dataRows.length === 0) {
      throw new AppError('檔案只有表頭，沒有資料列', 400);
    }

    const truncated = dataRows.length > MAX_ROWS;
    const rows = (truncated ? dataRows.slice(0, MAX_ROWS) : dataRows).map((row) =>
      headers.map((_, index) => (index < row.length ? row[index] : null))
    );

    return {
      filename,
      extension,
      sheetName,
      headers,
      rows,
      headerRowIndex,
      totalRows: rows.length,
      truncated,
    };
  }
}

export default new TradeFileParser();

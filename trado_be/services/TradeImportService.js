/**
 * 交易紀錄匯入服務
 *
 * 流程：解析檔案 → 欄位對應 → 逐列正規化 → 去重 → （確認後）寫入。
 *
 * 預覽與寫入共用同一個 `_analyze()`：驗收標準「預覽顯示的重複筆數必須等於
 * 實際略過的筆數」因此在結構上就成立，而不是靠兩邊各自算得剛好一樣。
 * `_analyze()` 完全不寫入資料庫 —— 確認之前 DB 不會有任何變動。
 */

import prisma from '../config/database.js';
import { ValidationError } from '../errors/index.js';
import tradeFileParser from './TradeFileParser.js';
import tradeService from './TradeService.js';
import accountService from './AccountService.js';
import strategyService from './StrategyService.js';
import { calculateFee, calculateTax } from '../utils/feeCalculator.js';
import {
  SYSTEM_FIELDS,
  REQUIRED_FIELD_KEYS,
  buildFingerprint,
  formatDateTimeUTC,
  guessMapping,
  normalizeAction,
  normalizeSymbol,
  parseDateTime,
  parseNumber,
  parseText,
} from '../utils/tradeFields.js';

/** 預覽回傳的最大列數（統計數字仍是整份檔案的） */
const PREVIEW_ROW_LIMIT = 100;

const ACTION_LABELS = { buy: '買', sell: '賣' };

/** 空白或單純的破折號 → 視為「未提供」，與「填了但解析不出來」區分開 */
const isBlankish = (value) => {
  if (value === null || value === undefined) return true;
  const s = String(value).trim();
  return s === '' || /^[-—–－]+$/.test(s);
};

const dayKeyOf = (date) => new Date(date).toISOString().slice(0, 10);

class TradeImportService {
  /** 提供前端渲染欄位對應 UI：標籤、是否必填、常見別名 */
  getFieldDefinitions() {
    return {
      fields: SYSTEM_FIELDS.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required,
        description: f.description,
      })),
      requiredFields: REQUIRED_FIELD_KEYS,
    };
  }

  /** 依表頭猜測對應，讓使用者少做幾步 */
  suggestMapping(headers) {
    if (!Array.isArray(headers)) {
      throw new ValidationError('headers 必須是陣列');
    }
    return guessMapping(headers);
  }

  /**
   * 解析 + 正規化 + 去重，回傳完整分析結果。不寫入任何資料。
   *
   * `autoMap`：完全沒給 mapping 時自動套用猜測結果。前端剛上傳、還在「解析表頭」
   * 那一步時就靠這個拿到 headers 與建議對應（表頭只有解析後才知道，前端不該自己
   * 解檔）。一旦使用者送了自己的 mapping 就嚴格照它走、不補猜測 —— 否則少對一個
   * 必填欄位會被悄悄補上，等於繞過「必填未對應不能進下一步」。
   * commit() 不傳 autoMap：寫入前一定要有一份明確的對應。
   */
  async _analyze(userId, { buffer, filename, mapping, autoMap = false }) {
    const parsed = tradeFileParser.parse(buffer, filename);
    const effectiveMapping = mapping ?? (autoMap ? guessMapping(parsed.headers) : undefined);
    const columnIndex = this._resolveMapping(parsed.headers, effectiveMapping);
    const mappedFieldCount = Object.keys(columnIndex).length;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { brokerFeeDiscount: true },
    });
    const discount = user?.brokerFeeDiscount ? Number(user.brokerFeeDiscount) : 1.0;

    // 1. 逐列正規化                檔案列號 = 表頭列之後的實際列次（1-based）
    const rows = parsed.rows.map((rawRow, i) =>
      this._normalizeRow(rawRow, columnIndex, parsed.headerRowIndex + i + 2)
    );

    // 2. 當沖判定需要「同代號同日有買進」——同時考慮本批次與資料庫既有資料
    const dayTradeKeys = await this._collectDayTradeKeys(userId, rows);

    // 3. 補齊 fee / tax（預覽就要算準，否則自動補的入金金額會與實際寫入不符）
    for (const row of rows) {
      if (row.errors.length > 0) continue;
      this._resolveCosts(row, discount, dayTradeKeys);
    }

    // 4. 指紋與去重
    const valid = rows.filter((r) => r.errors.length === 0);
    for (const row of valid) {
      row.fingerprint = buildFingerprint(row);
    }
    await this._markDuplicates(userId, valid);

    const importable = valid.filter((r) => r.status === 'ok');

    // 5. 自動補入金金額：讓匯入後現金維持匯入前的值（打平）
    const depositAmount = this._estimateDeposit(importable);

    // 6. 決定每一列要掛到哪一筆交易（新的或既有的未平倉交易）
    const groups = await this._planTrades(userId, importable);
    const openedBySell = groups.filter((g) => g.openedBySell).length;

    return {
      parsed,
      rows,
      importable,
      groups,
      columnIndex,
      mappedFieldCount,
      depositAmount,
      summary: {
        totalRows: rows.length,
        importableCount: importable.length,
        duplicateCount: valid.filter((r) => r.status === 'duplicate').length,
        invalidCount: rows.filter((r) => r.status === 'invalid').length,
        newTradeCount: groups.filter((g) => !g.tradeId).length,
        depositAmount,
        // 賣出但前面沒有對應的買進：會獨立成一筆交易，損益無成本可扣，預先提醒使用者
        orphanSellCount: openedBySell,
        truncated: parsed.truncated,
      },
    };
  }

  /** 把「系統欄位 → 表頭名稱」的對應轉成欄位索引，必填未對應就擋下來 */
  _resolveMapping(headers, mapping) {
    const source = mapping && typeof mapping === 'object' ? mapping : {};
    const columnIndex = {};
    const missing = [];

    for (const field of SYSTEM_FIELDS) {
      const header = source[field.key];
      const index =
        header === null || header === undefined || header === ''
          ? -1
          : headers.indexOf(String(header));

      if (index === -1) {
        if (field.required) missing.push(field.label);
        continue;
      }
      columnIndex[field.key] = index;
    }

    if (missing.length > 0) {
      throw new ValidationError(`必填欄位尚未對應：${missing.join('、')}`);
    }
    return columnIndex;
  }

  _normalizeRow(rawRow, columnIndex, rowNumber) {
    const cell = (key) => {
      const index = columnIndex[key];
      return index === undefined ? null : rawRow[index];
    };

    const errors = [];

    const timestamp = parseDateTime(cell('timestamp'));
    if (!timestamp) errors.push('日期無法解析或為空');

    const symbol = normalizeSymbol(cell('symbol'));
    if (!symbol) errors.push('代號為空');

    const action = normalizeAction(cell('action'));
    if (!action) errors.push('動作無法辨識（需為買或賣）');

    const shares = parseNumber(cell('shares'));
    if (shares === null) errors.push('股數無法解析');
    else if (!Number.isInteger(shares)) errors.push('股數必須是整數');
    else if (shares <= 0) errors.push('股數必須大於 0');

    const price = parseNumber(cell('price'));
    if (price === null) errors.push('價格無法解析');
    else if (price <= 0) errors.push('價格必須大於 0');

    const fee = this._optionalInt(cell('fee'), '手續費', errors);
    const tax = this._optionalInt(cell('tax'), '交易稅', errors);

    return {
      rowNumber,
      symbol,
      action,
      actionLabel: action ? ACTION_LABELS[action] : null,
      shares,
      // 價格寫入 Decimal(18,2)，先四捨五入再算指紋，否則匯出再匯入會對不上
      price: price === null ? null : Math.round(price * 100) / 100,
      timestamp,
      timestampLabel: timestamp ? formatDateTimeUTC(timestamp) : null,
      name: parseText(cell('name')),
      note: parseText(cell('note')),
      fee,
      tax,
      isDayTrade: false,
      fingerprint: null,
      status: errors.length > 0 ? 'invalid' : 'pending',
      errors,
    };
  }

  _optionalInt(raw, label, errors) {
    if (isBlankish(raw)) return null; // 未提供 → 之後自動計算
    const n = parseNumber(raw);
    if (n === null) {
      errors.push(`${label}無法解析`);
      return null;
    }
    return Math.round(n);
  }

  /** 補上手續費與證交稅：檔案有給就用檔案的，沒給才依規則算 */
  _resolveCosts(row, discount, dayTradeKeys) {
    if (row.fee === null) {
      row.fee = calculateFee(row.shares, row.price, discount);
    }

    if (row.action === 'buy') {
      // 買進不課證交稅；檔案若在買進列給了稅額，一律以 0 計，避免欄位錯位造成的錯誤成本
      row.tax = 0;
      row.isDayTrade = false;
      return;
    }

    row.isDayTrade = dayTradeKeys.has(`${row.symbol}|${dayKeyOf(row.timestamp)}`);
    if (row.tax === null) {
      row.tax = calculateTax(row.shares, row.price, row.isDayTrade);
    }
  }

  /** 收集「同代號同日有買進」的組合，用於判斷賣出是否為當沖 */
  async _collectDayTradeKeys(userId, rows) {
    const keys = new Set();
    const valid = rows.filter((r) => r.errors.length === 0);

    for (const row of valid) {
      if (row.action === 'buy') keys.add(`${row.symbol}|${dayKeyOf(row.timestamp)}`);
    }

    const timestamps = valid.map((r) => r.timestamp);
    if (timestamps.length === 0) return keys;

    const min = new Date(Math.min(...timestamps.map((t) => t.getTime())));
    const max = new Date(Math.max(...timestamps.map((t) => t.getTime())));

    const existing = await prisma.$queryRaw`
      SELECT DISTINCT t."symbol" AS symbol,
             to_char(pa."timestamp", 'YYYY-MM-DD') AS day
      FROM "PositionAdjustment" pa
      JOIN "Trade" t ON pa."tradeId" = t.id
      WHERE t."userId" = ${userId}
        AND pa."action" = 'buy'
        AND pa."deletedAt" IS NULL
        AND pa."timestamp" >= ${min}
        AND pa."timestamp" <= ${max}
    `;

    for (const row of existing) {
      keys.add(`${row.symbol}|${row.day}`);
    }
    return keys;
  }

  /**
   * 標記重複列。
   *
   * 指紋刻意不是唯一鍵：同一天以相同價格買進相同股數兩次是真實存在的，
   * 若做成唯一鍵會把第二筆當成重複而漏掉。因此改比對「出現次數」——
   * 資料庫已有 N 筆同指紋，這批檔案帶了 M 筆，就只補進 M - N 筆。
   *
   * 計數涵蓋軟刪除的紀錄：使用者刻意刪掉的那筆不該因為重新匯入而復活。
   */
  async _markDuplicates(userId, validRows) {
    if (validRows.length === 0) return;

    const incoming = new Map();
    for (const row of validRows) {
      incoming.set(row.fingerprint, (incoming.get(row.fingerprint) ?? 0) + 1);
    }

    const fingerprints = [...incoming.keys()];
    const existing = await prisma.$queryRaw`
      SELECT pa."fingerprint" AS fingerprint, COUNT(*)::int AS count
      FROM "PositionAdjustment" pa
      JOIN "Trade" t ON pa."tradeId" = t.id
      WHERE t."userId" = ${userId}
        AND pa."fingerprint" = ANY(${fingerprints}::text[])
      GROUP BY pa."fingerprint"
    `;
    const existingCounts = new Map(existing.map((r) => [r.fingerprint, Number(r.count)]));

    // 每個指紋還剩幾筆可以寫入
    const remaining = new Map();
    for (const [fingerprint, count] of incoming) {
      remaining.set(fingerprint, Math.max(0, count - (existingCounts.get(fingerprint) ?? 0)));
    }

    for (const row of validRows) {
      const left = remaining.get(row.fingerprint) ?? 0;
      if (left > 0) {
        remaining.set(row.fingerprint, left - 1);
        row.status = 'ok';
      } else {
        row.status = 'duplicate';
      }
    }
  }

  /** 依買賣淨額估算要自動補的入金（只補正的，賣超不需要退款） */
  _estimateDeposit(importable) {
    let buyCost = 0;
    let sellProceeds = 0;

    for (const row of importable) {
      const gross = row.shares * row.price;
      if (row.action === 'buy') buyCost += gross + row.fee;
      else sellProceeds += gross - row.fee - row.tax;
    }

    return Math.max(0, Math.round(buyCost - sellProceeds));
  }

  /**
   * 決定每一列要掛到哪一筆交易。
   *
   * 規則：同一代號的紀錄照時間順序累加，接到該代號「尚未平倉」的交易上；
   * 倉位歸零（買賣相抵）就結束該筆，之後的紀錄另開新的一筆。
   * 這樣同一份對帳單裡的多趟進出會自然拆成多筆交易，與手動建倉的行為一致。
   *
   * 既有的未平倉交易會被接續（例如先前的買進在別的檔案、這次只匯入後續加碼）。
   */
  async _planTrades(userId, importable) {
    if (importable.length === 0) return [];

    // 既有未平倉交易的目前倉位
    const openRows = await prisma.$queryRaw`
      SELECT t."id" AS id,
             t."symbol" AS symbol,
             t."createdAt" AS "createdAt",
             COALESCE(SUM(CASE WHEN pa."action" = 'buy' THEN pa."shares" ELSE -pa."shares" END), 0)::int AS net
      FROM "Trade" t
      LEFT JOIN "PositionAdjustment" pa
        ON pa."tradeId" = t."id" AND pa."deletedAt" IS NULL
      WHERE t."userId" = ${userId} AND t."status" <> 'closed'
      GROUP BY t."id", t."symbol", t."createdAt"
    `;

    // 同代號可能有多筆未平倉交易，接續最近建立的那一筆
    const openBySymbol = new Map();
    for (const row of [...openRows].sort((a, b) => a.createdAt - b.createdAt)) {
      openBySymbol.set(row.symbol, row);
    }

    const bySymbol = new Map();
    for (const row of importable) {
      if (!bySymbol.has(row.symbol)) bySymbol.set(row.symbol, []);
      bySymbol.get(row.symbol).push(row);
    }

    const groups = [];
    for (const [symbol, rows] of bySymbol) {
      const open = openBySymbol.get(symbol);
      let reuseOpen = Boolean(open); // 只有第一段沿用既有交易；歸零後再開的是全新的
      let current = null;
      let running = open ? Number(open.net) : 0;

      for (const row of [...rows].sort((a, b) => a.timestamp - b.timestamp)) {
        if (!current) {
          current = {
            tradeId: reuseOpen ? open.id : null,
            symbol,
            direction: row.action === 'sell' ? 'short' : 'long',
            openedBySell: row.action === 'sell',
            rows: [],
          };
          reuseOpen = false;
          groups.push(current);
        }

        current.rows.push(row);
        row.groupIndex = groups.length - 1;

        running += row.action === 'buy' ? row.shares : -row.shares;
        if (running === 0) {
          current = null;
          running = 0;
        }
      }
    }

    return groups;
  }

  /**
   * 預覽：回傳表頭、對應結果、統計與前 N 列。不寫入資料庫。
   */
  async preview(userId, { buffer, filename, mapping }) {
    // autoMap：只帶檔案、還沒選對應時，先回一份猜好的對應給前端畫 UI
    const analysis = await this._analyze(userId, { buffer, filename, mapping, autoMap: true });
    const { parsed, rows, summary, mappedFieldCount } = analysis;

    // 已被對應走的欄位不再列為「未對應」
    const mappedHeaders = new Set(
      Object.entries(analysis.columnIndex).map(([key, index]) => parsed.headers[index])
    );

    return {
      filename: parsed.filename,
      sheetName: parsed.sheetName,
      extension: parsed.extension,
      headerRowIndex: parsed.headerRowIndex,
      headers: parsed.headers,
      suggestedMapping: guessMapping(parsed.headers),
      mappedFieldCount,
      unmappedColumns: parsed.headers.filter((h) => !mappedHeaders.has(h)),
      summary,
      rows: rows.slice(0, PREVIEW_ROW_LIMIT).map((row) => this._toPreviewRow(row)),
      previewLimit: PREVIEW_ROW_LIMIT,
      hasMoreRows: rows.length > PREVIEW_ROW_LIMIT,
    };
  }

  /**
   * 寫入。
   *
   * 與 preview() 共用 `_analyze()`，因此實際寫入／略過／失敗的筆數
   * 與預覽顯示的數字必然一致（不是靠兩邊各自算對）。
   *
   * 全部落在一個 transaction：批次紀錄 + 交易 + 部位調整 + 自動入金
   * 要嘛全部成功，要嘛全部不變。metrics 重算與快照則在交易完成後才做，
   * 因為那些是衍生資料，失敗不該讓匯入回滾。
   */
  async commit(userId, { buffer, filename, mapping, sourceName, saveMapping = true }) {
    const analysis = await this._analyze(userId, { buffer, filename, mapping });
    const { parsed, groups, importable, depositAmount, summary } = analysis;

    const resolvedSource = parseText(sourceName) || parsed.filename || '未命名來源';
    if (resolvedSource.length > 100) {
      throw new ValidationError('來源名稱不可超過 100 個字');
    }

    // 沒有新資料：不建立批次、也不補入金（匯入紀錄不留沒有實際動作的一列）。
    // 但欄位對應照樣要記住 —— 那是使用者確認過的設定，與這批有沒有新資料無關；
    // 全部重複往往正是「同一個來源再匯一次」的情境，這時把對應丟掉最不合理。
    if (importable.length === 0) {
      const savedMapping = await this._saveMapping(
        userId, resolvedSource, mapping, analysis.columnIndex, saveMapping
      );
      return {
        batchId: null,
        sourceName: resolvedSource,
        depositAmount: 0,
        depositDate: null,
        savedMapping,
        tradeIds: [],
        summary,
      };
    }

    const systemStrategy = await strategyService.ensureSystemStrategy(userId);
    const balanceBefore = await accountService._computeCashBalance(userId);

    // 入金日期取最早的一筆成交：這筆錢必須在它資助的第一筆買進之前就存在
    const earliest = importable.reduce(
      (min, row) => (row.timestamp < min ? row.timestamp : min),
      importable[0].timestamp
    );

    const { batchId, tradeIds } = await prisma.$transaction(async (tx) => {
      const batch = await tx.importBatch.create({
        data: {
          userId,
          sourceName: resolvedSource,
          filename: parsed.filename ?? null,
          mapping: mapping ?? {},
          totalRows: summary.totalRows,
          importedCount: summary.importableCount,
          skippedCount: summary.duplicateCount,
          failedCount: summary.invalidCount,
          depositAmount,
        },
      });

      const touched = [];

      for (const group of groups) {
        let tradeId = group.tradeId;
        if (!tradeId) {
          const trade = await tx.trade.create({
            data: {
              userId,
              symbol: group.symbol,
              direction: group.direction,
              // 'open' 是本站未平倉的既定值（DashboardService、AccountService、
              // StockCategoryService、TradeService 的未實現損益都以 'open' 過濾）；
              // calculateTradeMetrics 會在股數歸零時自動改成 'closed'。
              status: 'open',
              strategyId: systemStrategy.id,
              createdAt: group.rows[0].timestamp,
            },
          });
          tradeId = trade.id;
        }
        touched.push(tradeId);

        for (const row of group.rows) {
          await tx.positionAdjustment.create({
            data: {
              tradeId,
              action: row.action,
              shares: row.shares,
              price: row.price,
              fee: row.fee,
              tax: row.tax,
              isDayTrade: row.isDayTrade,
              note: row.note,
              timestamp: row.timestamp,
              fingerprint: row.fingerprint,
              importBatchId: batch.id,
            },
          });
        }
      }

      if (depositAmount > 0) {
        await tx.accountTransaction.create({
          data: {
            userId,
            type: 'deposit',
            source: 'import',
            amount: depositAmount,
            // 與 AccountService.deposit() 一致：記錄當下餘額，僅供顯示
            balance: balanceBefore + depositAmount,
            method: '匯入自動補帳',
            notes: `匯入「${resolvedSource}」自動補足以打平現金`,
            date: earliest,
            importBatchId: batch.id,
          },
        });
      }

      return { batchId: batch.id, tradeIds: touched };
    });

    // 交易完成後才重算衍生資料
    const uniqueTradeIds = [...new Set(tradeIds)];
    for (const tradeId of uniqueTradeIds) {
      await tradeService.calculateTradeMetrics(tradeId);
    }

    // 記住這組對應，下次同來源可一鍵套用
    const savedMapping = await this._saveMapping(
      userId, resolvedSource, mapping, analysis.columnIndex, saveMapping
    );

    return {
      batchId,
      sourceName: resolvedSource,
      depositAmount,
      depositDate: depositAmount > 0 ? formatDateTimeUTC(earliest) : null,
      savedMapping,
      tradeIds: uniqueTradeIds,
      summary,
    };
  }

  /** 先前的匯入紀錄，讓使用者看得出哪些檔案已經匯入過 */
  async listBatches(userId, { limit = 20 } = {}) {
    const batches = await prisma.importBatch.findMany({
      where: { userId },
      // id 作為次要排序鍵：同一毫秒建立的批次才不會有隨機順序
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.min(Math.max(Number(limit) || 20, 1), 100),
    });
    return { batches, total: await prisma.importBatch.count({ where: { userId } }) };
  }

  /**
   * 記住這組欄位對應，下次同來源可一鍵套用。
   *
   * 刻意與「這次匯入幾筆」分開：使用者確認過的對應就該留下來，即使整份檔案都是
   * 重複（重匯舊檔）也一樣。沒有任何欄位被對應時不存，避免留下空殼設定。
   */
  async _saveMapping(userId, sourceName, mapping, columnIndex, enabled) {
    if (!enabled || Object.keys(columnIndex).length === 0) return false;

    await prisma.importMapping.upsert({
      where: { userId_sourceName: { userId, sourceName } },
      create: { userId, sourceName, mapping: mapping ?? {} },
      update: { mapping: mapping ?? {} },
    });
    return true;
  }

  /** 已存的欄位對應，套用時不需重新配對 */
  async listMappings(userId) {
    const mappings = await prisma.importMapping.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return { mappings };
  }

  async getMapping(userId, sourceName) {
    return prisma.importMapping.findUnique({
      where: { userId_sourceName: { userId, sourceName } },
    });
  }

  _toPreviewRow(row) {
    return {
      rowNumber: row.rowNumber,
      status: row.status,
      errors: row.errors,
      symbol: row.symbol,
      name: row.name,
      action: row.action,
      actionLabel: row.actionLabel,
      shares: row.shares,
      price: row.price,
      timestamp: row.timestampLabel,
      fee: row.fee,
      tax: row.tax,
      isDayTrade: row.isDayTrade,
      note: row.note,
    };
  }
}

export default new TradeImportService();

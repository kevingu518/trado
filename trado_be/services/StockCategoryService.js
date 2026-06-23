import prisma from '../config/database.js';
import { AppError, NotFoundError, ValidationError } from '../errors/index.js';
import accountService from './AccountService.js';
import stockPriceService from './StockPriceService.js';
import { DEFAULT_STOCK_CATEGORIES } from '../config/defaultStockCategories.js';

const VALID_COLORS = [
  'red', 'orange', 'yellow',
  'green', 'teal', 'cyan',
  'blue', 'indigo', 'purple',
  'pink', 'gray', 'slate',
];

const MAX_CATEGORIES_PER_USER = 60;

function validateColor(color) {
  if (!color || !VALID_COLORS.includes(color)) {
    throw new ValidationError(
      `color must be one of: ${VALID_COLORS.join(', ')}`,
    );
  }
}

function validateTargetRatio(ratio) {
  if (ratio === null || ratio === undefined || ratio === '') return null;
  const n = Number(ratio);
  if (Number.isNaN(n) || n < 0 || n > 1) {
    throw new ValidationError('targetRatio must be between 0 and 1');
  }
  return n;
}

class StockCategoryService {
  /**
   * 為指定 user 補滿預設族群（已存在的同名族群不會被覆蓋）
   * - 新註冊呼叫一次
   * - 也可用在 migration / 一鍵補回預設
   * @param {string} userId
   * @param {object} [opts]
   * @param {object} [opts.tx] 傳入 Prisma transaction client（在 user 建立的 transaction 內呼叫時）
   */
  async seedDefaultCategories(userId, opts = {}) {
    const client = opts.tx || prisma;
    const data = DEFAULT_STOCK_CATEGORIES.map((c, idx) => ({
      userId,
      name: c.name,
      color: c.color,
      sortOrder: idx,
      isStandby: true,
    }));
    // skipDuplicates 確保已存在同名族群不會被覆蓋
    await client.stockCategory.createMany({ data, skipDuplicates: true });
  }

  async listCategories(userId) {
    return await prisma.stockCategory.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { mappings: true } },
      },
    });
  }

  async createCategory(userId, data) {
    const name = (data.name ?? '').trim();
    if (!name) throw new ValidationError('name is required');
    validateColor(data.color);
    const targetRatio = validateTargetRatio(data.targetRatio);

    const count = await prisma.stockCategory.count({ where: { userId } });
    if (count >= MAX_CATEGORIES_PER_USER) {
      throw new AppError(
        `族群數量已達上限 (${MAX_CATEGORIES_PER_USER})`,
        400,
      );
    }

    try {
      return await prisma.stockCategory.create({
        data: {
          userId,
          name,
          color: data.color,
          targetRatio,
          isStandby: !!data.isStandby,
          sortOrder: Number.isInteger(data.sortOrder) ? data.sortOrder : count,
        },
      });
    } catch (err) {
      if (err.code === 'P2002') {
        throw new ValidationError(`族群名稱「${name}」已存在`);
      }
      throw err;
    }
  }

  /**
   * 批次建立族群（給「快速建立」用）
   * - 已存在的同名族群會略過（依 unique(userId, name) 判斷）
   * - 回傳：實際建立的族群清單
   */
  async bulkCreateCategories(userId, items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError('items must be a non-empty array');
    }

    const existing = await prisma.stockCategory.count({ where: { userId } });
    if (existing + items.length > MAX_CATEGORIES_PER_USER) {
      throw new AppError(
        `建立後族群總數會超過上限 (${MAX_CATEGORIES_PER_USER})`,
        400,
      );
    }

    const cleaned = [];
    for (const item of items) {
      const name = (item?.name ?? '').trim();
      if (!name) continue;
      validateColor(item.color);
      cleaned.push({
        userId,
        name,
        color: item.color,
        targetRatio: validateTargetRatio(item.targetRatio),
        sortOrder: Number.isInteger(item.sortOrder) ? item.sortOrder : 0,
      });
    }

    if (cleaned.length === 0) {
      throw new ValidationError('No valid items to create');
    }

    // skipDuplicates 處理 (userId, name) unique 衝突
    await prisma.stockCategory.createMany({
      data: cleaned,
      skipDuplicates: true,
    });

    // 回傳該用戶完整列表
    return await this.listCategories(userId);
  }

  async updateCategory(userId, id, data) {
    const existing = await prisma.stockCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Category not found');
    if (existing.userId !== userId) throw new AppError('Access denied', 403);

    const updates = {};
    if (data.name !== undefined) {
      const name = (data.name ?? '').trim();
      if (!name) throw new ValidationError('name is required');
      updates.name = name;
    }
    if (data.color !== undefined) {
      validateColor(data.color);
      updates.color = data.color;
    }
    if (data.targetRatio !== undefined) {
      updates.targetRatio = validateTargetRatio(data.targetRatio);
    }
    if (data.sortOrder !== undefined && Number.isInteger(data.sortOrder)) {
      updates.sortOrder = data.sortOrder;
    }
    if (data.isStandby !== undefined) {
      updates.isStandby = !!data.isStandby;
    }

    try {
      return await prisma.stockCategory.update({ where: { id }, data: updates });
    } catch (err) {
      if (err.code === 'P2002') {
        throw new ValidationError(`族群名稱「${updates.name}」已存在`);
      }
      throw err;
    }
  }

  /**
   * 批次更新排序 + Standby 狀態（拖曳後使用）
   * @param {string} userId
   * @param {object} params
   * @param {string[]} params.activeIds   持有 pool 的 id 順序
   * @param {string[]} params.standbyIds  Standby pool 的 id 順序
   *
   * - 兩個 array 內無重複；id 都必須屬於此使用者
   * - sortOrder 全局連續：active 從 0 開始、standby 接著
   * - isStandby 依所在 pool 自動設定
   */
  async reorderCategories(userId, { activeIds = [], standbyIds = [] }) {
    if (!Array.isArray(activeIds) || !Array.isArray(standbyIds)) {
      throw new ValidationError('activeIds and standbyIds must be arrays');
    }
    const allIds = [...activeIds, ...standbyIds];
    if (allIds.length === 0) {
      throw new ValidationError('至少要包含一個 id');
    }
    if (new Set(allIds).size !== allIds.length) {
      throw new ValidationError('ids must be unique across both pools');
    }

    const owned = await prisma.stockCategory.findMany({
      where: { userId, id: { in: allIds } },
      select: { id: true },
    });
    if (owned.length !== allIds.length) {
      throw new ValidationError('部分族群 id 不存在或不屬於此使用者');
    }

    const updates = [];
    activeIds.forEach((id, idx) => {
      updates.push(
        prisma.stockCategory.update({
          where: { id },
          data: { sortOrder: idx, isStandby: false },
        }),
      );
    });
    standbyIds.forEach((id, idx) => {
      updates.push(
        prisma.stockCategory.update({
          where: { id },
          data: { sortOrder: activeIds.length + idx, isStandby: true },
        }),
      );
    });

    await prisma.$transaction(updates);
    return await this.listCategories(userId);
  }

  async deleteCategory(userId, id) {
    const existing = await prisma.stockCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Category not found');
    if (existing.userId !== userId) throw new AppError('Access denied', 403);

    // mappings 會 cascade 刪除
    await prisma.stockCategory.delete({ where: { id } });
    return { id };
  }

  /**
   * 列出所有 mapping（給前端在交易紀錄表顯示 tag 用）
   * 回傳: [{ symbol, categoryId }]
   */
  async listMappings(userId) {
    const rows = await prisma.stockCategoryMap.findMany({
      where: { userId },
      select: { symbol: true, categoryId: true },
    });
    return rows;
  }

  /**
   * 設定單一 symbol 的族群（單選；categoryId = null 代表移除）
   */
  async setSymbolCategory(userId, symbol, categoryId) {
    const sym = (symbol ?? '').trim();
    if (!sym) throw new ValidationError('symbol is required');

    if (categoryId === null || categoryId === undefined || categoryId === '') {
      await prisma.stockCategoryMap.deleteMany({
        where: { userId, symbol: sym },
      });
      return { symbol: sym, categoryId: null };
    }

    // 驗證該 category 屬於本人
    const category = await prisma.stockCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.userId !== userId) {
      throw new NotFoundError('Category not found');
    }

    const result = await prisma.stockCategoryMap.upsert({
      where: { userId_symbol: { userId, symbol: sym } },
      create: { userId, symbol: sym, categoryId },
      update: { categoryId },
    });
    return result;
  }

  /**
   * 批次設定多個 symbol 的族群
   * @param {string} userId
   * @param {string[]} symbols
   * @param {string|null} categoryId
   */
  /**
   * 族群資產配置分析
   * 回傳：
   *  {
   *    totalAssets, cashBalance, positionsValue,
   *    categories: [{ id, name, color, targetRatio, sortOrder,
   *                   symbolCount, marketValue, actualRatio, deltaRatio,
   *                   symbols: [{ symbol, shares, price, value }] }],
   *    unclassified: { marketValue, actualRatio, symbols: [{ symbol, shares, price, value }] }
   *  }
   *
   * actualRatio / targetRatio / deltaRatio 全部以「總資產」為分母（含現金）
   */
  async getAllocation(userId) {
    // 1) 各族群定義 + 該用戶的持有 symbol mapping
    const [categories, mappings, openTrades, cashBalance] = await Promise.all([
      prisma.stockCategory.findMany({
        where: { userId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.stockCategoryMap.findMany({ where: { userId } }),
      prisma.trade.findMany({
        where: { userId, status: 'open' },
        select: { symbol: true, totalShares: true, direction: true },
      }),
      accountService._computeCashBalance(userId),
    ]);

    // 2) 同一 symbol 可能有多筆 open trade（多空都算），加總股數
    const symbolShares = new Map(); // symbol -> shares (long - short)
    for (const t of openTrades) {
      const shares = t.totalShares || 0;
      const signed = t.direction === 'short' ? -shares : shares;
      symbolShares.set(t.symbol, (symbolShares.get(t.symbol) || 0) + signed);
    }
    // 過濾出有實際部位的 symbol
    const heldSymbols = [...symbolShares.entries()]
      .filter(([, s]) => s !== 0)
      .map(([sym]) => sym);

    // 3) 拿最新收盤價
    const latest = heldSymbols.length > 0
      ? await stockPriceService.getLatest(heldSymbols)
      : {};

    // 4) 計算每個 symbol 的市值
    const symbolMeta = heldSymbols.map((sym) => {
      const shares = symbolShares.get(sym) || 0;
      const price = latest[sym]?.close ?? null;
      // 沒拿到價格 → value 為 null（避免錯誤估算）
      const value = price !== null ? Math.round(shares * price) : null;
      return { symbol: sym, shares, price, value };
    });

    // 5) 對照 mapping，分到各 category
    const mappingBySymbol = new Map(mappings.map(m => [m.symbol, m.categoryId]));
    const byCategory = new Map(); // categoryId -> { value, symbols: [...] }
    const unclassifiedSymbols = [];

    for (const item of symbolMeta) {
      const catId = mappingBySymbol.get(item.symbol) || null;
      if (catId) {
        if (!byCategory.has(catId)) byCategory.set(catId, { value: 0, symbols: [] });
        const entry = byCategory.get(catId);
        if (item.value !== null) entry.value += item.value;
        entry.symbols.push(item);
      } else {
        unclassifiedSymbols.push(item);
      }
    }

    const positionsValue = symbolMeta.reduce((s, x) => s + (x.value || 0), 0);
    const totalAssets = cashBalance + positionsValue;
    const denom = totalAssets > 0 ? totalAssets : 1; // 避免除 0

    // 6) 組族群結果 — 拆 active vs standby
    const buildEntry = (c) => {
      const entry = byCategory.get(c.id) || { value: 0, symbols: [] };
      const targetRatio = c.targetRatio === null || c.targetRatio === undefined
        ? null
        : Number(c.targetRatio);
      const actualRatio = entry.value / denom;
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        targetRatio,
        sortOrder: c.sortOrder,
        isStandby: c.isStandby,
        symbolCount: entry.symbols.length,
        marketValue: entry.value,
        actualRatio,
        deltaRatio: targetRatio === null ? null : actualRatio - targetRatio,
        symbols: entry.symbols,
      };
    };

    const activeCategories = categories.filter(c => !c.isStandby).map(buildEntry);
    // Standby 警告：standby 族群但仍有持股
    const standbyWithPositions = categories
      .filter(c => c.isStandby)
      .map(buildEntry)
      .filter(c => c.symbolCount > 0);

    const unclassifiedValue = unclassifiedSymbols.reduce((s, x) => s + (x.value || 0), 0);

    return {
      totalAssets,
      cashBalance,
      positionsValue,
      categories: activeCategories,
      unclassified: {
        marketValue: unclassifiedValue,
        actualRatio: unclassifiedValue / denom,
        symbols: unclassifiedSymbols,
      },
      standbyWithPositions,
    };
  }

  /**
   * 族群持倉佔比「流向」：比較「最新持倉」與「上一個有交易的日期」兩個時間點的
   * 各族群成本佔比。
   *
   * 計價基準：成本（股數 × 平均成本）。
   *  - current（最新持倉）：直接讀 open trades 的 totalShares × avgPrice，與「族群配置」
   *    頁同源，確保即使某些部位沒有 PositionAdjustment 明細也能顯示。
   *  - previous（上一交易日）：重播 PositionAdjustment（與 TradeService.calculateTradeMetrics
   *    同一套平均成本演算法），取該日結束時的持倉成本。沒有明細的部位無從回推歷史，
   *    只會出現在 current。
   * 佔比分母：該快照「總持倉成本」（不含現金）。無 mapping 的 symbol 歸「未分類」。
   *
   * @returns {Promise<{
   *   previous: { date: string|null, totalCost: number, categories: [...], unclassified: {...} } | null,
   *   current:  { date: string|null, totalCost: number, categories: [...], unclassified: {...} },
   * }>}
   */
  async getAllocationFlow(userId) {
    const [categories, mappings, openTrades, adjustments] = await Promise.all([
      prisma.stockCategory.findMany({
        where: { userId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.stockCategoryMap.findMany({ where: { userId } }),
      prisma.trade.findMany({
        where: { userId, status: 'open' },
        select: { symbol: true, totalShares: true, avgPrice: true },
      }),
      prisma.positionAdjustment.findMany({
        where: { deletedAt: null, trade: { userId } },
        select: {
          action: true,
          shares: true,
          price: true,
          fee: true,
          timestamp: true,
          trade: { select: { id: true, symbol: true } },
        },
        orderBy: { timestamp: 'asc' },
      }),
    ]);

    // 以 UTC 日期字串歸日（與 DailyPositionService 一致）
    const toDateKey = (d) => d.toISOString().slice(0, 10);
    const endOf = (dateKey) => new Date(dateKey + 'T23:59:59.999Z');

    // current 持倉成本：以 open trades 的 totalShares × avgPrice（與族群配置同源）
    const currentSymbolCost = new Map();
    for (const t of openTrades) {
      const shares = t.totalShares || 0;
      const avg = t.avgPrice != null ? Number(t.avgPrice) : 0;
      if (shares > 0 && avg > 0) {
        currentSymbolCost.set(t.symbol, (currentSymbolCost.get(t.symbol) || 0) + shares * avg);
      }
    }

    // previous：依交易明細日期回推上一交易日的持倉
    const dateKeys = [...new Set(adjustments.map((a) => toDateKey(a.timestamp)))].sort();
    const d1 = dateKeys.length ? dateKeys[dateKeys.length - 1] : null;
    const d0 = dateKeys.length >= 2 ? dateKeys[dateKeys.length - 2] : null;

    // 依 tradeId 分組（adjustments 已按 timestamp 升序）
    const byTrade = new Map(); // tradeId -> { symbol, adjs: [] }
    for (const adj of adjustments) {
      const tid = adj.trade.id;
      if (!byTrade.has(tid)) byTrade.set(tid, { symbol: adj.trade.symbol, adjs: [] });
      byTrade.get(tid).adjs.push(adj);
    }

    // 重播至 cutoff（含），回傳 symbol -> 持倉成本
    const snapshotCostBySymbol = (cutoff) => {
      const symbolCost = new Map();
      for (const { symbol, adjs } of byTrade.values()) {
        let shares = 0;
        let cost = 0;
        for (const adj of adjs) {
          if (cutoff && adj.timestamp > cutoff) break;
          const s = adj.shares;
          const price = parseFloat(adj.price);
          const fee = adj.fee || 0;
          if (adj.action === 'buy') {
            shares += s;
            cost += s * price + fee;
          } else if (adj.action === 'sell') {
            if (shares > 0) {
              const avgCostPerShare = cost / shares;
              const sell = Math.min(s, shares);
              shares -= sell;
              cost -= sell * avgCostPerShare + fee;
            }
          }
        }
        if (shares > 0 && cost > 0) {
          symbolCost.set(symbol, (symbolCost.get(symbol) || 0) + cost);
        }
      }
      return symbolCost;
    };

    const mappingBySymbol = new Map(mappings.map((m) => [m.symbol, m.categoryId]));
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    // 把 symbol->cost 分桶成族群快照
    const buildSnapshot = (dateKey, symbolCost) => {
      const byCategory = new Map(); // categoryId -> cost
      let unclassifiedCost = 0;
      let totalCost = 0;
      for (const [symbol, cost] of symbolCost) {
        const rounded = Math.round(cost);
        totalCost += rounded;
        const catId = mappingBySymbol.get(symbol);
        if (catId && categoryById.has(catId)) {
          byCategory.set(catId, (byCategory.get(catId) || 0) + rounded);
        } else {
          unclassifiedCost += rounded;
        }
      }
      const denom = totalCost > 0 ? totalCost : 1;
      const cats = [];
      for (const c of categories) {
        const cost = byCategory.get(c.id) || 0;
        if (cost <= 0) continue;
        cats.push({
          id: c.id,
          name: c.name,
          color: c.color,
          isStandby: c.isStandby,
          cost,
          ratio: cost / denom,
        });
      }
      return {
        date: dateKey,
        totalCost,
        categories: cats,
        unclassified: { cost: unclassifiedCost, ratio: unclassifiedCost / denom },
      };
    };

    const current = buildSnapshot(d1, currentSymbolCost);
    const previous = d0 ? buildSnapshot(d0, snapshotCostBySymbol(endOf(d0))) : null;

    // rotation：最新交易日 D1 當天，依族群分桶的賣出 / 買進「成交額」（shares × price），
    // 供前端畫「賣出族群 → 資金池 → 買進族群」的資金輪動 Sankey。
    const buildRotation = (dateKey) => {
      if (!dateKey) return null;
      const sellByCat = new Map();
      const buyByCat = new Map();
      let sellUncl = 0;
      let buyUncl = 0;
      for (const adj of adjustments) {
        if (toDateKey(adj.timestamp) !== dateKey) continue;
        const amount = Math.round(adj.shares * parseFloat(adj.price));
        if (amount <= 0) continue;
        const catId = mappingBySymbol.get(adj.trade.symbol);
        const known = catId && categoryById.has(catId);
        if (adj.action === 'buy') {
          if (known) buyByCat.set(catId, (buyByCat.get(catId) || 0) + amount);
          else buyUncl += amount;
        } else if (adj.action === 'sell') {
          if (known) sellByCat.set(catId, (sellByCat.get(catId) || 0) + amount);
          else sellUncl += amount;
        }
      }
      const toList = (m, uncl) => {
        const arr = [];
        for (const c of categories) {
          const a = m.get(c.id) || 0;
          if (a > 0) arr.push({ id: c.id, name: c.name, color: c.color, amount: a });
        }
        if (uncl > 0) arr.push({ id: null, name: '未分類', color: null, amount: uncl });
        return arr;
      };
      return { date: dateKey, sells: toList(sellByCat, sellUncl), buys: toList(buyByCat, buyUncl) };
    };
    // 由新到舊找「最近一個有實際買賣的交易日」，避免最新日剛好無輪動時畫面空白
    let rotation = null;
    for (let i = dateKeys.length - 1; i >= 0; i -= 1) {
      const rot = buildRotation(dateKeys[i]);
      if (rot && (rot.sells.length > 0 || rot.buys.length > 0)) {
        rotation = rot;
        break;
      }
    }

    return { previous, current, rotation };
  }

  async bulkSetSymbolCategory(userId, symbols, categoryId) {
    if (!Array.isArray(symbols) || symbols.length === 0) {
      throw new ValidationError('symbols must be a non-empty array');
    }
    const cleaned = [...new Set(symbols.map(s => (s ?? '').trim()).filter(Boolean))];
    if (cleaned.length === 0) {
      throw new ValidationError('symbols must contain at least one non-empty value');
    }

    if (categoryId === null || categoryId === undefined || categoryId === '') {
      await prisma.stockCategoryMap.deleteMany({
        where: { userId, symbol: { in: cleaned } },
      });
      return { symbols: cleaned, categoryId: null };
    }

    const category = await prisma.stockCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.userId !== userId) {
      throw new NotFoundError('Category not found');
    }

    await prisma.$transaction(
      cleaned.map(sym =>
        prisma.stockCategoryMap.upsert({
          where: { userId_symbol: { userId, symbol: sym } },
          create: { userId, symbol: sym, categoryId },
          update: { categoryId },
        }),
      ),
    );
    return { symbols: cleaned, categoryId };
  }
}

export default new StockCategoryService();
export { VALID_COLORS };

import prisma from '../config/database.js';
import { AppError, NotFoundError, ValidationError } from '../errors/index.js';
import accountService from './AccountService.js';
import stockPriceService from './StockPriceService.js';

const VALID_COLORS = [
  'red', 'orange', 'gold', 'lime', 'green',
  'cyan', 'blue', 'geekblue', 'purple', 'magenta',
];

const MAX_CATEGORIES_PER_USER = 30;

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

    try {
      return await prisma.stockCategory.update({ where: { id }, data: updates });
    } catch (err) {
      if (err.code === 'P2002') {
        throw new ValidationError(`族群名稱「${updates.name}」已存在`);
      }
      throw err;
    }
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

    // 6) 組各族群結果
    const categoriesResult = categories.map((c) => {
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
        symbolCount: entry.symbols.length,
        marketValue: entry.value,
        actualRatio,
        deltaRatio: targetRatio === null ? null : actualRatio - targetRatio,
        symbols: entry.symbols,
      };
    });

    const unclassifiedValue = unclassifiedSymbols.reduce((s, x) => s + (x.value || 0), 0);

    return {
      totalAssets,
      cashBalance,
      positionsValue,
      categories: categoriesResult,
      unclassified: {
        marketValue: unclassifiedValue,
        actualRatio: unclassifiedValue / denom,
        symbols: unclassifiedSymbols,
      },
    };
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

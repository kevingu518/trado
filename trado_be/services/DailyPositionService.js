import { Prisma } from '@prisma/client';
import prisma from '../config/database.js';

class DailyPositionService {
  async getDailyPositions(userId, options = {}) {
    const {
      page = 1,
      limit = 30,
      startDate,
      endDate,
      symbol,
      direction,
      action,
      sortOrder = 'desc',
    } = options;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(90, Math.max(1, parseInt(limit) || 30));
    const skip = (pageNum - 1) * limitNum;
    const order = sortOrder.toLowerCase() === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;

    // 組 WHERE 條件（與 TradeService.getAllTrades 的日期處理同步）
    const conditions = [
      Prisma.sql`t."userId" = ${userId}`,
      Prisma.sql`pa."deletedAt" IS NULL`,
    ];

    if (startDate) {
      const start = startDate.includes('T')
        ? new Date(startDate)
        : new Date(startDate + 'T00:00:00.000Z');
      conditions.push(Prisma.sql`pa.timestamp >= ${start}`);
    }
    if (endDate) {
      const end = endDate.includes('T')
        ? new Date(endDate)
        : new Date(endDate + 'T23:59:59.999Z');
      conditions.push(Prisma.sql`pa.timestamp <= ${end}`);
    }
    if (symbol) {
      conditions.push(Prisma.sql`t.symbol = ${symbol}`);
    }
    if (direction && ['long', 'short'].includes(direction)) {
      conditions.push(Prisma.sql`t.direction = ${direction}`);
    }
    if (action && ['buy', 'sell'].includes(action)) {
      conditions.push(Prisma.sql`pa.action = ${action}`);
    }

    const whereSql = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

    // 日聚合查詢
    const aggRows = await prisma.$queryRaw(Prisma.sql`
      SELECT
        DATE(pa.timestamp AT TIME ZONE 'UTC')                                   AS date,
        COUNT(*)                                                                AS total_count,
        COUNT(*) FILTER (WHERE pa.action = 'buy')                               AS buy_count,
        COUNT(*) FILTER (WHERE pa.action = 'sell')                              AS sell_count,
        COALESCE(SUM(CASE WHEN pa.action = 'buy'  THEN pa.shares * pa.price END), 0) AS buy_amount,
        COALESCE(SUM(CASE WHEN pa.action = 'sell' THEN pa.shares * pa.price END), 0) AS sell_amount,
        COALESCE(SUM(pa.fee), 0)                                                AS total_fee,
        COALESCE(SUM(pa.tax), 0)                                                AS total_tax,
        ARRAY_AGG(DISTINCT t.symbol)                                            AS symbols
      FROM "PositionAdjustment" pa
      JOIN "Trade" t ON pa."tradeId" = t.id
      ${whereSql}
      GROUP BY DATE(pa.timestamp AT TIME ZONE 'UTC')
      ORDER BY date ${order}
      LIMIT ${limitNum} OFFSET ${skip}
    `);

    const totalRows = await prisma.$queryRaw(Prisma.sql`
      SELECT COUNT(DISTINCT DATE(pa.timestamp AT TIME ZONE 'UTC')) AS total
      FROM "PositionAdjustment" pa
      JOIN "Trade" t ON pa."tradeId" = t.id
      ${whereSql}
    `);
    const total = Number(totalRows[0]?.total || 0);

    if (aggRows.length === 0) {
      return {
        days: [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: 0,
          hasNext: false,
          hasPrev: pageNum > 1,
        },
      };
    }

    // 將 SQL DATE() 結果統一成 'YYYY-MM-DD' 字串
    const toDateKey = (d) => (d instanceof Date
      ? d.toISOString().slice(0, 10)
      : String(d).slice(0, 10));

    const dateKeys = aggRows.map(r => toDateKey(r.date));
    const minDate = new Date(dateKeys[dateKeys.length - 1] + 'T00:00:00.000Z');
    const maxDate = new Date(dateKeys[0] + 'T23:59:59.999Z');
    const lowerBound = sortOrder.toLowerCase() === 'asc'
      ? new Date(dateKeys[0] + 'T00:00:00.000Z')
      : minDate;
    const upperBound = sortOrder.toLowerCase() === 'asc'
      ? new Date(dateKeys[dateKeys.length - 1] + 'T23:59:59.999Z')
      : maxDate;

    // 取本頁日期區間內的所有 adjustments 明細（含父交易 symbol/direction/strategy）
    const detailWhere = {
      deletedAt: null,
      timestamp: { gte: lowerBound, lte: upperBound },
      trade: { userId },
      ...(action && ['buy', 'sell'].includes(action) && { action }),
    };
    if (symbol || direction) {
      detailWhere.trade = {
        userId,
        ...(symbol && { symbol }),
        ...(direction && ['long', 'short'].includes(direction) && { direction }),
      };
    }

    const adjustments = await prisma.positionAdjustment.findMany({
      where: detailWhere,
      include: {
        trade: {
          select: {
            id: true,
            symbol: true,
            direction: true,
            strategy: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    // bucket 到對應日期
    const buckets = new Map();
    for (const key of dateKeys) buckets.set(key, []);
    for (const adj of adjustments) {
      const key = toDateKey(adj.timestamp);
      if (buckets.has(key)) buckets.get(key).push(adj);
    }

    const days = aggRows.map(row => {
      const dateKey = toDateKey(row.date);
      const buyAmount = Number(row.buy_amount) || 0;
      const sellAmount = Number(row.sell_amount) || 0;
      const totalFee = Number(row.total_fee) || 0;
      const totalTax = Number(row.total_tax) || 0;
      return {
        date: dateKey,
        totalCount: Number(row.total_count) || 0,
        buyCount: Number(row.buy_count) || 0,
        sellCount: Number(row.sell_count) || 0,
        buyAmount,
        sellAmount,
        totalFee,
        totalTax,
        netCashFlow: sellAmount - buyAmount - totalFee - totalTax,
        symbols: Array.isArray(row.symbols) ? row.symbols.filter(Boolean) : [],
        adjustments: buckets.get(dateKey) || [],
      };
    });

    const totalPages = Math.ceil(total / limitNum);

    return {
      days,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    };
  }
}

export default new DailyPositionService();

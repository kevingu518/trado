import strategyService from '../services/StrategyService.js';

class StrategyController {
  // 使用箭頭函數，自動綁定 this，不需要 .bind()
  // 移除 try-catch，由 asyncHandler 統一處理錯誤

  getAllStrategies = async (req, res) => {
    const userId = req.user.id;
    
    // 從 query parameters 取得 pagination 和篩選參數
    const {
      page,
      limit,
      category,
      isActive,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await strategyService.getAllStrategies(userId, {
      page,
      limit,
      category,
      isActive,
      sortBy,
      sortOrder,
    });

    res.json({
      success: true,
      data: result.strategies,
      pagination: result.pagination,
    });
  };

  getStrategyById = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const includePerformance = req.query.includePerformance === 'true';
    
    if (includePerformance) {
      const strategy = await strategyService.getStrategyByIdWithPerformance(id, userId);
      res.json({
        success: true,
        data: strategy,
      });
    } else {
      const strategy = await strategyService.getStrategyById(id, userId);
      res.json({
        success: true,
        data: strategy,
      });
    }
  };

  createStrategy = async (req, res) => {
    const userId = req.user.id;
    const strategy = await strategyService.createStrategy(req.body, userId);
    
    res.status(201).json({
      success: true,
      data: strategy,
    });
  };

  updateStrategy = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const strategy = await strategyService.updateStrategy(id, req.body, userId);
    
    res.json({
      success: true,
      data: strategy,
    });
  };

  deleteStrategy = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await strategyService.deleteStrategy(id, userId);
    
    res.json({
      success: true,
      data: result,
    });
  };

  // 績效相關端點
  getCurrentPerformance = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const performance = await strategyService.getCurrentPerformance(id, userId);
    
    res.json({
      success: true,
      data: performance,
    });
  };

  recalculatePerformance = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { periodStart, periodEnd } = req.body;
    
    const startDate = periodStart ? new Date(periodStart) : null;
    const endDate = periodEnd ? new Date(periodEnd) : null;
    
    const performance = await strategyService.calculateAndCreateSnapshot(
      id, 
      startDate, 
      endDate
    );
    
    res.json({
      success: true,
      data: performance,
    });
  };

  updatePerformanceManually = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const performance = await strategyService.updatePerformanceManually(
      id, 
      req.body, 
      userId
    );
    
    res.json({
      success: true,
      data: performance,
    });
  };

  getSnapshots = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const snapshots = await strategyService.getStrategySnapshots(id, userId);
    
    res.json({
      success: true,
      data: snapshots,
    });
  };

  createPeriodSnapshot = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { periodStart, periodEnd } = req.body;
    
    if (!periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        message: 'periodStart and periodEnd are required',
      });
    }
    
    const snapshot = await strategyService.createPeriodSnapshot(
      id,
      new Date(periodStart),
      new Date(periodEnd),
      userId
    );
    
    res.status(201).json({
      success: true,
      data: snapshot,
    });
  };
}

export default new StrategyController();

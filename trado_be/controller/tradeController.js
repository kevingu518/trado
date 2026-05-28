import tradeService from '../services/TradeService.js';
import positionAdjustmentService from '../services/PositionAdjustmentService.js';
import dailyPositionService from '../services/DailyPositionService.js';

class TradeController {
  // 使用箭頭函數，自動綁定 this，不需要 .bind()
  // 移除 try-catch，由 asyncHandler 統一處理錯誤

  getAllTrades = async (req, res) => {
    const userId = req.user.id;
    
    // 從 query parameters 取得 pagination 和篩選參數
    const {
      page,
      limit,
      status,
      symbol,
      direction,
      startDate,
      endDate,
      strategy,
      sortBy,
      sortOrder,
    } = req.query;

    const result = await tradeService.getAllTrades(userId, {
      page,
      limit,
      status,
      symbol,
      direction,
      startDate,
      endDate,
      strategy,
      sortBy,
      sortOrder,
    });

    res.json({
      success: true,
      data: result.trades,
      pagination: result.pagination,
    });
  };

  getDailyPositions = async (req, res) => {
    const userId = req.user.id;
    const {
      page,
      limit,
      startDate,
      endDate,
      symbol,
      direction,
      action,
      sortOrder,
    } = req.query;

    const result = await dailyPositionService.getDailyPositions(userId, {
      page,
      limit,
      startDate,
      endDate,
      symbol,
      direction,
      action,
      sortOrder,
    });

    res.json({
      success: true,
      data: result.days,
      pagination: result.pagination,
    });
  };

  getTradeById = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const trade = await tradeService.getTradeById(id, userId);
    
    res.json({
      success: true,
      data: trade,
    });
  };

  createTrade = async (req, res) => {
    const userId = req.user.id;
    const trade = await tradeService.createTrade(req.body, userId);
    
    res.status(201).json({
      success: true,
      data: trade,
    });
  };

  updateTrade = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const trade = await tradeService.updateTrade(id, req.body, userId);
    
    res.json({
      success: true,
      data: trade,
    });
  };

  deleteTrade = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await tradeService.deleteTrade(id, userId);
    
    res.json({
      success: true,
      data: result,
    });
  };

  getPositions = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const positions = await positionAdjustmentService.getAdjustmentsByTradeId(id, userId);
    
    res.json({
      success: true,
      data: positions,
    });
  };

  createPosition = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const position = await positionAdjustmentService.createAdjustment(id, req.body, userId);
    
    res.status(201).json({
      success: true,
      data: position,
    });
  };

  updatePosition = async (req, res) => {
    const { positionId } = req.params;
    const userId = req.user.id;
    const position = await positionAdjustmentService.updateAdjustment(positionId, req.body, userId);
    
    res.json({
      success: true,
      data: position,
    });
  };

  deletePosition = async (req, res) => {
    const { positionId } = req.params;
    const userId = req.user.id;
    const result = await positionAdjustmentService.deleteAdjustment(positionId, userId);
    
    res.json({
      success: true,
      data: result,
    });
  };
}

export default new TradeController();

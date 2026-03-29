class HealthController {
  // 使用箭頭函數，自動綁定 this
  check = async (req, res) => {
    res.json({
      success: true,
      message: 'API is healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    });
  };
}

export default new HealthController();

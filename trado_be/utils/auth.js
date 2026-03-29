// 認證工具函數
// 暫時從 header 取得 userId，之後可以改成從 JWT token 解析

export const getUserIdFromRequest = (req) => {
  // 暫時從 header 取得 userId（開發階段）
  // 之後可以改成從 JWT token 解析
  const userId = req.headers['x-user-id'] || req.user?.id;
  
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  return userId;
};

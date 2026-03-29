import { AppError } from '../errors/index.js';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt.js';

/**
 * JWT 認證 middleware
 * 從 Authorization header 中提取並驗證 JWT token
 */
export const authenticate = async (req, res, next) => {
  try {
    // 從 header 中提取 token
    const token = extractTokenFromHeader(req);
    
    if (!token) {
      throw new AppError('Authentication required. Please provide a valid token.', 401);
    }

    // 驗證 token
    const decoded = verifyToken(token);
    
    // 將用戶資訊存到 req.user 供後續使用
    req.user = {
      id: decoded.userId || decoded.id,
      email: decoded.email,
    };
    
    next();
  } catch (error) {
    if (error.message === 'Token has expired') {
      return next(new AppError('Token has expired. Please login again.', 401));
    } else if (error.message === 'Invalid token') {
      return next(new AppError('Invalid token. Please provide a valid token.', 401));
    }
    next(error);
  }
};

/**
 * 可選的認證 middleware
 * 如果沒有 token 也可以通過，但 req.user 會是 null
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req);
    
    if (token) {
      const decoded = verifyToken(token);
      req.user = {
        id: decoded.userId || decoded.id,
        email: decoded.email,
      };
    } else {
      req.user = null;
    }
    
    next();
  } catch (error) {
    // 如果 token 無效，設定為 null 但繼續執行
    req.user = null;
    next();
  }
};

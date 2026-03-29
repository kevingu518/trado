import jwt from 'jsonwebtoken';
import appConfig from '../config/app.js';

/**
 * 生成 JWT token
 * @param {Object} payload - Token payload (通常包含 userId)
 * @param {string} expiresIn - Token 過期時間（可選，預設使用 config）
 * @returns {string} JWT token
 */
export const generateToken = (payload, expiresIn = null) => {
  return jwt.sign(payload, appConfig.jwt.secret, {
    expiresIn: expiresIn || appConfig.jwt.expiresIn,
  });
};

/**
 * 生成 Refresh Token
 * @param {Object} payload - Token payload
 * @returns {string} Refresh token
 */
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, appConfig.jwt.secret, {
    expiresIn: appConfig.jwt.refreshExpiresIn,
  });
};

/**
 * 驗證 JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 * @throws {Error} 如果 token 無效或過期
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, appConfig.jwt.secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
};

/**
 * 解碼任意 JWT（不驗證簽章）
 * 用來 debug 第三方（例如 Google）簽發的 token
 */
export const decodeToken = (token, options = {}) => {
  if (!token) return null;
  return jwt.decode(token, { complete: true, ...options });
};

/**
 * 從 Authorization header 中提取 token
 * @param {Object} req - Express request object
 * @returns {string|null} Token 或 null
 */
export const extractTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }

  // 支援 "Bearer <token>" 格式
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }

  return null;
};

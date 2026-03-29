import express from 'express';
import authController from '../controller/authController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/index.js';

const router = express.Router();

// Google OAuth 登入/註冊
// 舊路徑（保留相容）
router.post('/google', asyncHandler(authController.googleLogin));
// 新路徑：/api/auth/google-login
router.post('/google-login', asyncHandler(authController.googleLogin));

// 開發用：解碼並檢視 Google JWT / 任何 JWT
router.post('/google-token-debug', asyncHandler(authController.debugGoogleToken));

// 使用 Refresh Token 更新 Access Token
router.post('/refresh', asyncHandler(authController.refreshToken));

// 取得當前用戶資訊（需要認證）
router.get('/me', authenticate, asyncHandler(authController.getCurrentUser));

// 登出
router.post('/logout', authenticate, asyncHandler(authController.logout));

// 開發用端點（只在開發環境啟用）
router.post('/dev/login', asyncHandler(authController.devLogin));
router.post('/dev/create-user', asyncHandler(authController.devCreateUser));

export default router;

import userService from '../services/UserService.js';
import { generateToken, generateRefreshToken, verifyToken, decodeToken } from '../utils/jwt.js';
import { AppError } from '../errors/index.js';
import appConfig from '../config/app.js';

class AuthController {
  // 使用箭頭函數，自動綁定 this，不需要 .bind()
  // 移除 try-catch，由 asyncHandler 統一處理錯誤

  /**
   * Google OAuth 登入/註冊
   * 接收 Google OAuth 回調的資料
   */
  googleLogin = async (req, res) => {
    const { credential } = req.body;

    if (!credential) {
      throw new AppError('Google credential is required', 400);
    }

    // 這裡解的是 Google 的 ID token（JWT）
    const decoded = decodeToken(credential);

    if (!decoded) {
      throw new AppError('Invalid Google credential', 400);
    }

    const { sub, email, email_verified, name, picture } = decoded.payload;

    if (!sub || !email) {
      throw new AppError('Google ID (sub) and email are required', 400);
    }

    // 更新或建立用戶（sub 當作 googleId 存起來）
    const user = await userService.upsertUserByGoogle({
      googleId: sub,
      email,
      name,
      picture,
      emailVerified: !!email_verified,
    });

    // 生成 JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    // 生成 Refresh token
    const refreshTokenJWT = generateRefreshToken({
      userId: user.id,
      email: user.email,
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
        },
        token,
        refreshToken: refreshTokenJWT,
      },
    });
  };

  /**
   * 開發用：解碼任意 JWT（例如 Google ID token），並在後端 console 印出 payload
   */
  debugGoogleToken = async (req, res) => {
    const { token, idToken } = req.body;
    const rawToken = token || idToken;

    if (!rawToken) {
      throw new AppError('Token (or idToken) is required', 400);
    }

    const decoded = decodeToken(rawToken, { complete: true });

    console.log('🔍 Decoded Google JWT:', JSON.stringify(decoded, null, 2));

    res.json({
      success: true,
      data: decoded,
    });
  };

  /**
   * 使用 Refresh Token 更新 Access Token
   */
  refreshToken = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400);
    }

    // 驗證 refresh token
    const decoded = verifyToken(refreshToken);

    // 取得用戶資訊
    const user = await userService.getUserById(decoded.userId || decoded.id);

    // 生成新的 access token
    const newToken = generateToken({
      userId: user.id,
      email: user.email,
    });

    res.json({
      success: true,
      data: {
        token: newToken,
      },
    });
  };

  /**
   * 取得當前用戶資訊
   */
  getCurrentUser = async (req, res) => {
    const userId = req.user.id;
    const user = await userService.getUserById(userId);

    res.json({
      success: true,
      data: user,
    });
  };

  /**
   * 登出（客戶端需要刪除 token）
   */
  logout = async (req, res) => {
    // JWT 是無狀態的，所以登出主要是客戶端刪除 token
    // 如果需要，可以在這裡加入 token 黑名單機制
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  };

  /**
   * 開發用：用 email 取得 token
   * 只在開發環境啟用
   */
  devLogin = async (req, res) => {
    // 只在開發環境啟用
    if (appConfig.nodeEnv === 'production') {
      throw new AppError('This endpoint is not available in production', 403);
    }

    const { email } = req.body;

    if (!email) {
      throw new AppError('Email is required', 400);
    }

    // 用 email 取得用戶
    const user = await userService.getUserByEmail(email);
    
    if (!user) {
      throw new AppError('User not found. Please use /api/auth/dev/create-user to create a user first.', 404);
    }

    // 生成 JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    // 生成 Refresh token
    const refreshTokenJWT = generateRefreshToken({
      userId: user.id,
      email: user.email,
    });

    res.json({
      success: true,
      message: 'Dev login successful (only available in development)',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
        },
        token,
        refreshToken: refreshTokenJWT,
      },
    });
  };

  /**
   * 開發用：建立測試用戶並取得 token
   * 只在開發環境啟用
   */
  devCreateUser = async (req, res) => {
    // 只在開發環境啟用
    if (appConfig.nodeEnv === 'production') {
      throw new AppError('This endpoint is not available in production', 403);
    }

    const { email, name, picture } = req.body;

    if (!email) {
      throw new AppError('Email is required', 400);
    }

    // 檢查用戶是否已存在
    let user = await userService.getUserByEmail(email).catch(() => null);

    if (!user) {
      // 用戶不存在，建立新用戶
      const googleId = `dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      user = await userService.createUser({
        email,
        name: name || 'Dev User',
        picture: picture || null,
        googleId,
      });
    }

    // 生成 JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    // 生成 Refresh token
    const refreshTokenJWT = generateRefreshToken({
      userId: user.id,
      email: user.email,
    });

    res.json({
      success: true,
      message: 'Dev user created/login successful (only available in development)',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          picture: user.picture,
        },
        token,
        refreshToken: refreshTokenJWT,
      },
    });
  };
}

export default new AuthController();

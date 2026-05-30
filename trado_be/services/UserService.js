import prisma from '../config/database.js';
import { NotFoundError, AppError } from '../errors/index.js';
import { SYSTEM_STRATEGY_NAME } from './StrategyService.js';

class UserService {
  /**
   * 根據 ID 取得用戶
   */
  async getUserById(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
        // 不返回敏感資訊
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  /**
   * 根據 email 取得用戶
   */
  async getUserByEmail(email) {
    return await prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * 根據 Google ID 取得用戶
   */
  async getUserByGoogleId(googleId) {
    return await prisma.user.findUnique({
      where: { googleId },
    });
  }

  /**
   * 建立新用戶（Google OAuth）
   */
  async createUser(data) {
    // 檢查 email 是否已存在
    const existingUser = await this.getUserByEmail(data.email).catch(() => null);
    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    // 檢查 googleId 是否已存在
    const existingGoogleUser = await this.getUserByGoogleId(data.googleId).catch(() => null);
    if (existingGoogleUser) {
      throw new AppError('User with this Google ID already exists', 409);
    }

    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data,
        select: {
          id: true,
          email: true,
          name: true,
          picture: true,
          googleId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // 每位使用者建立時，預先準備一筆「未分類」系統策略
      await tx.strategy.create({
        data: {
          userId: user.id,
          name: SYSTEM_STRATEGY_NAME,
          isSystem: true,
          isActive: true,
        },
      });

      return user;
    });
  }

  /**
   * 更新用戶資訊
   */
  async updateUser(id, data) {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        googleId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 更新或建立用戶（Google OAuth 使用）
   */
  async upsertUserByGoogle(googleData) {
    const { googleId, email, name, picture, emailVerified } = googleData;

    // 嘗試根據 googleId 或 email 找到現有用戶
    let user = await this.getUserByGoogleId(googleId).catch(() => null);
    
    if (!user) {
      user = await this.getUserByEmail(email).catch(() => null);
    }

    if (user) {
      // 更新現有用戶
      return await this.updateUser(user.id, {
        name: name || user.name,
        picture: picture || user.picture,
        emailVerified: typeof emailVerified === 'boolean' ? emailVerified : user.emailVerified,
        updatedAt: new Date(),
      });
    } else {
      // 建立新用戶
      return await this.createUser({
        email,
        name,
        picture,
        googleId,
        emailVerified: !!emailVerified,
      });
    }
  }

  /**
   * 更新用戶的 token
   */
  async updateUserTokens(id, accessToken, refreshToken) {
    return await prisma.user.update({
      where: { id },
      data: {
        accessToken,
        refreshToken,
        updatedAt: new Date(),
      },
    });
  }
}

export default new UserService();

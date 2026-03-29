import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// 假資料生成函數
const generateRandomString = (length) => {
  return Math.random().toString(36).substring(2, length + 2);
};

const generateRandomDecimal = (min, max, decimals = 2) => {
  const value = Math.random() * (max - min) + min;
  return parseFloat(value.toFixed(decimals));
};

const generateRandomInteger = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// 台股股票代號（常見的）
const symbols = ['2330', '2317', '2454', '2308', '2412', '1301', '1303', '2891', '2882', '2886', '2892', '2002', '2207', '2382', '2303'];
const directions = ['long', 'short'];
const statuses = ['open', 'closed'];
const actions = ['buy', 'sell'];

async function main() {
  console.log('🌱 開始生成假資料...');

  // 清理現有資料（可選）
  console.log('🧹 清理現有資料...');
  await prisma.positionAdjustment.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.user.deleteMany();

  // 建立測試用戶
  console.log('👤 建立測試用戶...');
  const users = [];
  for (let i = 1; i <= 3; i++) {
    const user = await prisma.user.create({
      data: {
        email: `test${i}@example.com`,
        name: `Test User ${i}`,
        googleId: `google_${Date.now()}_${i}`,
        picture: `https://i.pravatar.cc/150?img=${i}`,
      },
    });
    users.push(user);
    console.log(`  ✓ 建立用戶: ${user.email} (${user.id})`);
  }

  // 為每個用戶建立交易
  console.log('📊 建立交易資料...');
  for (const user of users) {
    const tradeCount = Math.floor(Math.random() * 5) + 3; // 每個用戶 3-7 筆交易

    for (let i = 0; i < tradeCount; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const direction = directions[Math.floor(Math.random() * directions.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const totalShares = generateRandomInteger(1, 1000); // 整數，1-1000 股
      const avgPrice = generateRandomDecimal(10, 1000, 2); // 小數點後2位，10-1000 元
      const profitLoss = status === 'closed' ? generateRandomInteger(-50000, 100000) : null; // 整數，虧損或獲利
      const createdAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // 過去 30 天內
      const closedAt = status === 'closed' ? new Date(createdAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000) : null;

      const trade = await prisma.trade.create({
        data: {
          userId: user.id,
          symbol,
          assetType: 'stock',
          direction,
          status,
          totalShares,
          avgPrice,
          profitLoss,
          followedDiscipline: Math.random() > 0.5,
          reviewNotes: Math.random() > 0.7 ? `這是一個測試交易的備註 ${i + 1}` : null,
          exitReason: status === 'closed' && Math.random() > 0.5 ? 'target_reached' : null,
          createdAt,
          closedAt,
        },
      });

      console.log(`  ✓ 建立交易: ${trade.symbol} ${trade.direction} (${trade.status}) - User: ${user.email}`);

      // 為每筆交易建立位置調整
      const adjustmentCount = Math.floor(Math.random() * 3) + 1; // 每筆交易 1-3 個調整

      for (let j = 0; j < adjustmentCount; j++) {
        const action = actions[Math.floor(Math.random() * actions.length)];
        const shares = generateRandomInteger(1, 100); // 整數，1-100 股
        const price = generateRandomDecimal(50, 500, 2); // 小數點後2位，50-500 元
        const fee = generateRandomInteger(0, 100); // 整數，0-100 元
        const stopLoss = Math.random() > 0.5 ? generateRandomDecimal(price * 0.8, price * 0.95, 2) : null; // 停損價格為價格的 80-95%
        const note = Math.random() > 0.6 ? `位置調整備註 ${j + 1}: 這是第 ${j + 1} 次調整` : null;
        const timestamp = new Date(createdAt.getTime() + j * 24 * 60 * 60 * 1000); // 交易建立後幾天

        await prisma.positionAdjustment.create({
          data: {
            tradeId: trade.id,
            action,
            shares,
            price,
            fee,
            stopLoss,
            note,
            timestamp,
          },
        });
      }
    }
  }

  console.log('✅ 假資料生成完成！');
  console.log(`\n📈 統計:`);
  console.log(`  - 用戶數: ${users.length}`);
  
  const tradeCount = await prisma.trade.count();
  console.log(`  - 交易數: ${tradeCount}`);
  
  const adjustmentCount = await prisma.positionAdjustment.count();
  console.log(`  - 位置調整數: ${adjustmentCount}`);
}

main()
  .catch((e) => {
    console.error('❌ 生成假資料時發生錯誤:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

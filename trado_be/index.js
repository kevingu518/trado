import express from 'express';
import cors from 'cors';
import appConfig from './config/app.js';
import prisma from './config/database.js';
import { errorHandler } from './errors/index.js';
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import tradeRoutes from './routes/tradeRoutes.js';
import strategyRoutes from './routes/strategyRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import devRoutes from './routes/devRoutes.js';
import './jobs/snapshotJob.js';

const app = express();

// CORS 設定：明確允許本機前端
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map(s => s.trim()) : []),
];

// 開發環境允許區網 IP (192.168.x.x / 10.x.x.x / 172.16-31.x.x) 在 5173/3000
const lanOriginRegex = /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):(5173|3000)$/;

app.use(
  cors({
    origin: (origin, callback) => {
      // 無 origin（例如 Postman、curl）一律允許
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin) || lanOriginRegex.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true, // 如果之後要用 cookies / auth header，可以保留為 true
  })
);

// JSON body parser
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Trado API is running!',
    version: '1.0.0',
  });
});

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/strategies', strategyRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/dev', devRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
    },
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// 啟動伺服器
const PORT = appConfig.port;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
});

// 優雅關閉
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

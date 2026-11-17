import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.config';
import { requestId } from './middlewares/request-id.middleware';
import { indexRouter } from './routes/index.route';

const app: Express = express();

// 1. CORS PHẢI LÀ MIDDLEWARE ĐẦU TIÊN để xử lý Preflight (OPTIONS) và gán header cho mọi response (kể cả lỗi/rate-limit)
const allowedOrigins = [
  env.CLIENT_URL,
  'https://frontend-shop-gamma.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5000',
]
  .filter(Boolean)
  .map((url) => url.replace(/\/+$/, '').trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép requests không có origin (ví dụ: server-to-server, mobile app, postman, curl)
      if (!origin) return callback(null, true);

      const cleanOrigin = origin.replace(/\/+$/, '').trim();
      const isAllowed =
        allowedOrigins.includes(cleanOrigin) ||
        /\.vercel\.app$/.test(cleanOrigin); // Hỗ trợ mọi preview domain từ Vercel

      if (isAllowed) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-guest-id',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['x-guest-id'],
    optionsSuccessStatus: 200,
  })
);

app.use(helmet());
app.use(requestId);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS', // Không tính OPTIONS preflight vào rate limit
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
});

app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

indexRouter(app);

export default app;

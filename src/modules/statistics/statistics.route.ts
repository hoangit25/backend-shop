import { Router } from 'express';
import { optionalAuth } from '../cart/cart.route';
import { statisticsController } from './statistics.controller';

const router = Router();

// 1. Ghi nhận lượt truy cập (Public)
router.post('/track', statisticsController.trackVisit);

// 2. Thống kê dữ liệu Dashboard (Chỉ dành cho Admin)
router.get('/dashboard', optionalAuth, statisticsController.getDashboardStatistics);

export const statisticsRouter = router;
export default router;

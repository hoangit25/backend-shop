import { Request, Response } from 'express';
import { ApiResponse } from '../../common/api.responsitory';
import { asyncHandler } from '../../common/asycn.handel';
import { AppError } from '../../common/appError';
import { StatisticsService, statisticsService } from './statistics.service';
import { extractOrderIdentity } from '../order/order.controller';

export class StatisticsController {
  constructor(private service: StatisticsService = statisticsService) {}

  /**
   * 1. Ghi nhận lượt truy cập (Public)
   * Client Frontend gửi ping khi tải trang
   */
  trackVisit = asyncHandler(async (req: Request, res: Response) => {
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '';

    const userAgent = req.headers['user-agent'] || '';

    const result = await this.service.recordVisit(req.body, clientIp, userAgent);
    return ApiResponse.success(res, result, 'Visit tracked');
  });

  /**
   * 2. Lấy thống kê tổng quan và biểu đồ theo thời gian (Admin Protected)
   */
  getDashboardStatistics = asyncHandler(async (req: Request, res: Response) => {
    const identity = extractOrderIdentity(req, res);
    if (!identity.isAdmin) {
      throw AppError.Forbidden(
        'Chỉ Quản trị viên (Admin) mới có quyền truy cập dữ liệu thống kê quản trị',
        'FORBIDDEN'
      );
    }

    const { preset, startDate, endDate } = req.query as {
      preset?: '7_days' | '30_days' | '90_days' | 'custom';
      startDate?: string;
      endDate?: string;
    };

    const stats = await this.service.getDashboardStatistics({
      preset,
      startDate,
      endDate,
    });

    return ApiResponse.success(res, stats, 'Dashboard statistics retrieved successfully');
  });
}

export const statisticsController = new StatisticsController();

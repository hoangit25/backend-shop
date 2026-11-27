import crypto from 'crypto';
import { AppError } from '../../common/appError';
import { TrafficSource } from './visitor.model';
import {
  StatisticsRepository,
  statisticsRepository,
  DailyTrafficStat,
  DailyOrderStat,
  DailyUserStat,
  TrafficSourceDistribution,
} from './statistics.repository';

export interface DashboardFilterQuery {
  preset?: '7_days' | '30_days' | '90_days' | 'custom';
  startDate?: string;
  endDate?: string;
}

export interface UnifiedDailyTimelineItem {
  date: string; // YYYY-MM-DD
  visits: number;
  totalOrders: number;
  successfulOrders: number;
  revenue: number;
  newUsers: number;
  cumulativeUsers?: number;
}

export interface DashboardSummary {
  totalVisits: number;
  totalOrders: number;
  totalSuccessfulOrders: number;
  totalRevenue: number;
  totalNewUsers: number;
  cumulativeUsers: number;
}

export interface DashboardStatisticsResponse {
  dateRange: {
    startDate: string;
    endDate: string;
    preset: string;
    daysCount: number;
  };
  summary: DashboardSummary;
  timeline: UnifiedDailyTimelineItem[];
  trafficSources: TrafficSourceDistribution[];
}

export interface TrackVisitDto {
  visitorId?: string;
  sessionId?: string;
  path?: string;
  source?: string;
  referrer?: string;
}

// Danh sách các user agent của bot/crawler phổ biến
const BOT_USER_AGENTS = [
  'googlebot',
  'bingbot',
  'yandexbot',
  'duckduckbot',
  'slurp',
  'baiduspider',
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'embedly',
  'quora link preview',
  'showyoubot',
  'outbrain',
  'pinterest/0.',
  'developers.google.com/+/web/snippet',
  'slackbot',
  'vkshare',
  'w3c_validator',
  'redditbot',
  'applebot',
  'whatsapp',
  'flipboard',
  'tumblr',
  'bitlybot',
  'skypeuripreview',
  'nuzzel',
  'discordbot',
  'google page speed',
  'qwantify',
  'pinterestbot',
  'bitrix link preview',
  'xing-contenttabreceiver',
  'chrome-lighthouse',
  'telegrambot',
];

export class StatisticsService {
  constructor(private repository: StatisticsRepository = statisticsRepository) {}

  /**
   * Helper chuyển đổi Date sang chuỗi YYYY-MM-DD theo múi giờ Việt Nam (+07:00)
   */
  private formatDateVN(date: Date): string {
    const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    return vnTime.toISOString().slice(0, 10);
  }

  /**
   * Phân tích và sinh dải ngày chuẩn xác theo múi giờ Việt Nam
   */
  private resolveDateRange(query: DashboardFilterQuery): {
    startUtc: Date;
    endUtc: Date;
    startDateStr: string;
    endDateStr: string;
    preset: string;
  } {
    const now = new Date();
    const todayStr = this.formatDateVN(now);
    let startDateStr = '';
    let endDateStr = todayStr;
    const preset = query.preset || '30_days';

    if (preset === '7_days') {
      const past = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      startDateStr = this.formatDateVN(past);
    } else if (preset === '90_days') {
      const past = new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000);
      startDateStr = this.formatDateVN(past);
    } else if (preset === 'custom' && query.startDate && query.endDate) {
      startDateStr = query.startDate.trim();
      endDateStr = query.endDate.trim();
    } else {
      // Mặc định: 30 ngày gần nhất
      const past = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
      startDateStr = this.formatDateVN(past);
    }

    // Validate format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDateStr) || !dateRegex.test(endDateStr)) {
      throw AppError.BadRequest('Định dạng ngày không hợp lệ. Vui lòng dùng YYYY-MM-DD', 'INVALID_DATE_FORMAT');
    }

    if (startDateStr > endDateStr) {
      throw AppError.BadRequest('Ngày bắt đầu không được lớn hơn ngày kết thúc', 'START_DATE_AFTER_END_DATE');
    }

    // Tính số ngày và chặn nếu vượt quá 365 ngày để bảo vệ database
    const diffDays = Math.round(
      (new Date(`${endDateStr}T00:00:00Z`).getTime() - new Date(`${startDateStr}T00:00:00Z`).getTime()) /
        (24 * 60 * 60 * 1000)
    ) + 1;

    if (diffDays > 365) {
      throw AppError.BadRequest('Khoảng thời gian thống kê không được vượt quá 365 ngày', 'DATE_RANGE_TOO_LARGE');
    }

    // Quy đổi về Date UTC boundary chuẩn (+07:00)
    const startUtc = new Date(`${startDateStr}T00:00:00.000+07:00`);
    const endUtc = new Date(`${endDateStr}T23:59:59.999+07:00`);

    return {
      startUtc,
      endUtc,
      startDateStr,
      endDateStr,
      preset,
    };
  }

  /**
   * Sinh mảng liên tục các ngày YYYY-MM-DD từ start đến end
   */
  private generateDateSequence(startDateStr: string, endDateStr: string): string[] {
    const dates: string[] = [];
    const current = new Date(`${startDateStr}T12:00:00Z`);
    const end = new Date(`${endDateStr}T12:00:00Z`);

    while (current <= end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Xác định nguồn truy cập (DIRECT, GOOGLE, FACEBOOK, OTHER)
   */
  private determineTrafficSource(rawSource?: string, referrer?: string): TrafficSource {
    const s = (rawSource || '').toUpperCase();
    if (s === 'GOOGLE' || s === 'FACEBOOK' || s === 'DIRECT' || s === 'OTHER') {
      return s as TrafficSource;
    }

    const ref = (referrer || '').toLowerCase();
    if (!ref) return 'DIRECT';
    if (ref.includes('google.')) return 'GOOGLE';
    if (ref.includes('facebook.') || ref.includes('fb.com') || ref.includes('m.facebook.')) return 'FACEBOOK';
    return 'OTHER';
  }

  /**
   * 1. Ghi nhận lượt truy cập website (Public endpoint cho client gọi)
   */
  async recordVisit(dto: TrackVisitDto, clientIp?: string, userAgent?: string) {
    const ua = (userAgent || '').toLowerCase();
    const isBot = BOT_USER_AGENTS.some((bot) => ua.includes(bot));

    // Sinh ID nếu client chưa có
    const visitorId = dto.visitorId?.trim() || `vis_${crypto.randomUUID()}`;
    const sessionId = dto.sessionId?.trim() || `ses_${crypto.randomUUID()}`;

    // Kiểm tra xem session này đã được ghi nhận trong 30 phút qua chưa
    // (Tránh trường hợp người dùng F5 liên tục hoặc chuyển page ghi nhận tràn lan)
    const recent = await this.repository.findRecentVisit(sessionId, 30 * 60 * 1000);
    if (recent) {
      return {
        recorded: false,
        message: 'Session already tracked recently',
        visitorId,
        sessionId,
      };
    }

    const source = this.determineTrafficSource(dto.source, dto.referrer);
    const ipHash = clientIp ? crypto.createHash('sha256').update(clientIp).digest('hex').slice(0, 16) : '';

    await this.repository.trackVisit({
      visitorId,
      sessionId,
      source,
      path: dto.path || '/',
      ipHash,
      userAgent: userAgent ? userAgent.slice(0, 255) : '',
      isBot,
      visitedAt: new Date(),
    });

    return {
      recorded: true,
      message: 'Visit tracked successfully',
      visitorId,
      sessionId,
    };
  }

  /**
   * 2. Lấy dữ liệu thống kê tổng hợp cho Admin Dashboard
   */
  async getDashboardStatistics(query: DashboardFilterQuery): Promise<DashboardStatisticsResponse> {
    const { startUtc, endUtc, startDateStr, endDateStr, preset } = this.resolveDateRange(query);

    // 1. Lấy danh sách ID các Role Admin để loại trừ
    const adminRoleIds = await this.repository.getAdminRoleIds();

    // 2. Chạy song song các Aggregation Pipelines trong MongoDB
    const [dailyTraffic, trafficSources, dailyOrders, dailyUsers, cumulativeUsers] = await Promise.all([
      this.repository.aggregateDailyTraffic(startUtc, endUtc),
      this.repository.aggregateTrafficSources(startUtc, endUtc),
      this.repository.aggregateDailyOrders(startUtc, endUtc),
      this.repository.aggregateDailyNewUsers(startUtc, endUtc, adminRoleIds),
      this.repository.countCumulativeUsers(endUtc, adminRoleIds),
    ]);

    // 3. Tạo Map tra cứu theo ngày
    const trafficMap = new Map<string, number>(dailyTraffic.map((d) => [d.date, d.visits]));
    const orderMap = new Map<string, { totalOrders: number; successfulOrders: number; revenue: number }>(
      dailyOrders.map((d) => [d.date, { totalOrders: d.totalOrders, successfulOrders: d.successfulOrders, revenue: d.revenue }])
    );
    const userMap = new Map<string, number>(dailyUsers.map((d) => [d.date, d.newUsers]));

    // 4. Zero-filling: Sinh danh sách ngày liên tục và điền 0 nếu ngày không có phát sinh
    const allDates = this.generateDateSequence(startDateStr, endDateStr);
    let sumVisits = 0;
    let sumOrders = 0;
    let sumSuccessfulOrders = 0;
    let sumRevenue = 0;
    let sumNewUsers = 0;

    const timeline: UnifiedDailyTimelineItem[] = allDates.map((date) => {
      const visits = trafficMap.get(date) || 0;
      const orderData = orderMap.get(date) || { totalOrders: 0, successfulOrders: 0, revenue: 0 };
      const newUsers = userMap.get(date) || 0;

      sumVisits += visits;
      sumOrders += orderData.totalOrders;
      sumSuccessfulOrders += orderData.successfulOrders;
      sumRevenue += orderData.revenue;
      sumNewUsers += newUsers;

      return {
        date,
        visits,
        totalOrders: orderData.totalOrders,
        successfulOrders: orderData.successfulOrders,
        revenue: orderData.revenue,
        newUsers,
      };
    });

    return {
      dateRange: {
        startDate: startDateStr,
        endDate: endDateStr,
        preset,
        daysCount: allDates.length,
      },
      summary: {
        totalVisits: sumVisits,
        totalOrders: sumOrders,
        totalSuccessfulOrders: sumSuccessfulOrders,
        totalRevenue: sumRevenue,
        totalNewUsers: sumNewUsers,
        cumulativeUsers,
      },
      timeline,
      trafficSources,
    };
  }
}

export const statisticsService = new StatisticsService();

import { Types } from 'mongoose';
import VisitorModel, { IVisitor, TrafficSource } from './visitor.model';
import OrderModel from '../order/order.model';
import UserModel from '../user/user.model';
import RoleModel from '../role/role.model';

export interface DailyTrafficStat {
  date: string; // YYYY-MM-DD
  visits: number;
}

export interface DailyOrderStat {
  date: string; // YYYY-MM-DD
  totalOrders: number;
  successfulOrders: number;
  revenue: number;
}

export interface DailyUserStat {
  date: string; // YYYY-MM-DD
  newUsers: number;
}

export interface TrafficSourceDistribution {
  source: TrafficSource;
  count: number;
  percentage: number;
}

export class StatisticsRepository {
  /**
   * Thêm bản ghi theo dõi lượt truy cập
   */
  async trackVisit(data: Partial<IVisitor>): Promise<IVisitor> {
    return VisitorModel.create(data);
  }

  /**
   * Kiểm tra phiên truy cập gần nhất của session này (để hạn chế trùng lặp trong 15-30 phút)
   */
  async findRecentVisit(sessionId: string, withinMs: number = 30 * 60 * 1000): Promise<IVisitor | null> {
    const since = new Date(Date.now() - withinMs);
    return VisitorModel.findOne({
      sessionId,
      visitedAt: { $gte: since },
    }).sort({ visitedAt: -1 });
  }

  /**
   * 1. Thống kê lượt truy cập theo ngày (Múi giờ Asia/Ho_Chi_Minh: +07:00)
   */
  async aggregateDailyTraffic(startDate: Date, endDate: Date): Promise<DailyTrafficStat[]> {
    const results = await VisitorModel.aggregate([
      {
        $match: {
          visitedAt: { $gte: startDate, $lte: endDate },
          isBot: { $ne: true },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$visitedAt',
              timezone: '+07:00',
            },
          },
          visits: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          visits: 1,
        },
      },
      { $sort: { date: 1 } },
    ]);

    return results;
  }

  /**
   * 1.1 Phân bố nguồn truy cập (DIRECT, GOOGLE, FACEBOOK, OTHER)
   */
  async aggregateTrafficSources(startDate: Date, endDate: Date): Promise<TrafficSourceDistribution[]> {
    const results = await VisitorModel.aggregate([
      {
        $match: {
          visitedAt: { $gte: startDate, $lte: endDate },
          isBot: { $ne: true },
        },
      },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
        },
      },
    ]);

    const total = results.reduce((acc, cur) => acc + cur.count, 0);
    return results.map((item) => ({
      source: item._id as TrafficSource,
      count: item.count,
      percentage: total > 0 ? Math.round((item.count / total) * 100) : 0,
    }));
  }

  /**
   * 2. Thống kê đơn hàng theo ngày (Đơn tạo, Đơn thành công, Doanh thu)
   */
  async aggregateDailyOrders(startDate: Date, endDate: Date): Promise<DailyOrderStat[]> {
    const results = await OrderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          orderStatus: { $ne: 'CANCELLED' }, // Không tính đơn hủy vào số đơn hợp lệ
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone: '+07:00',
            },
          },
          totalOrders: { $sum: 1 },
          successfulOrders: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$orderStatus', 'DELIVERED'] },
                    { $eq: ['$paymentStatus', 'PAID'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          revenue: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$orderStatus', 'DELIVERED'] },
                    { $eq: ['$paymentStatus', 'PAID'] },
                  ],
                },
                '$pricing.totalAmount',
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          totalOrders: 1,
          successfulOrders: 1,
          revenue: 1,
        },
      },
      { $sort: { date: 1 } },
    ]);

    return results;
  }

  /**
   * Lấy danh sách ID của các Role Admin để loại trừ khi thống kê người dùng
   */
  async getAdminRoleIds(): Promise<Types.ObjectId[]> {
    const adminRoles = await RoleModel.find({
      $or: [
        { slug: { $in: ['admin', 'super-admin'] } },
        { name: { $regex: /admin|quản trị/i } },
      ],
    }).select('_id');

    const ids = adminRoles.map((r) => r._id as Types.ObjectId);
    // Thêm các ID Admin cứng phòng khi chưa query được
    const knownIds = [
      new Types.ObjectId('6a900c3ed5d60a2770802dc4'),
      new Types.ObjectId('6b02fc544094979f51385e08'),
    ];
    knownIds.forEach((id) => {
      if (!ids.some((item) => item.equals(id))) {
        ids.push(id);
      }
    });

    return ids;
  }

  /**
   * 3. Thống kê tài khoản đăng ký mới theo ngày (Loại trừ Admin)
   */
  async aggregateDailyNewUsers(
    startDate: Date,
    endDate: Date,
    adminRoleIds: Types.ObjectId[]
  ): Promise<DailyUserStat[]> {
    const results = await UserModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          deleted: false,
          roles: { $nin: adminRoleIds }, // Không tính tài khoản Admin
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone: '+07:00',
            },
          },
          newUsers: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          newUsers: 1,
        },
      },
      { $sort: { date: 1 } },
    ]);

    return results;
  }

  /**
   * Đếm tổng số người dùng tích lũy đến trước hoặc trong khoảng thời gian (loại trừ Admin)
   */
  async countCumulativeUsers(beforeDate: Date, adminRoleIds: Types.ObjectId[]): Promise<number> {
    return UserModel.countDocuments({
      createdAt: { $lte: beforeDate },
      deleted: false,
      roles: { $nin: adminRoleIds },
    });
  }
}

export const statisticsRepository = new StatisticsRepository();

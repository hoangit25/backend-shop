import { Types } from 'mongoose';
import { BaseRepository } from '../../common/base-responsitory';
import OrderModel, { IOrder } from './order.model';

export class OrderRepository extends BaseRepository<IOrder> {
  constructor() {
    super(OrderModel);
  }

  /**
   * Tìm đơn hàng theo mã đơn hàng
   */
  async findByOrderCode(orderCode: string): Promise<IOrder | null> {
    return this.findOne({ orderCode: orderCode.toUpperCase() });
  }

  /**
   * Tìm đơn hàng theo ID hoặc OrderCode (có tuỳ chọn populate thông tin sản phẩm)
   */
  async findByIdOrCode(
    orderIdentifier: string,
    populateProduct: boolean = true
  ): Promise<IOrder | null> {
    const isObjectId = Types.ObjectId.isValid(orderIdentifier);
    const filter = isObjectId
      ? { $or: [{ _id: new Types.ObjectId(orderIdentifier) }, { orderCode: orderIdentifier.toUpperCase() }] }
      : { orderCode: orderIdentifier.toUpperCase() };

    let query = this.model.findOne(filter);
    if (populateProduct) {
      query = query.populate('items.productId');
    }
    return query.exec();
  }

  /**
   * Lấy danh sách đơn hàng có phân trang, bộ lọc và populate người dùng
   */
  async findOrdersWithPagination(
    filter: Record<string, any>,
    pagination: {
      skip: number;
      limit: number;
      sort: Record<string, 1 | -1>;
    }
  ): Promise<{ orders: IOrder[]; totalItems: number }> {
    const [orders, totalItems] = await Promise.all([
      this.model
        .find(filter)
        .sort(pagination.sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .populate('userId', 'fullName email phone avatar')
        .exec(),
      this.model.countDocuments(filter),
    ]);

    return { orders, totalItems };
  }

  /**
   * Chạy pipeline thống kê tổng hợp ($facet aggregation) cho Admin (hỗ trợ lọc theo khoảng ngày)
   */
  async aggregateStats(dateFilter?: { $gte?: Date; $lte?: Date }): Promise<any> {
    const pipeline: any[] = [];
    if (dateFilter && (dateFilter.$gte || dateFilter.$lte)) {
      pipeline.push({
        $match: {
          createdAt: dateFilter,
        },
      });
    }

    pipeline.push({
      $facet: {
        // Thống kê đơn hàng và doanh thu
        orderStats: [
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalRevenue: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $eq: ['$paymentStatus', 'PAID'] },
                        { $eq: ['$orderStatus', 'DELIVERED'] },
                      ],
                    },
                    '$pricing.totalAmount',
                    0,
                  ],
                },
              },
              pendingOrders: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'PENDING'] }, 1, 0] },
              },
              confirmedOrders: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'CONFIRMED'] }, 1, 0] },
              },
              processingOrders: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'PROCESSING'] }, 1, 0] },
              },
              shippingOrders: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'SHIPPING'] }, 1, 0] },
              },
              deliveredOrders: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'DELIVERED'] }, 1, 0] },
              },
              cancelledOrders: {
                $sum: { $cond: [{ $eq: ['$orderStatus', 'CANCELLED'] }, 1, 0] },
              },
              paidOrders: {
                $sum: { $cond: [{ $eq: ['$paymentStatus', 'PAID'] }, 1, 0] },
              },
              unpaidOrders: {
                $sum: { $cond: [{ $eq: ['$paymentStatus', 'PENDING'] }, 1, 0] },
              },
              memberOrders: {
                $sum: { $cond: [{ $ne: ['$userId', null] }, 1, 0] },
              },
              guestOrders: {
                $sum: { $cond: [{ $eq: ['$userId', null] }, 1, 0] },
              },
            },
          },
        ],
        // Thống kê tập khách hàng và khách hàng quay lại mua (Repeat customers)
        customerStats: [
          {
            $group: {
              _id: { $ifNull: ['$userId', '$shippingAddress.phone'] },
              orderCount: { $sum: 1 },
              totalSpent: { $sum: '$pricing.totalAmount' },
            },
          },
          {
            $group: {
              _id: null,
              totalCustomers: { $sum: 1 },
              repeatCustomers: {
                $sum: { $cond: [{ $gt: ['$orderCount', 1] }, 1, 0] },
              },
            },
          },
        ],
        // Top 5 khách hàng chi tiêu nhiều nhất từ data đơn hàng
        topCustomers: [
          {
            $group: {
              _id: { $ifNull: ['$userId', '$shippingAddress.phone'] },
              fullName: { $first: '$shippingAddress.fullName' },
              phone: { $first: '$shippingAddress.phone' },
              email: { $first: '$shippingAddress.email' },
              orderCount: { $sum: 1 },
              totalSpent: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $eq: ['$paymentStatus', 'PAID'] },
                        { $eq: ['$orderStatus', 'DELIVERED'] },
                        { $ne: ['$orderStatus', 'CANCELLED'] },
                      ],
                    },
                    '$pricing.totalAmount',
                    0,
                  ],
                },
              },
            },
          },
          { $sort: { totalSpent: -1 } },
          { $limit: 5 },
        ],
      },
    });

    return this.model.aggregate(pipeline);
  }
}

export const orderRepository = new OrderRepository();

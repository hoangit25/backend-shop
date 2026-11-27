import { Request, Response } from 'express';
import { ApiResponse } from '../../common/api.responsitory';
import { asyncHandler } from '../../common/asycn.handel';
import { AppError } from '../../common/appError';
import { OrderService, orderService, OrderIdentity } from './order.service';
import { OrderStatus, PaymentStatus } from './order.model';

// Các Role ID của Admin và Super Admin trong DB MongoDB
export const KNOWN_ADMIN_ROLE_IDS = [
  '6a900c3ed5d60a2770802dc4', // Super Admin
  '6b02fc544094979f51385e08', // Admin
];

/**
 * Hàm trích xuất thông tin người dùng / vai trò Admin
 */
export function extractOrderIdentity(req: Request, res?: Response): OrderIdentity {
  const user = (req as any).user;
  if (user && user._id) {
    const roles = (user.roles || []).map((r: any) => {
      if (!r) return '';
      if (typeof r === 'string') return r.toLowerCase().trim();
      return (r.slug || r.name || r._id || '').toString().toLowerCase().trim();
    });

    const hasAdminId = (user.roles || []).some((r: any) => {
      const id = (typeof r === 'string' ? r : r._id || '').toString();
      return KNOWN_ADMIN_ROLE_IDS.includes(id);
    });

    const isAdmin =
      roles.includes('admin') ||
      roles.includes('super-admin') ||
      roles.includes('quản trị viên') ||
      roles.includes('super admin') ||
      hasAdminId;

    return {
      userId: user._id,
      role: isAdmin ? 'ADMIN' : 'USER',
      isAdmin: !!isAdmin,
    };
  }

  let guestId =
    (req.headers['x-guest-id'] as string) ||
    (req.query.guestId as string) ||
    req.body?.guestId;

  if (!guestId) {
    guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    if (res) {
      res.setHeader('x-guest-id', guestId);
    }
  }

  return { guestId, role: 'GUEST', isAdmin: false };
}

export class OrderController {
  constructor(private service: OrderService = orderService) {}

  /**
   * 1. Thống kê tổng quan đơn hàng & doanh thu (Chỉ dành cho Admin, hỗ trợ lọc theo ngày)
   */
  getOrderStats = asyncHandler(async (req: Request, res: Response) => {
    const identity = extractOrderIdentity(req, res);
    if (!identity.isAdmin) {
      throw AppError.Forbidden(
        'Chỉ Quản trị viên (Admin) mới có quyền truy cập thống kê đơn hàng',
        'FORBIDDEN'
      );
    }

    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const stats = await this.service.getOrderStats({ startDate, endDate });
    return ApiResponse.success(res, stats, 'Order stats retrieved successfully');
  });

  /**
   * 2. Tạo đơn hàng mới (Dùng chung cho cả User đăng nhập & Khách vãng lai)
   */
  createOrder = asyncHandler(async (req: Request, res: Response) => {
    const identity = extractOrderIdentity(req, res);
    const order = await this.service.createOrder(req.body, identity);
    return ApiResponse.created(res, order, 'Order created successfully');
  });

  /**
   * 3. Lấy danh sách đơn hàng (Tự động thích ứng: Admin lấy tất cả, User lấy đơn của mình)
   */
  getOrders = asyncHandler(async (req: Request, res: Response) => {
    const identity = extractOrderIdentity(req, res);
    const {
      page,
      limit,
      orderStatus,
      paymentStatus,
      paymentMethod,
      search,
      sortBy,
      sortOrder,
      userId,
      startDate,
      endDate,
    } = req.query;

    const result = await this.service.getOrders({
      userId: identity.isAdmin
        ? (userId as string)
        : identity.userId ? identity.userId.toString() : undefined,
      guestId: !identity.isAdmin && !identity.userId && identity.guestId ? identity.guestId : undefined,
      orderStatus: orderStatus as OrderStatus,
      paymentStatus: paymentStatus as PaymentStatus,
      paymentMethod: paymentMethod as string,
      search: search as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
      isAdmin: identity.isAdmin,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
      startDate: startDate as string,
      endDate: endDate as string,
    });

    return ApiResponse.paginated(
      res,
      result.orders,
      result.pagination,
      'Orders retrieved successfully'
    );
  });

  /**
   * 4. Lấy chi tiết đơn hàng theo ID hoặc OrderCode (Admin xem bất kỳ đơn nào, User xem đơn của mình)
   */
  getOrderById = asyncHandler(async (req: Request, res: Response) => {
    const identity = extractOrderIdentity(req, res);
    const orderId = req.params.id as string;
    const order = await this.service.getOrderById(orderId, identity);
    return ApiResponse.success(res, order, 'Order details retrieved successfully');
  });

  /**
   * 5. Huỷ đơn hàng (Khách hàng hoặc Admin)
   */
  cancelOrder = asyncHandler(async (req: Request, res: Response) => {
    const identity = extractOrderIdentity(req, res);
    const orderId = req.params.id as string;
    const { reason } = req.body;
    const order = await this.service.cancelOrder(orderId, identity, reason);
    return ApiResponse.success(res, order, 'Order cancelled successfully');
  });

  /**
   * 6. Cập nhật trạng thái đơn hàng (Dành cho Quản trị viên)
   */
  updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
    const identity = extractOrderIdentity(req, res);
    if (!identity.isAdmin) {
      throw AppError.Forbidden(
        'Chỉ Quản trị viên (Admin) mới có quyền cập nhật trạng thái đơn hàng',
        'FORBIDDEN'
      );
    }

    const orderId = req.params.id as string;
    const { status, note } = req.body;

    if (!status) {
      throw AppError.BadRequest('Trạng thái đơn hàng là bắt buộc', 'MISSING_STATUS');
    }

    const order = await this.service.updateOrderStatus(
      orderId,
      status as OrderStatus,
      identity.userId || 'ADMIN',
      note
    );

    return ApiResponse.success(res, order, 'Cập nhật trạng thái đơn hàng thành công');
  });

  /**
   * 7. Cập nhật trạng thái thanh toán (Dành cho Quản trị viên)
   */
  updatePaymentStatus = asyncHandler(async (req: Request, res: Response) => {
    const identity = extractOrderIdentity(req, res);
    if (!identity.isAdmin) {
      throw AppError.Forbidden(
        'Chỉ Quản trị viên (Admin) mới có quyền cập nhật trạng thái thanh toán',
        'FORBIDDEN'
      );
    }

    const orderId = req.params.id as string;
    const { paymentStatus, note } = req.body;

    if (!paymentStatus) {
      throw AppError.BadRequest('Trạng thái thanh toán là bắt buộc', 'MISSING_PAYMENT_STATUS');
    }

    const order = await this.service.updatePaymentStatus(
      orderId,
      paymentStatus as PaymentStatus,
      identity.userId || 'ADMIN',
      note
    );

    return ApiResponse.success(res, order, 'Cập nhật trạng thái thanh toán thành công');
  });

  /**
   * 8. Xóa đơn hàng (Dành cho Quản trị viên)
   */
  deleteOrder = asyncHandler(async (req: Request, res: Response) => {
    const identity = extractOrderIdentity(req, res);
    if (!identity.isAdmin) {
      throw AppError.Forbidden(
        'Chỉ Quản trị viên (Admin) mới có quyền xóa đơn hàng',
        'FORBIDDEN'
      );
    }

    const orderId = req.params.id as string;
    await this.service.deleteOrder(orderId);
    return ApiResponse.success(res, { id: orderId }, 'Đã xóa đơn hàng thành công');
  });
}

export const orderController = new OrderController();

import { Router, Request, Response } from 'express';
import { ApiResponse } from '../../common/api.responsitory';
import { asyncHandler } from '../../common/asycn.handel';
import { AppError } from '../../common/appError';
import { optionalAuth } from '../cart/cart.route';
import { orderService, OrderIdentity } from './order.service';
import { OrderStatus } from './order.model';

const router = Router();

function extractOrderIdentity(req: Request, res?: Response): OrderIdentity {
  const user = (req as any).user;
  if (user && user._id) {
    return {
      userId: user._id,
      role: user.roles?.some((r: any) => r.name === 'ADMIN' || r === 'ADMIN') ? 'ADMIN' : 'USER',
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

  return { guestId, role: 'GUEST' };
}

// 1. Tạo đơn hàng mới (từ giỏ hàng hoặc danh sách items)
router.post(
  '/',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const identity = extractOrderIdentity(req, res);
    const order = await orderService.createOrder(req.body, identity);
    return ApiResponse.created(res, order, 'Order created successfully');
  })
);

// 2. Lấy danh sách đơn hàng (của user hiện tại hoặc query)
router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const identity = extractOrderIdentity(req, res);
    const { page, limit, orderStatus, paymentStatus, search } = req.query;

    const result = await orderService.getOrders({
      userId: identity.userId ? identity.userId.toString() : undefined,
      guestId: !identity.userId && identity.guestId ? identity.guestId : undefined,
      orderStatus: orderStatus as OrderStatus,
      paymentStatus: paymentStatus as any,
      search: search as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
    });

    return ApiResponse.paginated(
      res,
      result.orders,
      result.pagination,
      'Orders retrieved successfully'
    );
  })
);

// 3. Lấy chi tiết đơn hàng theo ID hoặc OrderCode
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const identity = extractOrderIdentity(req, res);
    const orderId = req.params.id as string;
    const order = await orderService.getOrderById(orderId, identity);
    return ApiResponse.success(res, order, 'Order details retrieved successfully');
  })
);

// 4. Huỷ đơn hàng
router.patch(
  '/:id/cancel',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const identity = extractOrderIdentity(req, res);
    const orderId = req.params.id as string;
    const { reason } = req.body;
    const order = await orderService.cancelOrder(orderId, identity, reason);
    return ApiResponse.success(res, order, 'Order cancelled successfully');
  })
);

// 5. Cập nhật trạng thái đơn hàng (Dành cho Quản trị viên / Hệ thống)
router.patch(
  '/:id/status',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const identity = extractOrderIdentity(req, res);
    const orderId = req.params.id as string;
    const { status, note } = req.body;

    if (!status) {
      throw AppError.BadRequest('Status is required', 'MISSING_STATUS');
    }

    const order = await orderService.updateOrderStatus(
      orderId,
      status as OrderStatus,
      identity.userId || 'SYSTEM',
      note
    );

    return ApiResponse.success(res, order, 'Order status updated successfully');
  })
);

export const orderRouter = router;
export default router;


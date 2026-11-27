import { Router } from 'express';
import { optionalAuth } from '../cart/cart.route';
import { orderController } from './order.controller';

const router = Router();

// 1. Thống kê tổng quan đơn hàng & doanh thu (Chỉ dành cho Admin - đặt trước '/:id' để không bị nuốt URL)
router.get('/stats', optionalAuth, orderController.getOrderStats);

// 2. Tạo đơn hàng mới (Dùng chung cho cả User đăng nhập & Khách vãng lai)
router.post('/', optionalAuth, orderController.createOrder);

// 3. Lấy danh sách đơn hàng (Tự động thích ứng: Admin lấy tất cả, User lấy đơn của mình)
router.get('/', optionalAuth, orderController.getOrders);

// 4. Lấy chi tiết đơn hàng theo ID hoặc OrderCode (Admin xem bất kỳ đơn nào, User xem đơn của mình)
router.get('/:id', optionalAuth, orderController.getOrderById);

// 5. Huỷ đơn hàng (Khách hàng hoặc Admin)
router.patch('/:id/cancel', optionalAuth, orderController.cancelOrder);

// 6. Cập nhật trạng thái đơn hàng (Dành cho Quản trị viên)
router.patch('/:id/status', optionalAuth, orderController.updateOrderStatus);

// 7. Cập nhật trạng thái thanh toán (Dành cho Quản trị viên)
router.patch('/:id/payment-status', optionalAuth, orderController.updatePaymentStatus);

// 8. Xóa đơn hàng (Dành cho Quản trị viên)
router.delete('/:id', optionalAuth, orderController.deleteOrder);

export const orderRouter = router;
export default router;

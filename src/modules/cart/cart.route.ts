import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middlewares/validate.middleware';
import { verifyToken } from '../../middlewares/authentication.middelware';
import * as jwtConfig from '../../config/jwt.config';
import UserModel from '../user/user.model';
import { cartController } from './cart.controller';
import {
  addItemSchema,
  updateItemSchema,
  removeItemSchema,
  selectItemsSchema,
  applyCouponSchema,
  mergeCartSchema,
} from './cart.validation';

/**
 * Middleware tuỳ chọn danh tính:
 * Nếu có Bearer token hợp lệ, gán user vào request.
 * Nếu không có token hoặc token không hợp lệ, tiếp tục xử lý với tư cách khách (guest).
 */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const accessToken = authHeader.split(' ')[1];
      const decoded = jwtConfig.verifyAccessToken(accessToken);
      if (decoded?.id) {
        const user = await UserModel.findOne({
          _id: decoded.id,
          deleted: false,
          isActive: true,
        });
        if (user) {
          (req as any).user = user;
        }
      }
    } catch {
      // Bỏ qua lỗi token đối với request khách vãng lai
    }
  }
  next();
};

const router = Router();

// 1. Lấy thông tin giỏ hàng
router.get('/', optionalAuth, cartController.getCart);

// 2. Thêm sản phẩm vào giỏ
router.post('/items', optionalAuth, validate(addItemSchema), cartController.addItem);

// 3. Cập nhật số lượng / trạng thái chọn của item
router.put('/items/:itemId', optionalAuth, validate(updateItemSchema), cartController.updateItem);

// 4. Xoá một sản phẩm khỏi giỏ
router.delete('/items/:itemId', optionalAuth, validate(removeItemSchema), cartController.removeItem);

// 5. Xoá toàn bộ giỏ hàng
router.delete('/', optionalAuth, cartController.clearCart);

// 6. Chọn / Bỏ chọn sản phẩm
router.patch('/select', optionalAuth, validate(selectItemsSchema), cartController.selectItems);

// 7. Validate giỏ hàng với kho & giá thực tế hiện hành
router.post('/validate', optionalAuth, cartController.validateCart);

// 8. Áp dụng mã giảm giá
router.post('/coupon', optionalAuth, validate(applyCouponSchema), cartController.applyCoupon);

// 9. Gỡ mã giảm giá
router.delete('/coupon', optionalAuth, cartController.removeCoupon);

// 10. Gộp giỏ hàng khách vào tài khoản khi đăng nhập (Bắt buộc đã đăng nhập)
router.post('/merge', verifyToken, validate(mergeCartSchema), cartController.mergeCart);

export const cartRouter = router;
export default router;


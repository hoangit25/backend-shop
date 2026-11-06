import { Request, Response } from 'express';
import { ApiResponse } from '../../common/api.responsitory';
import { asyncHandler } from '../../common/asycn.handel';
import { AppError } from '../../common/appError';
import { CartIdentity, CartService, cartService } from './cart.service';

export class CartController {
  constructor(private service: CartService = cartService) {}

  /**
   * Trích xuất thông tin định danh giỏ hàng từ User đăng nhập hoặc Guest ID
   */
  private extractCartIdentity(req: Request, res?: Response): CartIdentity {
    const user = (req as any).user;
    if (user && user._id) {
      return { userId: user._id };
    }

    let guestId =
      (req.headers['x-guest-id'] as string) ||
      (req.query.guestId as string) ||
      req.body?.guestId;

    if (!guestId) {
      // Tự động cấp guestId nếu client chưa có
      guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      if (res) {
        res.setHeader('x-guest-id', guestId);
      }
    }

    return { guestId };
  }

  getCart = asyncHandler(async (req: Request, res: Response) => {
    const identity = this.extractCartIdentity(req, res);
    const cart = await this.service.getCart(identity);
    return ApiResponse.success(res, cart, 'Cart retrieved successfully');
  });

  addItem = asyncHandler(async (req: Request, res: Response) => {
    const identity = this.extractCartIdentity(req, res);
    const cart = await this.service.addItem(identity, req.body);
    return ApiResponse.created(res, cart, 'Item added to cart successfully');
  });

  updateItem = asyncHandler(async (req: Request, res: Response) => {
    const identity = this.extractCartIdentity(req, res);
    const itemId = req.params.itemId as string;
    const cart = await this.service.updateItem(identity, itemId, req.body);
    return ApiResponse.success(res, cart, 'Cart item updated successfully');
  });

  removeItem = asyncHandler(async (req: Request, res: Response) => {
    const identity = this.extractCartIdentity(req, res);
    const itemId = req.params.itemId as string;
    const cart = await this.service.removeItem(identity, itemId);
    return ApiResponse.success(res, cart, 'Item removed from cart successfully');
  });

  clearCart = asyncHandler(async (req: Request, res: Response) => {
    const identity = this.extractCartIdentity(req, res);
    const cart = await this.service.clearCart(identity);
    return ApiResponse.success(res, cart, 'Cart cleared successfully');
  });

  selectItems = asyncHandler(async (req: Request, res: Response) => {
    const identity = this.extractCartIdentity(req, res);
    const cart = await this.service.selectItems(identity, req.body);
    return ApiResponse.success(res, cart, 'Cart items selection updated');
  });

  mergeCart = asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || !user._id) {
      throw AppError.Unauthorized(
        'Authentication required to merge cart into user account',
        'AUTH_REQUIRED'
      );
    }

    const { guestId, items } = req.body;
    const cart = await this.service.mergeCart(user._id, guestId, items);
    return ApiResponse.success(res, cart, 'Cart merged successfully');
  });

  validateCart = asyncHandler(async (req: Request, res: Response) => {
    const identity = this.extractCartIdentity(req, res);
    const autoFix = req.body.autoFix !== false; // Mặc định tự động đồng bộ giá và kho mới nhất
    const result = await this.service.validateCart(identity, autoFix);
    return ApiResponse.success(res, result, 'Cart validated successfully');
  });

  applyCoupon = asyncHandler(async (req: Request, res: Response) => {
    const identity = this.extractCartIdentity(req, res);
    const { code } = req.body;
    const cart = await this.service.applyCoupon(identity, code);
    return ApiResponse.success(res, cart, 'Coupon applied successfully');
  });

  removeCoupon = asyncHandler(async (req: Request, res: Response) => {
    const identity = this.extractCartIdentity(req, res);
    const cart = await this.service.removeCoupon(identity);
    return ApiResponse.success(res, cart, 'Coupon removed successfully');
  });
}

export const cartController = new CartController();


import { Types } from 'mongoose';
import { AppError } from '../../common/appError';
import ProductModel from '../product/models/product.model';
import ProductVariantModel from '../product/models/product-variant.model';
import CartModel, { ICart, ICartCoupon, ICartItem } from './cart.model';
import { recalculateCartPricing } from './cart.pricing';

export interface CartIdentity {
  userId?: string | Types.ObjectId | null;
  guestId?: string | null;
}

export interface AddItemDTO {
  productId: string;
  variantId?: string | null;
  quantity: number;
  selected?: boolean;
}

export interface UpdateItemDTO {
  quantity?: number;
  selected?: boolean;
}

export interface CartIssue {
  itemId: string;
  productId: string;
  variantId?: string | null;
  productName: string;
  code: 'PRODUCT_UNAVAILABLE' | 'VARIANT_UNAVAILABLE' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK' | 'PRICE_CHANGED';
  message: string;
  currentStock?: number;
  requestedQuantity?: number;
  oldPrice?: number;
  newPrice?: number;
}

export interface CartValidationResult {
  isValid: boolean;
  issues: CartIssue[];
  cart: ICart;
}

export class CartService {
  /**
   * Tạo query điều kiện xác định giỏ hàng (theo userId hoặc guestId)
   */
  private buildCartFilter(identity: CartIdentity): Record<string, any> {
    if (identity.userId) {
      return {
        userId: new Types.ObjectId(identity.userId.toString()),
        status: 'ACTIVE',
      };
    }
    if (identity.guestId) {
      return {
        guestId: identity.guestId.trim(),
        status: 'ACTIVE',
      };
    }
    throw AppError.BadRequest('User ID or Guest ID must be provided', 'MISSING_CART_IDENTITY');
  }

  /**
   * Lấy hoặc khởi tạo giỏ hàng ACTIVE
   */
  async getOrCreateCart(identity: CartIdentity): Promise<ICart> {
    const filter = this.buildCartFilter(identity);
    let cart = await CartModel.findOne(filter).exec();

    if (!cart) {
      cart = new CartModel({
        userId: identity.userId ? new Types.ObjectId(identity.userId.toString()) : null,
        guestId: identity.userId ? null : identity.guestId?.trim() || null,
        items: [],
        status: 'ACTIVE',
      });
      recalculateCartPricing(cart);
      await cart.save();
    }

    return cart as ICart;
  }

  /**
   * Lấy giỏ hàng chi tiết (có populate thông tin Product & Variant mới nhất)
   */
  async getCart(identity: CartIdentity): Promise<ICart> {
    const cart = await this.getOrCreateCart(identity);

    // Populate thông tin chi tiết sản phẩm và biến thể
    await cart.populate([
      {
        path: 'items.productId',
        select: 'name slug image images price originalPrice discount stock status isActive deleted',
      },
      {
        path: 'items.variantId',
        select: 'sku size color colorCode price originalPrice stock image isActive deleted',
      },
    ]);

    return cart;
  }

  /**
   * Thêm sản phẩm / biến thể vào giỏ hàng
   */
  async addItem(identity: CartIdentity, dto: AddItemDTO): Promise<ICart> {
    const { productId, variantId, quantity = 1, selected = true } = dto;

    if (quantity <= 0) {
      throw AppError.BadRequest('Quantity must be greater than 0', 'INVALID_QUANTITY');
    }

    // 1. Kiểm tra sản phẩm tồn tại và đang hoạt động
    const product = await ProductModel.findOne({
      _id: productId,
      deleted: false,
    });

    if (!product) {
      throw AppError.NotFound('Product not found', 'PRODUCT_NOT_FOUND');
    }

    if (!product.isActive || product.status === 'ARCHIVED' || product.status === 'DRAFT') {
      throw AppError.BadRequest('Product is currently not available for sale', 'PRODUCT_UNAVAILABLE');
    }

    // 2. Kiểm tra biến thể (nếu có)
    let variant: any = null;
    if (variantId) {
      variant = await ProductVariantModel.findOne({
        _id: variantId,
        productId: product._id,
        deleted: false,
      });

      if (!variant) {
        throw AppError.NotFound('Product variant not found', 'VARIANT_NOT_FOUND');
      }

      if (!variant.isActive) {
        throw AppError.BadRequest('Product variant is currently disabled', 'VARIANT_DISABLED');
      }
    }

    // Xác định tồn kho và giá áp dụng
    const availableStock = variant ? variant.stock : product.stock;
    const unitPrice = variant ? variant.price : product.price;
    const originalPrice = variant
      ? variant.originalPrice || variant.price
      : product.originalPrice || product.price;
    const itemImage = variant?.image || product.image;
    const sku = variant ? variant.sku : '';

    if (availableStock <= 0) {
      throw AppError.BadRequest('Product is out of stock', 'OUT_OF_STOCK');
    }

    // 3. Lấy giỏ hàng
    const cart = await this.getOrCreateCart(identity);

    // 4. Tìm item trùng sản phẩm & biến thể trong giỏ
    const existingItemIndex = cart.items.findIndex((item) => {
      const pMatch = item.productId.toString() === productId;
      const vMatch = variantId
        ? item.variantId?.toString() === variantId
        : !item.variantId;
      return pMatch && vMatch;
    });

    if (existingItemIndex > -1) {
      const existingItem = cart.items[existingItemIndex];
      const newQuantity = existingItem.quantity + quantity;

      if (newQuantity > availableStock) {
        throw AppError.BadRequest(
          `Cannot add quantity. Available stock is ${availableStock}, you already have ${existingItem.quantity} in cart`,
          'INSUFFICIENT_STOCK'
        );
      }

      existingItem.quantity = newQuantity;
      // Cập nhật giá mới nhất
      existingItem.price = unitPrice;
      existingItem.originalPrice = originalPrice;
      if (itemImage) existingItem.image = itemImage;
      if (selected !== undefined) existingItem.selected = selected;
    } else {
      if (quantity > availableStock) {
        throw AppError.BadRequest(
          `Requested quantity exceeds available stock (${availableStock})`,
          'INSUFFICIENT_STOCK'
        );
      }

      cart.items.push({
        productId: product._id,
        variantId: variant ? variant._id : null,
        sku,
        name: product.name,
        image: itemImage,
        price: unitPrice,
        originalPrice,
        quantity,
        selected,
        attributes: variant
          ? {
              size: variant.size,
              color: variant.color,
              ...(variant.optionValues || {}),
            }
          : {},
      } as any);
    }

    // 5. Tính toán lại tổng tiền và lưu giỏ hàng
    recalculateCartPricing(cart);
    await cart.save();

    return cart;
  }

  /**
   * Cập nhật số lượng hoặc trạng thái chọn của một item trong giỏ
   */
  async updateItem(identity: CartIdentity, itemId: string, dto: UpdateItemDTO): Promise<ICart> {
    const cart = await this.getOrCreateCart(identity);

    const item = cart.items.find(
      (it: any) => it._id.toString() === itemId || it.id === itemId
    );

    if (!item) {
      throw AppError.NotFound('Item not found in cart', 'CART_ITEM_NOT_FOUND');
    }

    // Cập nhật số lượng
    if (dto.quantity !== undefined) {
      if (dto.quantity <= 0) {
        throw AppError.BadRequest('Quantity must be greater than 0', 'INVALID_QUANTITY');
      }

      // Kiểm tra tồn kho thực tế
      let availableStock = 0;
      if (item.variantId) {
        const variant = await ProductVariantModel.findOne({
          _id: item.variantId,
          deleted: false,
          isActive: true,
        });
        if (!variant) {
          throw AppError.BadRequest('Variant is no longer available', 'VARIANT_UNAVAILABLE');
        }
        availableStock = variant.stock;
      } else {
        const product = await ProductModel.findOne({
          _id: item.productId,
          deleted: false,
          isActive: true,
        });
        if (!product) {
          throw AppError.BadRequest('Product is no longer available', 'PRODUCT_UNAVAILABLE');
        }
        availableStock = product.stock;
      }

      if (dto.quantity > availableStock) {
        throw AppError.BadRequest(
          `Requested quantity exceeds available stock (${availableStock})`,
          'INSUFFICIENT_STOCK'
        );
      }

      item.quantity = dto.quantity;
    }

    // Cập nhật trạng thái tick chọn (selected)
    if (dto.selected !== undefined) {
      item.selected = dto.selected;
    }

    recalculateCartPricing(cart);
    await cart.save();

    return cart;
  }

  /**
   * Xoá một item khỏi giỏ hàng
   */
  async removeItem(identity: CartIdentity, itemId: string): Promise<ICart> {
    const cart = await this.getOrCreateCart(identity);

    const itemIndex = cart.items.findIndex(
      (it: any) => it._id.toString() === itemId || it.id === itemId
    );

    if (itemIndex === -1) {
      throw AppError.NotFound('Item not found in cart', 'CART_ITEM_NOT_FOUND');
    }

    cart.items.splice(itemIndex, 1);
    recalculateCartPricing(cart);
    await cart.save();

    return cart;
  }

  /**
   * Xoá toàn bộ giỏ hàng
   */
  async clearCart(identity: CartIdentity): Promise<ICart> {
    const cart = await this.getOrCreateCart(identity);
    cart.items = [] as any;
    cart.appliedCoupon = null;
    recalculateCartPricing(cart);
    await cart.save();

    return cart;
  }

  /**
   * Chọn / Bỏ chọn các item trong giỏ (phục vụ tính toán và thanh toán)
   */
  async selectItems(
    identity: CartIdentity,
    options: { itemIds?: string[]; selected?: boolean; selectAll?: boolean }
  ): Promise<ICart> {
    const cart = await this.getOrCreateCart(identity);

    if (options.selectAll !== undefined) {
      for (const item of cart.items) {
        item.selected = options.selectAll;
      }
    } else if (options.itemIds && options.itemIds.length > 0) {
      const selectedStatus = options.selected !== undefined ? options.selected : true;
      const targetIds = new Set(options.itemIds.map((id) => id.toString()));

      for (const item of cart.items) {
        if (targetIds.has((item as any)._id.toString())) {
          item.selected = selectedStatus;
        }
      }
    }

    recalculateCartPricing(cart);
    await cart.save();

    return cart;
  }

  /**
   * Merge giỏ hàng khách vãng lai (Guest Cart) vào giỏ hàng thành viên (User Cart) khi đăng nhập
   */
  async mergeCart(
    userId: string | Types.ObjectId,
    guestId?: string | null,
    guestItems?: Array<{
      productId: string;
      variantId?: string | null;
      quantity: number;
      selected?: boolean;
    }>
  ): Promise<ICart> {
    const userCart = await this.getOrCreateCart({ userId });

    const itemsToMerge: Array<{
      productId: string;
      variantId?: string | null;
      quantity: number;
      selected?: boolean;
    }> = [];

    // 1. Lấy items từ guestId trong DB nếu có
    if (guestId) {
      const guestCart = await CartModel.findOne({
        guestId: guestId.trim(),
        status: 'ACTIVE',
      });

      if (guestCart && guestCart.items.length > 0) {
        for (const it of guestCart.items) {
          itemsToMerge.push({
            productId: it.productId.toString(),
            variantId: it.variantId ? it.variantId.toString() : null,
            quantity: it.quantity,
            selected: it.selected,
          });
        }
        // Xoá hoặc đánh dấu hoàn tất giỏ hàng khách
        await CartModel.deleteOne({ _id: guestCart._id });
      }
    }

    // 2. Thêm items từ frontend body truyền lên (localStorage)
    if (guestItems && guestItems.length > 0) {
      for (const gItem of guestItems) {
        itemsToMerge.push(gItem);
      }
    }

    // 3. Tiến hành gộp từng item vào userCart
    for (const item of itemsToMerge) {
      try {
        const product = await ProductModel.findOne({
          _id: item.productId,
          deleted: false,
          isActive: true,
        });
        if (!product) continue;

        let variant: any = null;
        if (item.variantId) {
          variant = await ProductVariantModel.findOne({
            _id: item.variantId,
            productId: product._id,
            deleted: false,
            isActive: true,
          });
          if (!variant) continue;
        }

        const stock = variant ? variant.stock : product.stock;
        if (stock <= 0) continue;

        const unitPrice = variant ? variant.price : product.price;
        const originalPrice = variant
          ? variant.originalPrice || variant.price
          : product.originalPrice || product.price;
        const itemImage = variant?.image || product.image;

        const existingItem = userCart.items.find((it) => {
          const pMatch = it.productId.toString() === item.productId;
          const vMatch = item.variantId
            ? it.variantId?.toString() === item.variantId
            : !it.variantId;
          return pMatch && vMatch;
        });

        if (existingItem) {
          // Cộng dồn nhưng không vượt quá tồn kho khả dụng
          existingItem.quantity = Math.min(
            existingItem.quantity + item.quantity,
            stock
          );
          existingItem.price = unitPrice;
          existingItem.originalPrice = originalPrice;
        } else {
          userCart.items.push({
            productId: product._id,
            variantId: variant ? variant._id : null,
            sku: variant ? variant.sku : '',
            name: product.name,
            image: itemImage,
            price: unitPrice,
            originalPrice,
            quantity: Math.min(item.quantity, stock),
            selected: item.selected !== false,
            attributes: variant
              ? {
                  size: variant.size,
                  color: variant.color,
                  ...(variant.optionValues || {}),
                }
              : {},
          } as any);
        }
      } catch {
        // Bỏ qua item lỗi khi gộp
        continue;
      }
    }

    recalculateCartPricing(userCart);
    await userCart.save();

    return userCart;
  }

  /**
   * Validate giỏ hàng với dữ liệu tồn kho và giá thực tế hiện hành
   */
  async validateCart(identity: CartIdentity, autoFix: boolean = true): Promise<CartValidationResult> {
    const cart = await this.getOrCreateCart(identity);
    const issues: CartIssue[] = [];

    const validItems: any[] = [];

    for (const item of cart.items) {
      const itemId = (item as any)._id?.toString() || '';
      const product = await ProductModel.findById(item.productId);

      if (!product || product.deleted || !product.isActive || product.status === 'ARCHIVED') {
        issues.push({
          itemId,
          productId: item.productId.toString(),
          variantId: item.variantId?.toString() || null,
          productName: item.name,
          code: 'PRODUCT_UNAVAILABLE',
          message: `Product "${item.name}" is no longer available`,
        });
        if (!autoFix) validItems.push(item);
        continue;
      }

      let variant: any = null;
      if (item.variantId) {
        variant = await ProductVariantModel.findOne({
          _id: item.variantId,
          productId: product._id,
          deleted: false,
        });

        if (!variant || !variant.isActive) {
          issues.push({
            itemId,
            productId: item.productId.toString(),
            variantId: item.variantId.toString(),
            productName: item.name,
            code: 'VARIANT_UNAVAILABLE',
            message: `Variant of "${item.name}" is no longer available`,
          });
          if (!autoFix) validItems.push(item);
          continue;
        }
      }

      const currentStock = variant ? variant.stock : product.stock;
      const currentPrice = variant ? variant.price : product.price;

      // 1. Kiểm tra hết hàng
      if (currentStock <= 0) {
        issues.push({
          itemId,
          productId: item.productId.toString(),
          variantId: item.variantId?.toString() || null,
          productName: item.name,
          code: 'OUT_OF_STOCK',
          message: `Product "${item.name}" is out of stock`,
          currentStock: 0,
          requestedQuantity: item.quantity,
        });
        if (autoFix) {
          item.quantity = 0;
          item.selected = false;
        }
      }
      // 2. Kiểm tra tồn kho không đủ số lượng
      else if (item.quantity > currentStock) {
        issues.push({
          itemId,
          productId: item.productId.toString(),
          variantId: item.variantId?.toString() || null,
          productName: item.name,
          code: 'INSUFFICIENT_STOCK',
          message: `Only ${currentStock} units left for "${item.name}"`,
          currentStock,
          requestedQuantity: item.quantity,
        });
        if (autoFix) {
          item.quantity = currentStock;
        }
      }

      // 3. Kiểm tra biến động giá
      if (item.price !== currentPrice) {
        issues.push({
          itemId,
          productId: item.productId.toString(),
          variantId: item.variantId?.toString() || null,
          productName: item.name,
          code: 'PRICE_CHANGED',
          message: `Price for "${item.name}" changed from ${item.price} to ${currentPrice}`,
          oldPrice: item.price,
          newPrice: currentPrice,
        });
        if (autoFix) {
          item.price = currentPrice;
        }
      }

      validItems.push(item);
    }

    if (autoFix) {
      // Loại bỏ các mặt hàng quantity = 0 hoặc đã huỷ bán
      cart.items = validItems.filter((it: any) => it.quantity > 0) as any;
      recalculateCartPricing(cart);
      await cart.save();
    }

    return {
      isValid: issues.length === 0,
      issues,
      cart,
    };
  }

  /**
   * Áp dụng mã giảm giá (Coupon / Voucher)
   */
  async applyCoupon(identity: CartIdentity, code: string): Promise<ICart> {
    const cart = await this.getOrCreateCart(identity);

    // Mock hệ thống coupon phong phú cho shop
    const formattedCode = code.trim().toUpperCase();
    const couponDatabase: Record<string, ICartCoupon> = {
      SALE10: {
        code: 'SALE10',
        discountType: 'PERCENTAGE',
        discountValue: 10,
        maxDiscountAmount: 100000,
        minOrderValue: 200000,
      },
      GIAM50K: {
        code: 'GIAM50K',
        discountType: 'FIXED_AMOUNT',
        discountValue: 50000,
        minOrderValue: 300000,
      },
      VIP20: {
        code: 'VIP20',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        maxDiscountAmount: 300000,
        minOrderValue: 500000,
      },
      FREESHIP: {
        code: 'FREESHIP',
        discountType: 'FIXED_AMOUNT',
        discountValue: 30000,
        minOrderValue: 100000,
      },
    };

    const coupon = couponDatabase[formattedCode];
    if (!coupon) {
      throw AppError.BadRequest('Invalid coupon code', 'INVALID_COUPON');
    }

    if (coupon.minOrderValue && cart.subtotal < coupon.minOrderValue) {
      throw AppError.BadRequest(
        `Coupon requires a minimum order value of ${coupon.minOrderValue.toLocaleString()} VND`,
        'COUPON_MIN_ORDER_NOT_MET'
      );
    }

    cart.appliedCoupon = coupon;
    recalculateCartPricing(cart);
    await cart.save();

    return cart;
  }

  /**
   * Gỡ mã giảm giá
   */
  async removeCoupon(identity: CartIdentity): Promise<ICart> {
    const cart = await this.getOrCreateCart(identity);
    cart.appliedCoupon = null;
    recalculateCartPricing(cart);
    await cart.save();

    return cart;
  }
}

export const cartService = new CartService();

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import {
  calculateItemSubtotal,
  calculateCouponDiscount,
  calculateShippingFee,
  calculateCartTotals,
  recalculateCartPricing,
  DEFAULT_PRICING_CONFIG,
} from './cart.pricing';
import {
  addItemBodySchema,
  updateItemBodySchema,
  applyCouponBodySchema,
  mergeCartBodySchema,
} from './cart.validation';
import { CartService } from './cart.service';
import CartModel from './cart.model';
import ProductModel from '../product/models/product.model';
import ProductVariantModel from '../product/models/product-variant.model';

// ============================================================================
// 1. UNIT TESTS: PRICING LOGIC (cart.pricing.ts)
// ============================================================================
describe('Cart Pricing Logic', () => {
  describe('calculateItemSubtotal', () => {
    it('should calculate subtotal correctly for positive price and quantity', () => {
      expect(calculateItemSubtotal(100000, 3)).toBe(300000);
      expect(calculateItemSubtotal(50000, 2)).toBe(100000);
    });

    it('should return 0 for negative price or quantity', () => {
      expect(calculateItemSubtotal(-100, 2)).toBe(0);
      expect(calculateItemSubtotal(100, -2)).toBe(0);
      expect(calculateItemSubtotal(0, 5)).toBe(0);
    });
  });

  describe('calculateShippingFee', () => {
    it('should return 0 if subtotal is 0', () => {
      expect(calculateShippingFee(0)).toBe(0);
    });

    it('should return base shipping fee when subtotal is below threshold', () => {
      expect(calculateShippingFee(300000)).toBe(DEFAULT_PRICING_CONFIG.baseShippingFee);
    });

    it('should return 0 when subtotal reaches or exceeds free shipping threshold', () => {
      expect(calculateShippingFee(500000)).toBe(0);
      expect(calculateShippingFee(1000000)).toBe(0);
    });
  });

  describe('calculateCouponDiscount', () => {
    it('should return 0 when coupon is null or subtotal is 0', () => {
      expect(calculateCouponDiscount(0, null)).toBe(0);
      expect(calculateCouponDiscount(500000, null)).toBe(0);
    });

    it('should return 0 when subtotal does not meet minOrderValue', () => {
      const coupon = {
        code: 'SALE10',
        discountType: 'PERCENTAGE' as const,
        discountValue: 10,
        minOrderValue: 200000,
      };
      expect(calculateCouponDiscount(150000, coupon)).toBe(0);
    });

    it('should calculate percentage discount correctly', () => {
      const coupon = {
        code: 'SALE10',
        discountType: 'PERCENTAGE' as const,
        discountValue: 10,
        minOrderValue: 100000,
      };
      expect(calculateCouponDiscount(300000, coupon)).toBe(30000);
    });

    it('should respect maxDiscountAmount for percentage coupon', () => {
      const coupon = {
        code: 'SALE50',
        discountType: 'PERCENTAGE' as const,
        discountValue: 50,
        maxDiscountAmount: 50000,
      };
      // 50% of 200,000 = 100,000 -> capped at 50,000
      expect(calculateCouponDiscount(200000, coupon)).toBe(50000);
    });

    it('should calculate fixed amount coupon correctly and not exceed subtotal', () => {
      const coupon = {
        code: 'GIAM50K',
        discountType: 'FIXED_AMOUNT' as const,
        discountValue: 50000,
      };
      expect(calculateCouponDiscount(200000, coupon)).toBe(50000);
      expect(calculateCouponDiscount(30000, coupon)).toBe(30000); // capped at subtotal
    });
  });

  describe('calculateCartTotals & recalculateCartPricing', () => {
    it('should calculate complete cart summary correctly with selected and unselected items', () => {
      const items = [
        {
          price: 100000,
          originalPrice: 120000,
          quantity: 2,
          selected: true,
        },
        {
          price: 50000,
          originalPrice: 60000,
          quantity: 1,
          selected: false, // Not selected for checkout
        },
      ];

      const coupon = {
        code: 'SALE10',
        discountType: 'PERCENTAGE' as const,
        discountValue: 10,
      };

      const summary = calculateCartTotals(items, coupon);

      // Subtotal should only include selected items: 100,000 * 2 = 200,000
      expect(summary.subtotal).toBe(200000);
      expect(summary.totalOriginalPrice).toBe(240000);
      expect(summary.itemSavings).toBe(40000);

      // Coupon 10% of 200,000 = 20,000
      expect(summary.couponDiscount).toBe(20000);

      // Shipping fee since subtotal 200,000 < 500,000
      expect(summary.shippingFee).toBe(30000);

      // Total = 200,000 - 20,000 + 30,000 = 210,000
      expect(summary.totalPrice).toBe(210000);

      // Total distinct items and total quantity
      expect(summary.totalItems).toBe(2);
      expect(summary.totalQuantity).toBe(3);
      expect(summary.selectedItemsCount).toBe(1);
    });

    it('should mutably recalculate pricing on cart document', () => {
      const mockCart: any = {
        items: [
          { price: 300000, originalPrice: 300000, quantity: 2, selected: true }, // 600,000
        ],
        appliedCoupon: null,
      };

      recalculateCartPricing(mockCart);

      expect(mockCart.subtotal).toBe(600000);
      expect(mockCart.shippingFee).toBe(0); // free shipping threshold >= 500,000
      expect(mockCart.totalPrice).toBe(600000);
      expect(mockCart.totalItems).toBe(1);
      expect(mockCart.totalQuantity).toBe(2);
    });
  });
});

// ============================================================================
// 2. UNIT TESTS: VALIDATION SCHEMAS (cart.validation.ts)
// ============================================================================
describe('Cart Validation Schemas', () => {
  const validMongoId = new Types.ObjectId().toString();

  describe('addItemBodySchema', () => {
    it('should parse valid add to cart payload', () => {
      const valid = {
        productId: validMongoId,
        quantity: 2,
        selected: true,
      };
      const result = addItemBodySchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject invalid productId ObjectId', () => {
      const invalid = {
        productId: 'invalid-id-123',
        quantity: 1,
      };
      const result = addItemBodySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject quantity < 1 or > 999', () => {
      expect(
        addItemBodySchema.safeParse({ productId: validMongoId, quantity: 0 }).success
      ).toBe(false);
      expect(
        addItemBodySchema.safeParse({ productId: validMongoId, quantity: 1000 }).success
      ).toBe(false);
    });
  });

  describe('updateItemBodySchema', () => {
    it('should validate update when either quantity or selected is provided', () => {
      expect(updateItemBodySchema.safeParse({ quantity: 5 }).success).toBe(true);
      expect(updateItemBodySchema.safeParse({ selected: false }).success).toBe(true);
      expect(updateItemBodySchema.safeParse({ quantity: 3, selected: true }).success).toBe(true);
      expect(updateItemBodySchema.safeParse({}).success).toBe(false);
    });
  });

  describe('applyCouponBodySchema', () => {
    it('should trim and uppercase coupon code', () => {
      const result = applyCouponBodySchema.safeParse({ code: '  freeship  ' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.code).toBe('FREESHIP');
      }
    });
  });

  describe('mergeCartBodySchema', () => {
    it('should accept valid guestId or items array', () => {
      expect(mergeCartBodySchema.safeParse({ guestId: 'guest-session-1' }).success).toBe(true);
      expect(
        mergeCartBodySchema.safeParse({
          items: [{ productId: validMongoId, quantity: 1 }],
        }).success
      ).toBe(true);
      expect(mergeCartBodySchema.safeParse({}).success).toBe(false);
    });
  });
});

// ============================================================================
// 3. UNIT TESTS: CART SERVICE (cart.service.ts)
// ============================================================================
describe('CartService', () => {
  let service: CartService;

  beforeEach(() => {
    service = new CartService();
    vi.restoreAllMocks();
  });

  it('should add a new product item into cart and recalculate totals', async () => {
    const mockProductId = new Types.ObjectId();
    const mockUserId = new Types.ObjectId();

    const mockProduct: any = {
      _id: mockProductId,
      name: 'Áo Thun Basic',
      price: 150000,
      originalPrice: 200000,
      stock: 50,
      image: 'https://example.com/shirt.jpg',
      isActive: true,
      status: 'ACTIVE',
      deleted: false,
    };

    const mockCartInstance: any = {
      _id: new Types.ObjectId(),
      userId: mockUserId,
      items: [],
      appliedCoupon: null,
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(ProductModel, 'findOne').mockResolvedValue(mockProduct);
    vi.spyOn(service, 'getOrCreateCart').mockResolvedValue(mockCartInstance);

    const result = await service.addItem(
      { userId: mockUserId },
      {
        productId: mockProductId.toString(),
        quantity: 2,
        selected: true,
      }
    );

    expect(result.items.length).toBe(1);
    expect(result.items[0].name).toBe('Áo Thun Basic');
    expect(result.items[0].quantity).toBe(2);
    expect(result.items[0].price).toBe(150000);
    expect(result.subtotal).toBe(300000);
    expect(mockCartInstance.save).toHaveBeenCalled();
  });

  it('should increase quantity when adding an existing item in cart', async () => {
    const mockProductId = new Types.ObjectId();
    const mockUserId = new Types.ObjectId();

    const mockProduct: any = {
      _id: mockProductId,
      name: 'Quần Jeans',
      price: 350000,
      stock: 10,
      isActive: true,
      status: 'ACTIVE',
      deleted: false,
    };

    const mockCartInstance: any = {
      _id: new Types.ObjectId(),
      userId: mockUserId,
      items: [
        {
          productId: mockProductId,
          variantId: null,
          name: 'Quần Jeans',
          price: 350000,
          quantity: 2,
          selected: true,
        },
      ],
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(ProductModel, 'findOne').mockResolvedValue(mockProduct);
    vi.spyOn(service, 'getOrCreateCart').mockResolvedValue(mockCartInstance);

    const result = await service.addItem(
      { userId: mockUserId },
      {
        productId: mockProductId.toString(),
        quantity: 3,
      }
    );

    expect(result.items.length).toBe(1);
    expect(result.items[0].quantity).toBe(5); // 2 + 3
    expect(result.subtotal).toBe(1750000);
  });

  it('should throw error when adding quantity exceeding available stock', async () => {
    const mockProductId = new Types.ObjectId();
    const mockProduct: any = {
      _id: mockProductId,
      name: 'Giày Sneaker',
      price: 500000,
      stock: 3,
      isActive: true,
      status: 'ACTIVE',
      deleted: false,
    };

    const mockCartInstance: any = {
      _id: new Types.ObjectId(),
      items: [],
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(ProductModel, 'findOne').mockResolvedValue(mockProduct);
    vi.spyOn(service, 'getOrCreateCart').mockResolvedValue(mockCartInstance);

    await expect(
      service.addItem(
        { guestId: 'guest-123' },
        { productId: mockProductId.toString(), quantity: 10 }
      )
    ).rejects.toThrow(/Requested quantity exceeds available stock/);
  });

  it('should update item quantity and selection status', async () => {
    const itemId = new Types.ObjectId().toString();
    const productId = new Types.ObjectId();

    const mockCartInstance: any = {
      items: [
        {
          _id: itemId,
          productId,
          variantId: null,
          price: 100000,
          quantity: 1,
          selected: true,
        },
      ],
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(service, 'getOrCreateCart').mockResolvedValue(mockCartInstance);
    vi.spyOn(ProductModel, 'findOne').mockResolvedValue({
      _id: productId,
      stock: 20,
      isActive: true,
      deleted: false,
    } as any);

    const updated = await service.updateItem(
      { guestId: 'guest-123' },
      itemId,
      { quantity: 4, selected: false }
    );

    expect(updated.items[0].quantity).toBe(4);
    expect(updated.items[0].selected).toBe(false);
    expect(updated.subtotal).toBe(0); // since selected is false
  });

  it('should remove an item from cart', async () => {
    const itemId = new Types.ObjectId().toString();
    const mockCartInstance: any = {
      items: [
        {
          _id: itemId,
          price: 100000,
          quantity: 2,
          selected: true,
        },
      ],
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(service, 'getOrCreateCart').mockResolvedValue(mockCartInstance);

    const result = await service.removeItem({ guestId: 'guest-123' }, itemId);
    expect(result.items.length).toBe(0);
    expect(result.subtotal).toBe(0);
  });

  it('should clear all items and coupon from cart', async () => {
    const mockCartInstance: any = {
      items: [{ price: 100000, quantity: 2, selected: true }],
      appliedCoupon: { code: 'SALE10' },
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(service, 'getOrCreateCart').mockResolvedValue(mockCartInstance);

    const result = await service.clearCart({ guestId: 'guest-123' });
    expect(result.items.length).toBe(0);
    expect(result.appliedCoupon).toBeNull();
    expect(result.totalPrice).toBe(0);
  });

  it('should validate cart and identify out-of-stock and price changes', async () => {
    const productId1 = new Types.ObjectId();
    const productId2 = new Types.ObjectId();
    const itemId1 = new Types.ObjectId().toString();
    const itemId2 = new Types.ObjectId().toString();

    const mockCartInstance: any = {
      items: [
        {
          _id: itemId1,
          productId: productId1,
          name: 'Sản phẩm A',
          price: 100000, // old price was 100k
          quantity: 2,
          selected: true,
        },
        {
          _id: itemId2,
          productId: productId2,
          name: 'Sản phẩm B',
          price: 50000,
          quantity: 5,
          selected: true,
        },
      ],
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(service, 'getOrCreateCart').mockResolvedValue(mockCartInstance);

    // Product 1 price changed to 120,000
    vi.spyOn(ProductModel, 'findById').mockImplementation(((id: any) => {
      if (id.toString() === productId1.toString()) {
        return Promise.resolve({
          _id: productId1,
          name: 'Sản phẩm A',
          price: 120000,
          stock: 10,
          isActive: true,
          deleted: false,
        } as any);
      }
      if (id.toString() === productId2.toString()) {
        // Product 2 only has 2 left in stock
        return Promise.resolve({
          _id: productId2,
          name: 'Sản phẩm B',
          price: 50000,
          stock: 2,
          isActive: true,
          deleted: false,
        } as any);
      }
      return Promise.resolve(null);
    }) as any);

    const validation = await service.validateCart({ guestId: 'guest-123' }, true);

    expect(validation.isValid).toBe(false);
    expect(validation.issues.length).toBe(2);

    const priceIssue = validation.issues.find((i) => i.code === 'PRICE_CHANGED');
    const stockIssue = validation.issues.find((i) => i.code === 'INSUFFICIENT_STOCK');

    expect(priceIssue).toBeDefined();
    expect(priceIssue?.newPrice).toBe(120000);

    expect(stockIssue).toBeDefined();
    expect(stockIssue?.currentStock).toBe(2);

    // With autoFix = true, items were adjusted
    expect(mockCartInstance.items[0].price).toBe(120000);
    expect(mockCartInstance.items[1].quantity).toBe(2);
  });

  it('should merge guest cart items into user cart', async () => {
    const userId = new Types.ObjectId();
    const productId = new Types.ObjectId();

    const mockUserCart: any = {
      userId,
      items: [
        {
          productId,
          variantId: null,
          price: 200000,
          quantity: 1,
          selected: true,
        },
      ],
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(service, 'getOrCreateCart').mockResolvedValue(mockUserCart);
    vi.spyOn(ProductModel, 'findOne').mockResolvedValue({
      _id: productId,
      name: 'Váy Nữ',
      price: 200000,
      stock: 10,
      isActive: true,
      deleted: false,
    } as any);

    const merged = await service.mergeCart(userId, null, [
      {
        productId: productId.toString(),
        quantity: 2,
        selected: true,
      },
    ]);

    expect(merged.items.length).toBe(1);
    expect(merged.items[0].quantity).toBe(3); // 1 + 2
  });
});

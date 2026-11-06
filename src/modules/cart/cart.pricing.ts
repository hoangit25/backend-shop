import { ICart, ICartCoupon, ICartItem } from './cart.model';

export interface CartPricingConfig {
  freeShippingThreshold: number;
  baseShippingFee: number;
}

export const DEFAULT_PRICING_CONFIG: CartPricingConfig = {
  freeShippingThreshold: 500000, // Miễn phí vận chuyển cho đơn từ 500,000đ
  baseShippingFee: 30000,        // Phí vận chuyển tiêu chuẩn 30,000đ
};

export interface CartPricingCalculationResult {
  subtotal: number;
  totalOriginalPrice: number;
  itemSavings: number;
  couponDiscount: number;
  discountTotal: number;
  shippingFee: number;
  totalPrice: number;
  totalItems: number;
  totalQuantity: number;
  selectedItemsCount: number;
}

/**
 * Tính subtotal cho một item trong giỏ hàng
 */
export const calculateItemSubtotal = (price: number, quantity: number): number => {
  if (price < 0 || quantity < 0) return 0;
  return Math.round(price * quantity);
};

/**
 * Tính số tiền giảm giá từ coupon / voucher áp dụng
 */
export const calculateCouponDiscount = (
  subtotal: number,
  coupon?: ICartCoupon | null
): number => {
  if (!coupon || subtotal <= 0) return 0;

  if (coupon.minOrderValue && subtotal < coupon.minOrderValue) {
    return 0;
  }

  let discount = 0;
  if (coupon.discountType === 'PERCENTAGE') {
    discount = (subtotal * coupon.discountValue) / 100;
    if (coupon.maxDiscountAmount && coupon.maxDiscountAmount > 0) {
      discount = Math.min(discount, coupon.maxDiscountAmount);
    }
  } else if (coupon.discountType === 'FIXED_AMOUNT') {
    discount = coupon.discountValue;
  }

  // Giảm giá không vượt quá subtotal
  return Math.min(Math.round(discount), subtotal);
};

/**
 * Tính phí vận chuyển dựa trên giá trị đơn hàng được chọn
 */
export const calculateShippingFee = (
  subtotal: number,
  config: CartPricingConfig = DEFAULT_PRICING_CONFIG
): number => {
  if (subtotal <= 0) return 0;
  if (subtotal >= config.freeShippingThreshold) {
    return 0;
  }
  return config.baseShippingFee;
};

/**
 * Tính toán toàn bộ các chỉ số giá cho giỏ hàng
 */
export const calculateCartTotals = (
  items: Array<ICartItem | any>,
  coupon?: ICartCoupon | null,
  config: CartPricingConfig = DEFAULT_PRICING_CONFIG
): CartPricingCalculationResult => {
  let subtotal = 0;
  let totalOriginalPrice = 0;
  let totalQuantity = 0;
  let selectedItemsCount = 0;

  for (const item of items) {
    const qty = Math.max(0, item.quantity || 0);
    const unitPrice = Math.max(0, item.price || 0);
    const originalPrice = Math.max(unitPrice, item.originalPrice || 0);

    totalQuantity += qty;

    // Chỉ tính tiền cho những item được người dùng tick chọn (selected)
    if (item.selected !== false) {
      selectedItemsCount += 1;
      subtotal += calculateItemSubtotal(unitPrice, qty);
      totalOriginalPrice += calculateItemSubtotal(originalPrice, qty);
    }
  }

  const itemSavings = Math.max(0, totalOriginalPrice - subtotal);
  const couponDiscount = calculateCouponDiscount(subtotal, coupon);
  const discountTotal = couponDiscount;
  const shippingFee = calculateShippingFee(subtotal, config);
  const totalPrice = Math.max(0, subtotal - couponDiscount + shippingFee);

  return {
    subtotal,
    totalOriginalPrice,
    itemSavings,
    couponDiscount,
    discountTotal,
    shippingFee,
    totalPrice,
    totalItems: items.length,
    totalQuantity,
    selectedItemsCount,
  };
};

/**
 * Cập nhật trực tiếp các trường tính toán lên Cart Document trước khi lưu
 */
export const recalculateCartPricing = (
  cart: ICart | any,
  config: CartPricingConfig = DEFAULT_PRICING_CONFIG
): void => {
  const items = cart.items || [];
  const coupon = cart.appliedCoupon || null;

  const summary = calculateCartTotals(items, coupon, config);

  cart.subtotal = summary.subtotal;
  cart.discountTotal = summary.discountTotal;
  cart.shippingFee = summary.shippingFee;
  cart.totalPrice = summary.totalPrice;
  cart.totalItems = summary.totalItems;
  cart.totalQuantity = summary.totalQuantity;
  cart.lastActivityAt = new Date();
};


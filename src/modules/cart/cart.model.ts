import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICartItem {
  _id?: Types.ObjectId;
  productId: Types.ObjectId;
  variantId?: Types.ObjectId | null;
  sku?: string;
  name: string;
  image?: string;
  price: number;
  originalPrice?: number;
  quantity: number;
  selected: boolean;
  attributes?: Record<string, any>;
}

export type CouponDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';

export interface ICartCoupon {
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderValue?: number;
}

export type CartStatus = 'ACTIVE' | 'ORDERED' | 'ABANDONED';

export interface ICart extends Document {
  userId?: Types.ObjectId | null;
  guestId?: string | null;
  items: Types.DocumentArray<any>;
  appliedCoupon?: ICartCoupon | null;
  subtotal: number;
  discountTotal: number;
  shippingFee: number;
  totalPrice: number;
  totalItems: number;
  totalQuantity: number;
  status: CartStatus;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const cartItemSchema = new Schema(
  {
    productId: {
      type: Types.ObjectId,
      ref: 'Products',
      required: true,
    },
    variantId: {
      type: Types.ObjectId,
      ref: 'ProductVariant',
      default: null,
    },
    sku: {
      type: String,
      default: '',
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      default: '',
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    originalPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    selected: {
      type: Boolean,
      default: true,
    },
    attributes: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: true, timestamps: true }
);

const cartCouponSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    discountType: {
      type: String,
      enum: ['PERCENTAGE', 'FIXED_AMOUNT'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      min: 0,
    },
    minOrderValue: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

const cartSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    guestId: {
      type: String,
      default: null,
      index: true,
      trim: true,
    },
    items: {
      type: [cartItemSchema],
      default: [],
    },
    appliedCoupon: {
      type: cartCouponSchema,
      default: null,
    },
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    shippingFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalItems: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ORDERED', 'ABANDONED'],
      default: 'ACTIVE',
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

cartSchema.index({ userId: 1, status: 1 });
cartSchema.index({ guestId: 1, status: 1 });
cartSchema.index({ updatedAt: -1 });

export const CartModel = mongoose.model<ICart>('Cart', cartSchema, 'Carts');
export default CartModel;

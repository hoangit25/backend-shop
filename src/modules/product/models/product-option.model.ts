import mongoose, { Schema, Document, Types } from 'mongoose';

export type OptionDisplayType = 'TEXT' | 'COLOR' | 'IMAGE' | 'DROPDOWN';

export interface IOptionValue {
  name: string;             // Ví dụ: "Đỏ", "Size L", "128GB"
  code?: string;            // Mã màu Hex (#FF0000) hoặc SKU con nếu có
  image?: string;           // URL hình ảnh đại diện riêng cho value này
  priceAdjustment?: number; // Phụ thu giá khi chọn tùy chọn này (+10,000đ)
  isDefault?: boolean;      // Mặc định chọn trước khi render
}

export interface IProductOption extends Document {
  productId: Types.ObjectId;
  name: string;              // "Màu sắc", "Kích cỡ", "Dung lượng"
  type: OptionDisplayType;   // 'TEXT' | 'COLOR' | 'IMAGE' | 'DROPDOWN'
  isRequired: boolean;       // Bắt buộc chọn hay không
  description?: string;      // Mô tả hướng dẫn người dùng
  values: IOptionValue[];    // Danh sách tùy chọn chi tiết
  position: number;
  isActive: boolean;
  deleted: boolean;
  deletedAt: Date | null;
}

const optionValueSchema = new Schema<IOptionValue>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      default: '',
      trim: true,
    },
    image: {
      type: String,
      default: '',
    },
    priceAdjustment: {
      type: Number,
      default: 0,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: true,
  }
);

const productOptionSchema = new Schema(
  {
    productId: {
      type: Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['TEXT', 'COLOR', 'IMAGE', 'DROPDOWN'],
      default: 'TEXT',
    },
    isRequired: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      default: '',
    },
    values: {
      type: [optionValueSchema],
      required: true,
      validate: {
        validator: (v: IOptionValue[]) => Array.isArray(v) && v.length > 0,
        message: 'Product option must have at least one value',
      },
    },
    position: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

productOptionSchema.index({ productId: 1, deleted: 1 });

const ProductOptionModel = mongoose.model<IProductOption>(
  'ProductOption',
  productOptionSchema,
  'productoptions'
);
export default ProductOptionModel;

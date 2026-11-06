import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IProductVariant extends Document {
  productId: Types.ObjectId;
  sku: string;                    // Mã SKU định danh duy nhất (VD: "ATN-RED-L")
  barcode?: string;                // Mã vạch sản phẩm (EAN/UPC nếu có)
  size?: string;                   // Kích cỡ riêng (VD: "S", "M", "L", "XL", "42")
  color?: string;                  // Tên màu sắc riêng (VD: "Đỏ", "Xanh Navy", "Đen")
  colorCode?: string;              // Mã màu Hex riêng (VD: "#FF0000")
  optionValues?: Record<string, string>; // Tùy chọn mở rộng khác (nếu có: dung lượng, chất liệu...)
  price: number;                   // Giá bán riêng cho biến thể này
  originalPrice?: number;          // Giá niêm yết / giá gốc của biến thể này
  stock: number;                   // Số lượng tồn kho riêng của biến thể này
  sold: number;                    // Số lượng đã bán của biến thể này
  image: string;                   // Hình ảnh riêng của biến thể này (VD: ảnh áo khi chọn màu đỏ)
  weight?: number;                 // Trọng lượng riêng (gram)
  isActive: boolean;
  deleted: boolean;
  deletedAt: Date | null;
}

const productVariantSchema = new Schema(
  {
    productId: {
      type: Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      default: '',
      trim: true,
    },
    size: {
      type: String,
      default: '',
      trim: true,
    },
    color: {
      type: String,
      default: '',
      trim: true,
    },
    colorCode: {
      type: String,
      default: '',
      trim: true,
    },
    optionValues: {
      type: Schema.Types.Mixed,
      default: {},
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
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    sold: {
      type: Number,
      default: 0,
      min: 0,
    },
    image: {
      type: String,
      default: '',
    },
    weight: {
      type: Number,
      default: 0,
      min: 0,
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

// Indexes phục vụ tra cứu tốc độ cao
productVariantSchema.index({ productId: 1, deleted: 1 });
productVariantSchema.index({ productId: 1, size: 1, color: 1 });
productVariantSchema.index({ sku: 1 });
productVariantSchema.index({ barcode: 1 });

const ProductVariantModel = mongoose.model<IProductVariant>(
  'ProductVariant',
  productVariantSchema,
  'Productvariants'
);
export default ProductVariantModel;

import mongoose, { Schema, Document, Types } from 'mongoose';

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'OUT_OF_STOCK' | 'ARCHIVED';

export interface IProductAttribute {
  name: string;   // Ví dụ: "Chất liệu", "Xuất xứ", "Bảo hành"
  value: string;  // Ví dụ: "Cotton 100%", "Việt Nam", "12 tháng"
}

export interface IProductDimensions {
  length?: number; // cm
  width?: number;  // cm
  height?: number; // cm
}

export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  brand?: string;
  image: string;
  images: string[];
  categoryId: Types.ObjectId;
  price: number;
  originalPrice?: number;
  discount: number;
  stock: number;
  sold: number;
  rating: number;
  ratingCount: number;
  attributes: IProductAttribute[];
  tags: string[];
  weight?: number; // gram, tính cước vận chuyển
  dimensions?: IProductDimensions;
  status: ProductStatus;
  isFeatured: boolean;
  isActive: boolean;
  deleted: boolean;
  deletedAt: Date | null;
}

const productAttributeSchema = new Schema<IProductAttribute>(
  {
    name: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const productDimensionsSchema = new Schema<IProductDimensions>(
  {
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
  },
  { _id: false }
);

const productSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: '',
    },
    brand: {
      type: String,
      default: '',
      trim: true,
    },
    image: {
      type: String,
      default: '',
    },
    images: {
      type: [String],
      default: [],
    },
    categoryId: {
      type: Types.ObjectId,
      ref: 'Category',
      required: true,
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
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
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
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    attributes: {
      type: [productAttributeSchema],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
    },
    weight: {
      type: Number,
      default: 0,
      min: 0,
    },
    dimensions: {
      type: productDimensionsSchema,
      default: {},
    },
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'OUT_OF_STOCK', 'ARCHIVED'],
      default: 'ACTIVE',
    },
    isFeatured: {
      type: Boolean,
      default: false,
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

productSchema.index({ slug: 1 });
productSchema.index({ categoryId: 1, deleted: 1, isActive: 1 });
productSchema.index({ deleted: 1, isActive: 1 });
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ isFeatured: 1, deleted: 1, isActive: 1 });
productSchema.index({ sold: -1 });

const ProductModel = mongoose.model<IProduct>('Products', productSchema, 'Products');
export default ProductModel;

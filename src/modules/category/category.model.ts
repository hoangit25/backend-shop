import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: Types.ObjectId | null;
  position: number;
  isActive: boolean;
  deleted: boolean;
  deletedAt: Date | null;
}

const categorySchema = new Schema(
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
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    image: {
      type: String,
      default: '',
    },
    parentId: {
      type: Types.ObjectId,
      ref: 'Category',
      default: null,
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

categorySchema.index({ slug: 1 });
categorySchema.index({ parentId: 1, deleted: 1, isActive: 1 });
categorySchema.index({ deleted: 1, isActive: 1 });

const CategoryModel = mongoose.model<ICategory>('Category', categorySchema, 'categories');
export default CategoryModel;


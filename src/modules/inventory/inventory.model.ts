import mongoose, { Schema, Document, Types } from 'mongoose';

export type InventoryTransactionType = 'IMPORT' | 'EXPORT' | 'SALE' | 'RETURN' | 'ADJUSTMENT';

export interface IInventoryLog extends Document {
  productId: Types.ObjectId;
  variantId?: Types.ObjectId;
  type: InventoryTransactionType;
  quantityChange: number; // +10 (nhập) hoặc -2 (bán)
  previousStock: number;
  newStock: number;
  reason?: string;
  referenceId?: string; // Order ID hoặc Mã phiếu nhập hàng
  createdBy?: Types.ObjectId;
}

const inventoryLogSchema = new Schema(
  {
    productId: {
      type: Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    variantId: {
      type: Types.ObjectId,
      ref: 'ProductVariant',
      default: null,
    },
    type: {
      type: String,
      enum: ['IMPORT', 'EXPORT', 'SALE', 'RETURN', 'ADJUSTMENT'],
      required: true,
    },
    quantityChange: {
      type: Number,
      required: true,
    },
    previousStock: {
      type: Number,
      required: true,
    },
    newStock: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      default: '',
    },
    referenceId: {
      type: String,
      default: '',
    },
    createdBy: {
      type: Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

inventoryLogSchema.index({ productId: 1, createdAt: -1 });
inventoryLogSchema.index({ variantId: 1, createdAt: -1 });

const InventoryLogModel = mongoose.model<IInventoryLog>(
  'InventoryLog',
  inventoryLogSchema,
  'InventoryLogs'
);
export default InventoryLogModel;


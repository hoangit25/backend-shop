import mongoose from 'mongoose';
import { BaseRepository } from '../../../common/base-responsitory';
import ProductVariantModel, { IProductVariant } from '../models/product-variant.model';

export class ProductVariantRepository extends BaseRepository<IProductVariant> {
  constructor() {
    super(ProductVariantModel);
  }

  async findByProductId(productId: string) {
    const objId = mongoose.Types.ObjectId.isValid(productId)
      ? new mongoose.Types.ObjectId(productId)
      : productId;
    return this.find({
      $or: [{ productId: objId }, { productId: productId }, { 'productId.id': productId }],
      deleted: false,
    });
  }

  async findActiveByProductId(productId: string) {
    const objId = mongoose.Types.ObjectId.isValid(productId)
      ? new mongoose.Types.ObjectId(productId)
      : productId;
    return this.find({
      $or: [{ productId: objId }, { productId: productId }, { 'productId.id': productId }],
      deleted: false,
      isActive: true,
    });
  }

  async findBySku(sku: string) {
    return this.findOne({ sku: sku.toUpperCase(), deleted: false });
  }

  async findByBarcode(barcode: string) {
    return this.findOne({ barcode, deleted: false });
  }

  /**
   * Tra cứu theo Size & Color trực tiếp hoặc theo optionValues
   */
  async findBySizeAndColor(
    productId: string,
    params: { size?: string; color?: string; optionValues?: Record<string, string> }
  ) {
    const query: any = {
      productId,
      deleted: false,
      isActive: true,
    };

    if (params.size) {
      query.size = params.size;
    }
    if (params.color) {
      query.color = params.color;
    }
    if (params.optionValues && Object.keys(params.optionValues).length > 0) {
      query.optionValues = params.optionValues;
    }

    return this.findOne(query);
  }

  async deleteByProductId(productId: string) {
    return ProductVariantModel.updateMany(
      { productId, deleted: false },
      { $set: { deleted: true, deletedAt: new Date() } }
    );
  }

  async updateStock(variantId: string, quantity: number) {
    return this.updateById(variantId, { $inc: { stock: quantity } });
  }

  async updateSold(variantId: string, quantity: number) {
    return this.updateById(variantId, {
      $inc: { sold: quantity, stock: -quantity },
    });
  }
}

export const productVariantRepository = new ProductVariantRepository();

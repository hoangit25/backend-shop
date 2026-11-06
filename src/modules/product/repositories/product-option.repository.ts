import mongoose from 'mongoose';
import { BaseRepository } from '../../../common/base-responsitory';
import ProductOptionModel, { IProductOption } from '../models/product-option.model';

export class ProductOptionRepository extends BaseRepository<IProductOption> {
  constructor() {
    super(ProductOptionModel);
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
    return this.find(
      {
        $or: [{ productId: objId }, { productId: productId }, { 'productId.id': productId }],
        deleted: false,
        isActive: true,
      },
      null,
      { sort: { position: 1 } }
    );
  }

  async deleteByProductId(productId: string) {
    const objId = mongoose.Types.ObjectId.isValid(productId)
      ? new mongoose.Types.ObjectId(productId)
      : productId;
    return ProductOptionModel.updateMany(
      {
        $or: [{ productId: objId }, { productId: productId }, { 'productId.id': productId }],
        deleted: false,
      },
      { $set: { deleted: true, deletedAt: new Date() } }
    );
  }
}

export const productOptionRepository = new ProductOptionRepository();



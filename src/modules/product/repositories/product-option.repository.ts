import { BaseRepository } from '../../../common/base-responsitory';
import ProductOptionModel, { IProductOption } from '../models/product-option.model';

export class ProductOptionRepository extends BaseRepository<IProductOption> {
  constructor() {
    super(ProductOptionModel);
  }

  async findByProductId(productId: string) {
    return this.find({ productId, deleted: false });
  }

  async findActiveByProductId(productId: string) {
    return this.find(
      { productId, deleted: false, isActive: true },
      null,
      { sort: { position: 1 } }
    );
  }

  async deleteByProductId(productId: string) {
    return ProductOptionModel.updateMany(
      { productId, deleted: false },
      { $set: { deleted: true, deletedAt: new Date() } }
    );
  }
}

export const productOptionRepository = new ProductOptionRepository();


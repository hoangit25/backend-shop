import { BaseRepository } from '../../../common/base-responsitory';
import ProductModel, { IProduct } from '../models/product.model';

export class ProductRepository extends BaseRepository<IProduct> {
  constructor() {
    super(ProductModel);
  }

  async findBySlug(slug: string) {
    return this.findOne({ slug, deleted: false, isActive: true });
  }

  async findActiveById(id: string) {
    return this.findOne({ _id: id, deleted: false, isActive: true });
  }

  async findAllActive(filter: any = {}) {
    return this.find({ ...filter, deleted: false, isActive: true });
  }

  async findByCategory(categoryId: string) {
    return this.find({ categoryId, deleted: false, isActive: true });
  }

  async searchByName(keyword: string) {
    return this.find({
      $text: { $search: keyword },
      deleted: false,
      isActive: true,
    });
  }

  async updateStock(productId: string, quantity: number) {
    return this.updateById(productId, { $inc: { stock: quantity } });
  }

  async updateSold(productId: string, quantity: number) {
    return this.updateById(productId, {
      $inc: { sold: quantity, stock: -quantity },
    });
  }
}

export const productRepository = new ProductRepository();

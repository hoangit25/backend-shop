import { BaseRepository } from '../../../common/base-responsitory';
import ProductModel, { IProduct } from '../models/product.model';
import '../../category/category.model';
import { PAGINATION_DEFAULTS, PaginationQuery, PaginatedResult } from '../../../types/pagination.type';

export class ProductRepository extends BaseRepository<IProduct> {
  constructor() {
    super(ProductModel);
  }

  override async findWithPagination(
    filter: any,
    query: PaginationQuery = {}
  ): Promise<PaginatedResult<IProduct>> {
    const page = Math.max(1, query.page || PAGINATION_DEFAULTS.PAGE);
    const limit = Math.min(
      Math.max(1, query.limit || PAGINATION_DEFAULTS.LIMIT),
      PAGINATION_DEFAULTS.MAX_LIMIT
    );
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy || PAGINATION_DEFAULTS.SORT_BY;
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [items, totalItems] = await Promise.all([
      this.model
        .find(filter)
        .populate('categoryId', 'name slug image')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit),
      this.model.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      items: items as unknown as IProduct[],
      totalItems,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
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

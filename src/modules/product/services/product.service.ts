import mongoose, { Types } from 'mongoose';
import { AppError } from '../../../common/appError';
import { ProductRepository, productRepository } from '../repositories/product.repository';
import { ProductOptionRepository, productOptionRepository } from '../repositories/product-option.repository';
import { ProductVariantRepository, productVariantRepository } from '../repositories/product-variant.repository';
import { PRODUCT_MESSAGES } from '../constants/product.constant';
import { generateSlug } from '../utils/product.utils';
import { ICreateProduct, IUpdateProduct, IProductFilter } from '../types/product.type';
import { PaginationQuery } from '../../../types/pagination.type';
import { cacheService } from '../../../config/redis.config';

export class ProductService {
  constructor(
    private repository: ProductRepository = productRepository,
    private optionRepo: ProductOptionRepository = productOptionRepository,
    private variantRepo: ProductVariantRepository = productVariantRepository
  ) {}

  async createProduct(data: ICreateProduct) {
    const slug = generateSlug(data.name);

    const existingSlug = await this.repository.findBySlug(slug);
    if (existingSlug) {
      throw AppError.Conflict(PRODUCT_MESSAGES.PRODUCT_SLUG_EXISTS, 'SLUG_EXISTS');
    }

    const product = await this.repository.create({
      ...data,
      categoryId: new Types.ObjectId(data.categoryId) as any,
      slug,
    });

    // Invalidate product caches
    await cacheService.delPattern('products:*');
    return product;
  }

  async getProductById(id: string) {
    const product = await this.repository.findActiveById(id);
    if (!product) {
      throw AppError.NotFound(PRODUCT_MESSAGES.PRODUCT_NOT_FOUND, 'PRODUCT_NOT_FOUND');
    }
    return product;
  }

  async getProductBySlug(slug: string) {
    const product = await this.repository.findBySlug(slug);
    if (!product) {
      throw AppError.NotFound(PRODUCT_MESSAGES.PRODUCT_NOT_FOUND, 'PRODUCT_NOT_FOUND');
    }
    return product;
  }

  /**
   * Lấy chi tiết sản phẩm kèm Options và Variants với Redis Cache
   */
  async getProductDetail(identifier: string) {
    const cacheKey = `products:detail:${identifier}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
    const product = isObjectId
      ? await this.repository.findActiveById(identifier)
      : await this.repository.findBySlug(identifier);

    if (!product) {
      throw AppError.NotFound(PRODUCT_MESSAGES.PRODUCT_NOT_FOUND, 'PRODUCT_NOT_FOUND');
    }

    const productIdStr = product._id.toString();

    const [options, variants] = await Promise.all([
      this.optionRepo.findActiveByProductId(productIdStr),
      this.variantRepo.findActiveByProductId(productIdStr),
    ]);

    const result = {
      ...product.toObject(),
      options,
      variants,
    };

    // Cache kết quả trong 5 phút
    await cacheService.set(cacheKey, result, 300);
    return result;
  }

  /**
   * Tìm kiếm & Lọc danh sách sản phẩm có Redis Cache
   */
  async getProducts(filter: IProductFilter = {}, pagination: PaginationQuery = {}): Promise<any> {
    const cacheKey = `products:list:${JSON.stringify(filter)}:${JSON.stringify(pagination)}`;
    const cached = await cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const query: any = { deleted: false, isActive: true };

    if (filter.categoryId) {
      query.categoryId = filter.categoryId;
    }
    if (filter.brand) {
      query.brand = { $regex: filter.brand, $options: 'i' };
    }
    if (filter.keyword) {
      query.$or = [
        { name: { $regex: filter.keyword, $options: 'i' } },
        { description: { $regex: filter.keyword, $options: 'i' } },
        { tags: { $in: [new RegExp(filter.keyword, 'i')] } },
      ];
    }
    if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
      query.price = {};
      if (filter.minPrice !== undefined) query.price.$gte = filter.minPrice;
      if (filter.maxPrice !== undefined) query.price.$lte = filter.maxPrice;
    }
    if (filter.rating !== undefined) {
      query.rating = { $gte: filter.rating };
    }
    if (filter.inStock === true) {
      query.stock = { $gt: 0 };
    }
    if (filter.isFeatured !== undefined) {
      query.isFeatured = filter.isFeatured;
    }
    if (filter.status) {
      query.status = filter.status;
    }

    const result = await this.repository.findWithPagination(query, pagination);
    // Cache danh sách sản phẩm 2 phút
    await cacheService.set(cacheKey, result, 120);
    return result;
  }

  async updateProduct(id: string, data: IUpdateProduct) {
    const product = await this.repository.findById(id);
    if (!product || product.deleted) {
      throw AppError.NotFound(PRODUCT_MESSAGES.PRODUCT_NOT_FOUND, 'PRODUCT_NOT_FOUND');
    }

    const updateData: any = { ...data };
    if (data.categoryId) {
      updateData.categoryId = new Types.ObjectId(data.categoryId);
    }
    if (data.name && data.name !== product.name) {
      updateData.slug = generateSlug(data.name);
    }

    const updated = await this.repository.updateById(id, updateData);
    // Invalidate product caches
    await cacheService.delPattern('products:*');
    return updated;
  }

  async deleteProduct(id: string) {
    const product = await this.repository.findById(id);
    if (!product || product.deleted) {
      throw AppError.NotFound(PRODUCT_MESSAGES.PRODUCT_NOT_FOUND, 'PRODUCT_NOT_FOUND');
    }

    await Promise.all([
      this.repository.softDelete(id),
      this.optionRepo.deleteByProductId(id),
      this.variantRepo.deleteByProductId(id),
    ]);

    // Invalidate product caches
    await cacheService.delPattern('products:*');
    return { message: PRODUCT_MESSAGES.PRODUCT_DELETED };
  }

  async restoreProduct(id: string) {
    const product = await this.repository.findById(id);
    if (!product) {
      throw AppError.NotFound(PRODUCT_MESSAGES.PRODUCT_NOT_FOUND, 'PRODUCT_NOT_FOUND');
    }

    await this.repository.restore(id);
    await cacheService.delPattern('products:*');
    return { message: PRODUCT_MESSAGES.PRODUCT_RESTORED };
  }
}

export const productService = new ProductService();
